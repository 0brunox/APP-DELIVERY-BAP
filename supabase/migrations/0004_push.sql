-- ============================================================================
-- 0004 — Web Push: inscrições de notificação (Etapa 7D)
--
-- Guarda as "push subscriptions" do navegador (endpoint + chaves) para enviar
-- notificações: do LOJISTA (scope='owner', por loja) e do CLIENTE (scope=
-- 'customer', por código de pedido). Tudo via RPC SECURITY DEFINER — a tabela
-- fica fechada (sem acesso direto). Os endpoints não são úteis a terceiros sem
-- a chave VAPID privada do servidor (que nunca sai do backend), então listar
-- alvos por RPC é seguro contra envio de push falso.
--
-- COMO USAR: rode este arquivo inteiro no SQL Editor do Supabase (após 0001..0003).
-- ============================================================================

create table if not exists public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  store_id   uuid not null references public.stores(id) on delete cascade,
  scope      text not null check (scope in ('owner', 'customer')),
  order_code text,                       -- preenchido quando scope='customer'
  endpoint   text not null unique,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);
create index if not exists push_sub_store_idx on public.push_subscriptions(store_id, scope);
create index if not exists push_sub_code_idx  on public.push_subscriptions(order_code);

alter table public.push_subscriptions enable row level security;
-- Sem policies de propósito: ninguém acessa a tabela direto. Tudo via RPCs abaixo.

-- Salva (ou atualiza) uma inscrição, validando o escopo:
--   owner    -> quem chama precisa ser dono da loja
--   customer -> o código do pedido precisa existir na loja
create or replace function public.save_push_subscription(
  p_store uuid, p_scope text, p_code text,
  p_endpoint text, p_p256dh text, p_auth text
) returns void language plpgsql security definer set search_path = public as $$
begin
  if p_scope = 'owner' then
    if not public.owns_store(p_store) then raise exception 'Não autorizado'; end if;
  elsif p_scope = 'customer' then
    if not exists (select 1 from public.orders where store_id = p_store and code = p_code) then
      raise exception 'Pedido não encontrado';
    end if;
  else
    raise exception 'Escopo inválido';
  end if;

  insert into public.push_subscriptions (store_id, scope, order_code, endpoint, p256dh, auth)
  values (p_store, p_scope, nullif(p_code, ''), p_endpoint, p_p256dh, p_auth)
  on conflict (endpoint) do update
    set store_id   = excluded.store_id,
        scope      = excluded.scope,
        order_code = excluded.order_code,
        p256dh     = excluded.p256dh,
        auth       = excluded.auth;
end; $$;
grant execute on function public.save_push_subscription(uuid, text, text, text, text, text) to anon, authenticated;

-- Lista os alvos de envio (usado pelo backend do app para mandar o push).
create or replace function public.list_push_targets(p_store uuid, p_scope text, p_code text)
returns table (endpoint text, p256dh text, auth text)
language sql security definer set search_path = public as $$
  select endpoint, p256dh, auth
  from public.push_subscriptions
  where store_id = p_store and scope = p_scope
    and (p_scope <> 'customer' or order_code = p_code);
$$;
grant execute on function public.list_push_targets(uuid, text, text) to anon, authenticated;

-- Remove uma inscrição pelo endpoint (ex.: quando o navegador a invalida — 410).
create or replace function public.delete_push_subscription(p_endpoint text)
returns void language sql security definer set search_path = public as $$
  delete from public.push_subscriptions where endpoint = p_endpoint;
$$;
grant execute on function public.delete_push_subscription(text) to anon, authenticated;
