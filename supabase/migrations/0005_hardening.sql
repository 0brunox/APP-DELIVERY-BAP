-- =====================================================================
-- Etapa Prod-1: hardening do place_order
-- Preços, adicionais e taxa de entrega passam a ser calculados no
-- servidor a partir do banco — valores enviados pelo cliente são
-- ignorados. Também valida inputs básicos (nome, telefone, tamanhos).
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- =====================================================================

create or replace function public.place_order(p_store uuid, p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_number    int;
  v_order     public.orders;
  v_subtotal  numeric := 0;
  v_discount  numeric := 0;
  v_fee       numeric := 0;
  v_item      jsonb;
  v_coupon    public.coupons;
  v_code      text := nullif(p_order->'coupon'->>'code', '');
  v_type      text := p_order->>'order_type';
  v_name      text := trim(coalesce(p_order->'customer'->>'name', ''));
  v_phone     text := regexp_replace(coalesce(p_order->'customer'->>'phone', ''), '\D', '', 'g');
  v_settings  jsonb;
  v_product   public.products;
  v_qty       int;
  v_unit      numeric;
  v_var_name  text;
  v_var_price numeric;
  v_addon     jsonb;
  v_addon_price numeric;
  v_items_out jsonb := '[]'::jsonb;
  v_zone      public.delivery_zones;
  v_zone_id   uuid;
  v_min_order numeric;
begin
  select settings into v_settings from public.stores where id = p_store;
  if not found then
    raise exception 'Loja não encontrada';
  end if;

  -- ===== Validação de inputs =====
  if v_type not in ('delivery', 'pickup', 'dinein') then
    raise exception 'Tipo de pedido inválido';
  end if;
  if v_name = '' or length(v_name) > 120 then
    raise exception 'Nome inválido';
  end if;
  if length(v_phone) < 10 or length(v_phone) > 15 then
    raise exception 'Telefone inválido';
  end if;
  if length(coalesce(p_order->'customer', '{}'::jsonb)::text) > 4000 then
    raise exception 'Dados do cliente muito longos';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens';
  end if;
  if jsonb_array_length(p_items) > 50 then
    raise exception 'Pedido com itens demais';
  end if;

  -- ===== Itens: preço unitário SEMPRE recalculado do banco =====
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_qty := coalesce((v_item->>'quantity')::int, 0);
    if v_qty < 1 or v_qty > 99 then
      raise exception 'Quantidade inválida';
    end if;
    if length(coalesce(v_item->>'note', '')) > 300 then
      raise exception 'Observação muito longa';
    end if;

    select * into v_product from public.products
      where id = (v_item->>'product_id')::uuid
        and store_id = p_store and available
      limit 1;
    if not found then
      raise exception 'Produto indisponível: %', coalesce(v_item->>'name', '?');
    end if;

    -- Preço base: variação escolhida ou preço (promocional) do produto
    v_var_name := nullif(v_item->>'variation_name', '');
    if v_var_name is not null then
      select (v->>'price')::numeric into v_var_price
        from jsonb_array_elements(v_product.variations) v
        where v->>'name' = v_var_name limit 1;
      if v_var_price is null then
        raise exception 'Variação inválida em %', v_product.name;
      end if;
      v_unit := v_var_price;
    elsif v_product.promo_price is not null and v_product.promo_price > 0
          and v_product.promo_price < v_product.price
          and jsonb_array_length(v_product.variations) = 0 then
      v_unit := v_product.promo_price;
    else
      v_unit := v_product.price;
    end if;

    -- Adicionais: preço buscado nos grupos do produto (pelo nome)
    for v_addon in select * from jsonb_array_elements(coalesce(v_item->'addons', '[]'::jsonb)) loop
      select (opt->>'price')::numeric into v_addon_price
        from jsonb_array_elements(v_product.addon_groups) g,
             jsonb_array_elements(g->'options') opt
        where opt->>'name' = v_addon->>'name' limit 1;
      if v_addon_price is null then
        raise exception 'Adicional inválido em %', v_product.name;
      end if;
      v_unit := v_unit + v_addon_price;
    end loop;

    v_subtotal := v_subtotal + v_unit * v_qty;
    v_items_out := v_items_out || jsonb_build_array(jsonb_build_object(
      'name', v_product.name,
      'variation_name', v_var_name,
      'addons', coalesce(v_item->'addons', '[]'::jsonb),
      'note', coalesce(v_item->>'note', ''),
      'unit_price', round(v_unit, 2),
      'quantity', v_qty));
  end loop;

  -- ===== Taxa de entrega: calculada no servidor =====
  if v_type = 'delivery' then
    if exists (select 1 from public.delivery_zones where store_id = p_store) then
      v_zone_id := nullif(p_order->>'zone_id', '')::uuid;
      select * into v_zone from public.delivery_zones
        where id = v_zone_id and store_id = p_store limit 1;
      if not found then
        raise exception 'Selecione um bairro de entrega válido';
      end if;
      v_fee := greatest(0, v_zone.fee);
    else
      v_fee := greatest(0, coalesce((v_settings->>'deliveryFee')::numeric, 0));
    end if;

    v_min_order := coalesce((v_settings->>'minOrderValue')::numeric, 0);
    if v_min_order > 0 and v_subtotal < v_min_order then
      raise exception 'Pedido mínimo para entrega não atingido';
    end if;
  end if;

  -- ===== Cupom (revalida e contabiliza uso) =====
  if v_code is not null then
    select * into v_coupon from public.coupons
      where store_id = p_store and upper(code) = upper(v_code) and active
        and (expiry is null or expiry >= current_date)
        and (max_uses = 0 or uses < max_uses)
        and v_subtotal >= min_order
      limit 1;
    if found then
      v_discount := case when v_coupon.type = 'percent' then v_subtotal * v_coupon.value / 100 else least(v_coupon.value, v_subtotal) end;
      update public.coupons set uses = uses + 1 where id = v_coupon.id;
    end if;
  end if;

  -- ===== Número sequencial por loja =====
  update public.stores set order_counter = order_counter + 1
    where id = p_store returning order_counter into v_number;

  insert into public.orders
    (store_id, number, status, order_type, customer, payment, change_for, coupon, schedule_at, subtotal, delivery_fee, discount, total)
  values
    (p_store, v_number, 'received',
     v_type,
     coalesce(p_order->'customer', '{}'::jsonb),
     p_order->>'payment',
     nullif(p_order->>'change_for', '')::numeric,
     case when v_discount > 0 then jsonb_build_object('code', v_code, 'discount', round(v_discount, 2)) else null end,
     nullif(p_order->>'schedule_at', ''),
     round(v_subtotal, 2), round(v_fee, 2), round(v_discount, 2),
     round(greatest(0, v_subtotal - v_discount) + v_fee, 2))
  returning * into v_order;

  insert into public.order_items (order_id, name, variation_name, addons, note, unit_price, quantity)
  select v_order.id, i->>'name', nullif(i->>'variation_name', ''),
         coalesce(i->'addons', '[]'::jsonb), coalesce(i->>'note', ''),
         (i->>'unit_price')::numeric, (i->>'quantity')::int
  from jsonb_array_elements(v_items_out) i;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'code', v_order.code,
                            'total', v_order.total, 'status', v_order.status);
end; $$;
grant execute on function public.place_order(uuid, jsonb, jsonb) to anon, authenticated;
