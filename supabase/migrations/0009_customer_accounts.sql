-- =====================================================================
-- Etapa 8 (parcial) — Conta do cliente (opcional)
--
-- O checkout guest continua funcionando. Se o cliente estiver logado
-- (Supabase Auth) na hora do pedido, o pedido é vinculado à conta dele,
-- e ele vê o histórico em qualquer aparelho via a RPC my_orders.
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0008).
-- =====================================================================

alter table public.orders
  add column if not exists customer_user uuid references auth.users(id) on delete set null;
create index if not exists orders_customer_user_idx on public.orders(customer_user);

-- Vincula automaticamente o pedido ao usuário logado (se houver), sem
-- precisar mexer no place_order. auth.uid() reflete o JWT da requisição.
create or replace function public.set_order_customer_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.customer_user is null then
    new.customer_user := auth.uid();
  end if;
  return new;
end; $$;
drop trigger if exists trg_order_customer_user on public.orders;
create trigger trg_order_customer_user before insert on public.orders
  for each row execute function public.set_order_customer_user();

-- Histórico de pedidos do cliente logado, nesta loja (mais recentes primeiro).
-- Anônimo (sem uid) recebe lista vazia.
create or replace function public.my_orders(p_store uuid)
returns jsonb language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(jsonb_build_object(
      'number', number, 'code', code, 'status', status,
      'order_type', order_type, 'total', total, 'created_at', created_at
    ) order by created_at desc), '[]'::jsonb)
  from public.orders
  where store_id = p_store and customer_user is not null and customer_user = auth.uid();
$$;
grant execute on function public.my_orders(uuid) to anon, authenticated;
