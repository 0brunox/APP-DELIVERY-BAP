-- =====================================================================
-- SEED — loja de demonstração "Sabor Express" (cardápio + cupom + zonas)
-- Rode no SQL Editor do Supabase DEPOIS de criar pelo menos 1 usuário em
-- Authentication -> Users (a loja fica no nome do primeiro usuário).
-- É idempotente: pode rodar de novo sem duplicar.
-- =====================================================================

do $$
declare
  v_owner uuid;
  v_store uuid;
  v_pizza uuid;
  v_burger uuid;
  v_sides uuid;
begin
  select id into v_owner from auth.users order by created_at limit 1;
  if v_owner is null then
    raise exception 'Crie um usuário em Authentication -> Users antes de rodar o seed.';
  end if;

  insert into public.stores (owner, slug, name, settings)
  values (
    v_owner, 'sabor-express', 'Sabor Express',
    jsonb_build_object(
      'subtitle', 'Delivery rápido e sabor inigualável! Peça agora.',
      'whatsappNumber', '5521999999999',
      'deliveryFee', 6.00,
      'minOrderValue', 0,
      'currencySymbol', 'R$',
      'orderTypes', jsonb_build_object('delivery', true, 'pickup', true, 'dinein', false),
      'paymentMethods', jsonb_build_object('pix', true, 'card', true, 'cash', true),
      'pix', jsonb_build_object('keyType', 'telefone', 'key', '', 'holder', ''),
      'enableScheduling', false,
      'theme', jsonb_build_object('primary', '#f59e0b', 'secondary', '#fbbf24', 'font', 'Poppins', 'heroBanner', '')
    )
  )
  on conflict (slug) do update set name = excluded.name, settings = excluded.settings
  returning id into v_store;

  -- Recria o cardápio (idempotente)
  delete from public.products where store_id = v_store;
  delete from public.categories where store_id = v_store;
  delete from public.coupons where store_id = v_store;
  delete from public.delivery_zones where store_id = v_store;

  insert into public.categories (store_id, name, position, active)
    values (v_store, 'Pizzas', 0, true) returning id into v_pizza;
  insert into public.categories (store_id, name, position, active)
    values (v_store, 'Hambúrgueres', 1, true) returning id into v_burger;
  insert into public.categories (store_id, name, position, active)
    values (v_store, 'Acompanhamentos', 2, true) returning id into v_sides;

  insert into public.products
    (store_id, category_id, name, description, price, promo_price, image, available, badges, variations, addon_groups, position)
  values
    (v_store, v_pizza, 'Pizza Margherita', 'Molho de tomate, mussarela, manjericão fresco e azeite', 42.90, null,
     'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=400&h=300&fit=crop', true,
     '["vegetariano"]'::jsonb,
     '[{"name":"Pequena (4 fatias)","price":35.90},{"name":"Média (6 fatias)","price":42.90},{"name":"Grande (8 fatias)","price":49.90}]'::jsonb,
     '[{"name":"Extras","min":0,"max":3,"options":[{"name":"Borda de catupiry","price":8.0},{"name":"Bacon","price":5.0},{"name":"Cheddar extra","price":4.0}]}]'::jsonb, 0),
    (v_store, v_pizza, 'Pizza Calabresa', 'Calabresa fatiada, cebola, mussarela e azeitonas', 45.90, null,
     'https://images.unsplash.com/photo-1565299624946-b28f40a0ae38?w=400&h=300&fit=crop', true,
     '["novo"]'::jsonb, '[]'::jsonb,
     '[{"name":"Extras","min":0,"max":3,"options":[{"name":"Borda de catupiry","price":8.0},{"name":"Bacon","price":5.0}]}]'::jsonb, 1),
    (v_store, v_pizza, 'Pizza Portuguesa', 'Presunto, ovos, cebola, azeitonas e mussarela', 48.90, null,
     'https://images.unsplash.com/photo-1571997478779-2adcbbe9ab2f?w=400&h=300&fit=crop', true,
     '[]'::jsonb, '[]'::jsonb, '[]'::jsonb, 2),
    (v_store, v_burger, 'Hambúrguer Artesanal', 'Blend 180g, queijo cheddar, bacon e molho especial', 32.90, null,
     'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=400&h=300&fit=crop', true,
     '["maisvendido"]'::jsonb, '[]'::jsonb,
     '[{"name":"Adicionais","min":0,"max":5,"options":[{"name":"Bacon extra","price":4.5},{"name":"Ovo","price":2.5},{"name":"Cheddar","price":3.0}]}]'::jsonb, 0),
    (v_store, v_sides, 'Batata Frita Premium', 'Batatas rústicas com queijo, bacon e cebola caramelizada', 24.90, 19.90,
     'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=400&h=300&fit=crop', true,
     '["promo"]'::jsonb, '[]'::jsonb, '[]'::jsonb, 0);

  insert into public.coupons (store_id, code, type, value, min_order, max_uses, uses, active)
    values (v_store, 'BEMVINDO10', 'percent', 10, 30, 0, 0, true);

  insert into public.delivery_zones (store_id, name, fee) values
    (v_store, 'Centro', 5.00),
    (v_store, 'Jardim das Flores', 8.00);

  raise notice 'OK! Loja demo criada: slug=sabor-express id=%', v_store;
end $$;
