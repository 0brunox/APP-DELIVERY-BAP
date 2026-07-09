-- =====================================================================
-- Etapa 12 — Super app: planos, limites, QR de mesa, avaliações,
-- super-admin da plataforma e SEO.
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0007).
-- IMPORTANTE: na seção "SUPER-ADMIN" troque o e-mail pelo seu, se preciso.
-- =====================================================================

-- ===================== PLANOS E STATUS DA LOJA =======================

alter table public.stores add column if not exists plan       text not null default 'free'
  check (plan in ('free', 'pro'));
alter table public.stores add column if not exists plan_since  timestamptz;
alter table public.stores add column if not exists active      boolean not null default true;

-- Limites por plano (free tem teto; pro é ilimitado = null).
create or replace function public.plan_limit_products(p_plan text)
returns int language sql immutable as $$
  select case when p_plan = 'pro' then null else 30 end;
$$;
create or replace function public.plan_limit_orders_month(p_plan text)
returns int language sql immutable as $$
  select case when p_plan = 'pro' then null else 100 end;
$$;

-- Bloqueio amigável: produto acima do limite do plano free.
create or replace function public.enforce_product_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text; v_limit int; v_count int;
begin
  select plan into v_plan from public.stores where id = new.store_id;
  v_limit := public.plan_limit_products(v_plan);
  if v_limit is not null then
    select count(*) into v_count from public.products where store_id = new.store_id;
    if v_count >= v_limit then
      raise exception 'LIMITE_PLANO_PRODUTOS:%', v_limit using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_product_limit on public.products;
create trigger trg_product_limit before insert on public.products
  for each row execute function public.enforce_product_limit();

-- Bloqueio: pedidos acima do limite mensal do plano free (loja para de receber).
create or replace function public.enforce_order_limit()
returns trigger language plpgsql security definer set search_path = public as $$
declare v_plan text; v_active boolean; v_limit int; v_count int;
begin
  select plan, active into v_plan, v_active from public.stores where id = new.store_id;
  if not v_active then
    raise exception 'LOJA_SUSPENSA' using errcode = 'P0001';
  end if;
  v_limit := public.plan_limit_orders_month(v_plan);
  if v_limit is not null then
    select count(*) into v_count from public.orders
      where store_id = new.store_id and created_at >= date_trunc('month', now());
    if v_count >= v_limit then
      raise exception 'LIMITE_PLANO_PEDIDOS:%', v_limit using errcode = 'P0001';
    end if;
  end if;
  return new;
end; $$;
drop trigger if exists trg_order_limit on public.orders;
create trigger trg_order_limit before insert on public.orders
  for each row execute function public.enforce_order_limit();

-- Uso atual do plano (para a barrinha no painel do lojista).
create or replace function public.plan_usage(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'plan', s.plan,
    'products', (select count(*) from public.products where store_id = s.id),
    'products_limit', public.plan_limit_products(s.plan),
    'orders_month', (select count(*) from public.orders
      where store_id = s.id and created_at >= date_trunc('month', now())),
    'orders_limit', public.plan_limit_orders_month(s.plan)
  )
  from public.stores s where s.id = p_store;
$$;
grant execute on function public.plan_usage(uuid) to authenticated;

-- ===================== AVALIAÇÕES ===================================

create table if not exists public.reviews (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  order_code text not null,
  rating     int  not null check (rating between 1 and 5),
  comment    text not null default '',
  author     text not null default '',
  approved   boolean not null default true,
  created_at timestamptz not null default now(),
  unique (store_id, order_code)
);
create index if not exists reviews_store_idx on public.reviews(store_id);

alter table public.reviews enable row level security;
-- Leitura pública apenas das aprovadas; dono gerencia (moderação) as suas.
drop policy if exists reviews_public_read on public.reviews;
create policy reviews_public_read on public.reviews for select using (approved);
drop policy if exists reviews_owner_all on public.reviews;
create policy reviews_owner_all on public.reviews for all
  using (public.owns_store(store_id)) with check (public.owns_store(store_id));

-- Cliente envia avaliação só para um pedido real dele (pelo código secreto).
create or replace function public.submit_review(p_store uuid, p_code text, p_rating int, p_comment text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v_order public.orders; v_author text;
begin
  if p_rating < 1 or p_rating > 5 then
    return jsonb_build_object('ok', false, 'reason', 'Nota inválida.');
  end if;
  select * into v_order from public.orders where store_id = p_store and code = p_code limit 1;
  if not found then
    return jsonb_build_object('ok', false, 'reason', 'Pedido não encontrado.');
  end if;
  if exists (select 1 from public.reviews where store_id = p_store and order_code = p_code) then
    return jsonb_build_object('ok', false, 'reason', 'Este pedido já foi avaliado.');
  end if;
  v_author := coalesce(v_order.customer->>'name', '');
  insert into public.reviews (store_id, order_code, rating, comment, author)
    values (p_store, p_code, p_rating, left(coalesce(p_comment, ''), 500), v_author);
  return jsonb_build_object('ok', true);
end; $$;
grant execute on function public.submit_review(uuid, text, int, text) to anon, authenticated;

-- Nota média + total aprovados (selo público da loja).
create or replace function public.store_rating(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'avg', coalesce(round(avg(rating)::numeric, 1), 0),
    'count', count(*)
  )
  from public.reviews where store_id = p_store and approved;
$$;
grant execute on function public.store_rating(uuid) to anon, authenticated;

-- ===================== SUPER-ADMIN DA PLATAFORMA =====================

create table if not exists public.platform_admins (
  email text primary key
);
alter table public.platform_admins enable row level security;
-- Sem policy: fechada; consultada só pelas funções SECURITY DEFINER.

-- >>> Cadastre-se como admin da plataforma (troque pelo seu e-mail se for outro):
insert into public.platform_admins (email) values ('brunocorreia65@gmail.com')
  on conflict (email) do nothing;

create or replace function public.is_platform_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.platform_admins
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;
grant execute on function public.is_platform_admin() to authenticated;

-- Métricas gerais da plataforma (só para admins).
create or replace function public.platform_stats()
returns jsonb language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Não autorizado';
  end if;
  return jsonb_build_object(
    'stores', (
      select coalesce(jsonb_agg(row_to_json(t) order by (t.gmv) desc), '[]'::jsonb) from (
        select s.id, s.name, s.slug, s.plan, s.active, s.created_at,
          (select count(*) from public.orders o where o.store_id = s.id and o.status <> 'cancelled') as orders,
          (select coalesce(sum(o.total), 0) from public.orders o where o.store_id = s.id and o.status <> 'cancelled') as gmv
        from public.stores s
      ) t
    ),
    'totals', (
      select jsonb_build_object(
        'stores', (select count(*) from public.stores),
        'stores_pro', (select count(*) from public.stores where plan = 'pro'),
        'orders', (select count(*) from public.orders where status <> 'cancelled'),
        'gmv', (select coalesce(sum(total), 0) from public.orders where status <> 'cancelled')
      )
    )
  );
end; $$;
grant execute on function public.platform_stats() to authenticated;

-- Admin muda plano / ativa / suspende uma loja.
create or replace function public.platform_set_store(p_store uuid, p_plan text, p_active boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_platform_admin() then
    raise exception 'Não autorizado';
  end if;
  if p_plan not in ('free', 'pro') then
    raise exception 'Plano inválido';
  end if;
  update public.stores
    set plan = p_plan,
        plan_since = case when p_plan = 'pro' and plan <> 'pro' then now() else plan_since end,
        active = p_active
    where id = p_store;
end; $$;
grant execute on function public.platform_set_store(uuid, text, boolean) to authenticated;
