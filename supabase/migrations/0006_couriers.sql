-- =====================================================================
-- Etapa 10 — Entregadores e rastreamento ao vivo
--
-- O entregador NÃO tem login: ele acessa /entregador/<token> (link
-- secreto gerado no cadastro, mesmo modelo "quem tem o código, acessa"
-- do acompanhamento de pedido). Todas as ações dele passam por RPCs
-- SECURITY DEFINER validadas pelo token.
--
-- A posição do entregador é gravada na tabela (posição inicial ao abrir
-- a página) e transmitida ao vivo por Realtime Broadcast no tópico
-- `track:<code do pedido>` para a tela de acompanhamento do cliente.
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0005).
-- =====================================================================

-- ===================== TABELA =======================================

create table if not exists public.couriers (
  id          uuid primary key default gen_random_uuid(),
  store_id    uuid not null references public.stores(id) on delete cascade,
  name        text not null,
  phone       text not null default '',
  token       text not null unique default encode(gen_random_bytes(12), 'hex'),
  active      boolean not null default true,
  last_lat    double precision,
  last_lng    double precision,
  location_at timestamptz,
  created_at  timestamptz not null default now()
);
create index if not exists couriers_store_idx on public.couriers(store_id);

alter table public.orders add column if not exists courier_id uuid references public.couriers(id) on delete set null;
alter table public.orders add column if not exists delivered_at timestamptz;
create index if not exists orders_courier_idx on public.orders(courier_id);

-- RLS: somente o dono da loja gerencia (o token nunca é lido pelo público;
-- o entregador usa as RPCs abaixo).
alter table public.couriers enable row level security;
drop policy if exists couriers_owner_all on public.couriers;
create policy couriers_owner_all on public.couriers for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- ===================== RPCs do entregador ============================

-- Painel do entregador: dados dele, entregas ativas e resumo da semana.
create or replace function public.courier_get_board(p_token text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.couriers; v_store public.stores;
begin
  select * into c from public.couriers where token = p_token and active limit 1;
  if not found then return null; end if;
  select * into v_store from public.stores where id = c.store_id;

  return jsonb_build_object(
    'courier', jsonb_build_object('name', c.name, 'phone', c.phone),
    'store', jsonb_build_object('name', v_store.name, 'slug', v_store.slug),
    'deliveries', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', o.id, 'number', o.number, 'code', o.code, 'status', o.status,
        'customer', o.customer, 'payment', o.payment, 'total', o.total,
        'delivery_fee', o.delivery_fee, 'created_at', o.created_at, 'ready_at', o.ready_at,
        'items', (select coalesce(jsonb_agg(jsonb_build_object(
            'name', oi.name, 'variation_name', oi.variation_name,
            'quantity', oi.quantity)), '[]'::jsonb)
          from public.order_items oi where oi.order_id = o.id)
      ) order by o.created_at), '[]'::jsonb)
      from public.orders o
      where o.courier_id = c.id and o.order_type = 'delivery'
        and o.status in ('preparing', 'ready')
    ),
    'week', (
      select jsonb_build_object('count', count(*), 'fees', coalesce(sum(o.delivery_fee), 0))
      from public.orders o
      where o.courier_id = c.id and o.status = 'completed'
        and coalesce(o.delivered_at, o.created_at) >= now() - interval '7 days'
    )
  );
end; $$;
grant execute on function public.courier_get_board(text) to anon, authenticated;

-- Entregador avança o pedido: 'ready' = "peguei o pedido / saiu para
-- entrega"; 'completed' = "entregue". O trigger do 0002 avisa o cliente.
create or replace function public.courier_set_status(p_token text, p_order uuid, p_status text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare c public.couriers; o public.orders;
begin
  select * into c from public.couriers where token = p_token and active limit 1;
  if not found then raise exception 'Acesso inválido'; end if;

  select * into o from public.orders
    where id = p_order and courier_id = c.id and order_type = 'delivery' limit 1;
  if not found then raise exception 'Entrega não encontrada'; end if;

  if p_status = 'ready' and o.status = 'preparing' then
    update public.orders set status = 'ready' where id = o.id;
  elsif p_status = 'completed' and o.status = 'ready' then
    update public.orders set status = 'completed', delivered_at = now() where id = o.id;
  else
    raise exception 'Transição de status não permitida';
  end if;

  return jsonb_build_object('id', o.id, 'status', p_status);
end; $$;
grant execute on function public.courier_set_status(text, uuid, text) to anon, authenticated;

-- Posição do entregador: grava a última posição e transmite ao vivo
-- para o canal de rastreamento de cada entrega em rota ('ready').
create or replace function public.courier_update_location(p_token text, p_lat double precision, p_lng double precision)
returns void language plpgsql security definer set search_path = public, realtime as $$
declare c public.couriers; v_code text;
begin
  if p_lat is null or p_lng is null or abs(p_lat) > 90 or abs(p_lng) > 180 then
    raise exception 'Coordenadas inválidas';
  end if;

  select * into c from public.couriers where token = p_token and active limit 1;
  if not found then raise exception 'Acesso inválido'; end if;

  update public.couriers
    set last_lat = p_lat, last_lng = p_lng, location_at = now()
    where id = c.id;

  for v_code in
    select o.code from public.orders o
    where o.courier_id = c.id and o.order_type = 'delivery' and o.status = 'ready'
  loop
    perform realtime.send(
      jsonb_build_object('lat', p_lat, 'lng', p_lng, 'at', now()),
      'location',
      'track:' || v_code,
      false
    );
  end loop;
end; $$;
grant execute on function public.courier_update_location(text, double precision, double precision) to anon, authenticated;

-- ===================== Acompanhamento do cliente =====================

-- Inclui o bloco do entregador (nome, telefone e última posição) no
-- retorno do acompanhamento público, quando houver entregador atribuído.
create or replace function public.get_order_by_code(p_store uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.orders; v_courier public.couriers;
begin
  select * into v from public.orders where store_id = p_store and code = p_code limit 1;
  if not found then return null; end if;
  if v.courier_id is not null then
    select * into v_courier from public.couriers where id = v.courier_id limit 1;
  end if;
  return jsonb_build_object(
    'number', v.number, 'code', v.code, 'status', v.status, 'order_type', v.order_type,
    'total', v.total, 'created_at', v.created_at, 'schedule_at', v.schedule_at,
    'ready_at', v.ready_at,
    'customer', v.customer,
    'courier', case when v_courier.id is not null then jsonb_build_object(
        'name', v_courier.name, 'phone', v_courier.phone,
        'lat', v_courier.last_lat, 'lng', v_courier.last_lng,
        'location_at', v_courier.location_at) else null end,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.name, 'variation_name', oi.variation_name, 'addons', oi.addons,
        'note', oi.note, 'unit_price', oi.unit_price, 'quantity', oi.quantity)), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v.id)
  );
end; $$;
grant execute on function public.get_order_by_code(uuid, text) to anon, authenticated;
