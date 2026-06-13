-- =====================================================================
-- Delivery Super App — schema inicial (Etapa 6)
-- Rode este arquivo no SQL Editor do seu projeto Supabase.
-- =====================================================================

create extension if not exists pgcrypto;

-- ===================== TABELAS =======================================

-- Lojas (cada usuário autenticado pode ter a sua)
create table if not exists public.stores (
  id            uuid primary key default gen_random_uuid(),
  owner         uuid not null references auth.users(id) on delete cascade,
  slug          text not null unique,
  name          text not null,
  settings      jsonb not null default '{}'::jsonb,
  order_counter int  not null default 0,
  created_at    timestamptz not null default now()
);
create index if not exists stores_owner_idx on public.stores(owner);

-- Categorias do cardápio
create table if not exists public.categories (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores(id) on delete cascade,
  name      text not null,
  position  int  not null default 0,
  active    boolean not null default true
);
create index if not exists categories_store_idx on public.categories(store_id);

-- Produtos (variações e adicionais em JSONB)
create table if not exists public.products (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  category_id  uuid references public.categories(id) on delete set null,
  name         text not null,
  description  text not null default '',
  price        numeric(10,2) not null default 0,
  promo_price  numeric(10,2),
  image        text not null default '',
  available    boolean not null default true,
  badges       jsonb not null default '[]'::jsonb,
  variations   jsonb not null default '[]'::jsonb,
  addon_groups jsonb not null default '[]'::jsonb,
  position     int  not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists products_store_idx on public.products(store_id);

-- Cupons de desconto
create table if not exists public.coupons (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  code       text not null,
  type       text not null check (type in ('percent','fixed')),
  value      numeric(10,2) not null,
  min_order  numeric(10,2) not null default 0,
  expiry     date,
  max_uses   int not null default 0,
  uses       int not null default 0,
  active     boolean not null default true,
  unique (store_id, code)
);
create index if not exists coupons_store_idx on public.coupons(store_id);

-- Zonas de entrega (taxa por bairro)
create table if not exists public.delivery_zones (
  id        uuid primary key default gen_random_uuid(),
  store_id  uuid not null references public.stores(id) on delete cascade,
  name      text not null,
  fee       numeric(10,2) not null default 0
);
create index if not exists zones_store_idx on public.delivery_zones(store_id);

-- Clientes (perfil leve por telefone, por loja)
create table if not exists public.customers (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  phone      text not null,
  name       text not null default '',
  addresses  jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  unique (store_id, phone)
);

-- Pedidos
create table if not exists public.orders (
  id           uuid primary key default gen_random_uuid(),
  store_id     uuid not null references public.stores(id) on delete cascade,
  number       int not null,
  code         text not null default encode(gen_random_bytes(5), 'hex'),
  status       text not null default 'received'
                 check (status in ('received','preparing','ready','completed','cancelled')),
  order_type   text not null check (order_type in ('delivery','pickup','dinein')),
  customer     jsonb not null default '{}'::jsonb,
  payment      text not null,
  change_for   numeric(10,2),
  coupon       jsonb,
  schedule_at  text,
  subtotal     numeric(10,2) not null default 0,
  delivery_fee numeric(10,2) not null default 0,
  discount     numeric(10,2) not null default 0,
  total        numeric(10,2) not null default 0,
  created_at   timestamptz not null default now()
);
create index if not exists orders_store_idx on public.orders(store_id);
create index if not exists orders_code_idx  on public.orders(code);

-- Itens do pedido
create table if not exists public.order_items (
  id             uuid primary key default gen_random_uuid(),
  order_id       uuid not null references public.orders(id) on delete cascade,
  name           text not null,
  variation_name text,
  addons         jsonb not null default '[]'::jsonb,
  note           text not null default '',
  unit_price     numeric(10,2) not null,
  quantity       int not null
);
create index if not exists order_items_order_idx on public.order_items(order_id);

-- ===================== RLS (Row Level Security) ======================

alter table public.stores         enable row level security;
alter table public.categories     enable row level security;
alter table public.products       enable row level security;
alter table public.coupons        enable row level security;
alter table public.delivery_zones enable row level security;
alter table public.customers      enable row level security;
alter table public.orders         enable row level security;
alter table public.order_items    enable row level security;

-- Helper: o usuário atual é dono da loja?
create or replace function public.owns_store(p_store uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.stores s where s.id = p_store and s.owner = auth.uid());
$$;

-- LOJAS: leitura pública (cardápio por slug); dono gerencia a sua
drop policy if exists stores_public_read on public.stores;
create policy stores_public_read on public.stores for select using (true);
drop policy if exists stores_owner_all on public.stores;
create policy stores_owner_all on public.stores for all
  using (auth.uid() = owner) with check (auth.uid() = owner);

-- CATEGORIAS: leitura pública; dono escreve
drop policy if exists categories_public_read on public.categories;
create policy categories_public_read on public.categories for select using (true);
drop policy if exists categories_owner_write on public.categories;
create policy categories_owner_write on public.categories for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- PRODUTOS: leitura pública; dono escreve
drop policy if exists products_public_read on public.products;
create policy products_public_read on public.products for select using (true);
drop policy if exists products_owner_write on public.products;
create policy products_owner_write on public.products for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- ZONAS: leitura pública; dono escreve
drop policy if exists zones_public_read on public.delivery_zones;
create policy zones_public_read on public.delivery_zones for select using (true);
drop policy if exists zones_owner_write on public.delivery_zones;
create policy zones_owner_write on public.delivery_zones for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- CUPONS: somente o dono (validação pública é via RPC validate_coupon)
drop policy if exists coupons_owner_all on public.coupons;
create policy coupons_owner_all on public.coupons for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- CLIENTES: somente o dono
drop policy if exists customers_owner_all on public.customers;
create policy customers_owner_all on public.customers for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- PEDIDOS: somente o dono (criação pública é via RPC place_order;
-- acompanhamento público é via RPC get_order_by_code)
drop policy if exists orders_owner_all on public.orders;
create policy orders_owner_all on public.orders for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

drop policy if exists order_items_owner_all on public.order_items;
create policy order_items_owner_all on public.order_items for all
  using (exists (select 1 from public.orders o where o.id = order_id and public.owns_store(o.store_id)))
  with check (exists (select 1 from public.orders o where o.id = order_id and public.owns_store(o.store_id)));

-- ===================== RPCs (ações públicas controladas) =============

-- Valida um cupom contra o subtotal (sem expor a tabela de cupons)
create or replace function public.validate_coupon(p_store uuid, p_code text, p_subtotal numeric)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.coupons; v_disc numeric;
begin
  select * into v from public.coupons where store_id = p_store and upper(code) = upper(p_code) limit 1;
  if not found then return jsonb_build_object('ok', false, 'reason', 'Cupom não encontrado.'); end if;
  if not v.active then return jsonb_build_object('ok', false, 'reason', 'Cupom desativado.'); end if;
  if v.expiry is not null and v.expiry < current_date then
    return jsonb_build_object('ok', false, 'reason', 'Cupom expirado.');
  end if;
  if v.max_uses > 0 and v.uses >= v.max_uses then
    return jsonb_build_object('ok', false, 'reason', 'Cupom atingiu o limite de usos.');
  end if;
  if p_subtotal < v.min_order then
    return jsonb_build_object('ok', false, 'reason', 'Pedido mínimo de R$ ' || to_char(v.min_order, 'FM999990.00') || ' para este cupom.');
  end if;
  v_disc := case when v.type = 'percent' then p_subtotal * v.value / 100 else least(v.value, p_subtotal) end;
  return jsonb_build_object('ok', true, 'code', v.code, 'discount', round(v_disc, 2), 'type', v.type, 'value', v.value);
end; $$;
grant execute on function public.validate_coupon(uuid, text, numeric) to anon, authenticated;

-- Registra um pedido: recalcula o subtotal pelos itens, aplica cupom,
-- gera número sequencial por loja e grava pedido + itens atomicamente.
create or replace function public.place_order(p_store uuid, p_order jsonb, p_items jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  v_number   int;
  v_order    public.orders;
  v_subtotal numeric := 0;
  v_discount numeric := 0;
  v_fee      numeric := coalesce((p_order->>'delivery_fee')::numeric, 0);
  v_item     jsonb;
  v_coupon   public.coupons;
  v_code     text := nullif(p_order->'coupon'->>'code', '');
begin
  if not exists (select 1 from public.stores where id = p_store) then
    raise exception 'Loja não encontrada';
  end if;
  if jsonb_array_length(coalesce(p_items, '[]'::jsonb)) = 0 then
    raise exception 'Pedido sem itens';
  end if;

  -- Subtotal calculado no servidor (não confia no total do cliente)
  for v_item in select * from jsonb_array_elements(p_items) loop
    v_subtotal := v_subtotal + (v_item->>'unit_price')::numeric * (v_item->>'quantity')::int;
  end loop;

  -- Cupom (revalida e contabiliza uso)
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

  -- Número sequencial por loja
  update public.stores set order_counter = order_counter + 1
    where id = p_store returning order_counter into v_number;

  insert into public.orders
    (store_id, number, status, order_type, customer, payment, change_for, coupon, schedule_at, subtotal, delivery_fee, discount, total)
  values
    (p_store, v_number, 'received',
     p_order->>'order_type',
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
  from jsonb_array_elements(p_items) i;

  return jsonb_build_object('id', v_order.id, 'number', v_order.number, 'code', v_order.code,
                            'total', v_order.total, 'status', v_order.status);
end; $$;
grant execute on function public.place_order(uuid, jsonb, jsonb) to anon, authenticated;

-- Acompanhamento público do pedido pelo código (sem login)
create or replace function public.get_order_by_code(p_store uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.orders;
begin
  select * into v from public.orders where store_id = p_store and code = p_code limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'number', v.number, 'code', v.code, 'status', v.status, 'order_type', v.order_type,
    'total', v.total, 'created_at', v.created_at, 'schedule_at', v.schedule_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.name, 'variation_name', oi.variation_name, 'addons', oi.addons,
        'note', oi.note, 'unit_price', oi.unit_price, 'quantity', oi.quantity)), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v.id)
  );
end; $$;
grant execute on function public.get_order_by_code(uuid, text) to anon, authenticated;

-- ===================== STORAGE (imagens de produtos) ================

insert into storage.buckets (id, name, public)
values ('product-images', 'product-images', true)
on conflict (id) do nothing;

drop policy if exists product_images_public_read on storage.objects;
create policy product_images_public_read on storage.objects
  for select using (bucket_id = 'product-images');

drop policy if exists product_images_auth_insert on storage.objects;
create policy product_images_auth_insert on storage.objects
  for insert to authenticated with check (bucket_id = 'product-images');

drop policy if exists product_images_auth_update on storage.objects;
create policy product_images_auth_update on storage.objects
  for update to authenticated using (bucket_id = 'product-images');

drop policy if exists product_images_auth_delete on storage.objects;
create policy product_images_auth_delete on storage.objects
  for delete to authenticated using (bucket_id = 'product-images');

-- ===================== REALTIME (Etapa 7) ===========================
-- Habilita realtime na tabela de pedidos (painel ao vivo).
alter publication supabase_realtime add table public.orders;
