-- =====================================================================
-- Etapa 11 — IA (garçom virtual, upsell, cadastro por foto, insights)
--
-- 1) ai_usage: contador diário de chamadas de IA por loja (limite de uso).
-- 2) ai_use(): RPC que incrementa e verifica o limite atomicamente.
-- 3) top_items(): itens mais vendidos (dado público agregado, alimenta
--    o upsell sem expor pedidos individuais).
-- 4) products.translations / categories.translations: cardápio em EN/ES.
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0006).
-- =====================================================================

-- ===================== LIMITE DE USO =================================

create table if not exists public.ai_usage (
  store_id uuid not null references public.stores(id) on delete cascade,
  day      date not null default current_date,
  requests int  not null default 0,
  primary key (store_id, day)
);

-- Fechada ao público: só as RPCs mexem nela.
alter table public.ai_usage enable row level security;

-- Incrementa o contador do dia e diz se ainda está dentro do limite.
create or replace function public.ai_use(p_store uuid, p_limit int)
returns boolean language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  if not exists (select 1 from public.stores where id = p_store) then
    return false;
  end if;
  insert into public.ai_usage (store_id, day, requests)
    values (p_store, current_date, 1)
    on conflict (store_id, day) do update set requests = ai_usage.requests + 1
    returning requests into v_count;
  return v_count <= p_limit;
end; $$;
grant execute on function public.ai_use(uuid, int) to anon, authenticated;

-- ===================== ITENS MAIS VENDIDOS (p/ upsell) ===============

-- Agregado dos últimos 60 dias; não expõe nenhum pedido individual.
create or replace function public.top_items(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object('name', t.name, 'qty', t.qty)), '[]'::jsonb)
  from (
    select oi.name, sum(oi.quantity)::int as qty
    from public.order_items oi
    join public.orders o on o.id = oi.order_id
    where o.store_id = p_store
      and o.status <> 'cancelled'
      and o.created_at >= now() - interval '60 days'
    group by oi.name
    order by qty desc
    limit 15
  ) t;
$$;
grant execute on function public.top_items(uuid) to anon, authenticated;

-- ===================== TRADUÇÕES DO CARDÁPIO =========================

-- Formato: {"en": {"name": "...", "description": "..."}, "es": {...}}
alter table public.products   add column if not exists translations jsonb not null default '{}'::jsonb;
alter table public.categories add column if not exists translations jsonb not null default '{}'::jsonb;
