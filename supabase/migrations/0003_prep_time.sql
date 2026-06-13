-- ============================================================================
-- 0003 — Tempo de preparo / previsão de pronto (Etapa 7C)
--
-- Adiciona orders.ready_at: a previsão de quando o pedido fica pronto/entregue,
-- definida quando o LOJISTA aceita o pedido escolhendo o tempo de preparo.
-- Também atualiza o broadcast (0002) para enviar o ready_at junto, e a função
-- de acompanhamento para devolvê-lo já no carregamento inicial da tela.
--
-- COMO USAR: rode este arquivo inteiro no SQL Editor do Supabase
-- (depois do 0001 e do 0002).
-- ============================================================================

alter table public.orders add column if not exists ready_at timestamptz;

-- Broadcast agora inclui ready_at; dispara quando muda o status OU a previsão.
create or replace function public.broadcast_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  if new.status is distinct from old.status
     or new.ready_at is distinct from old.ready_at then
    perform realtime.send(
      jsonb_build_object(
        'status',   new.status,
        'number',   new.number,
        'ready_at', new.ready_at
      ),
      'status',                 -- nome do evento
      'order:' || new.code,     -- tópico (canal) = código secreto do pedido
      false                     -- público: a segurança é o código aleatório
    );
  end if;
  return new;
end;
$$;

-- Acompanhamento público passa a devolver ready_at também.
create or replace function public.get_order_by_code(p_store uuid, p_code text)
returns jsonb language plpgsql security definer set search_path = public as $$
declare v public.orders;
begin
  select * into v from public.orders where store_id = p_store and code = p_code limit 1;
  if not found then return null; end if;
  return jsonb_build_object(
    'number', v.number, 'code', v.code, 'status', v.status, 'order_type', v.order_type,
    'total', v.total, 'created_at', v.created_at, 'schedule_at', v.schedule_at,
    'ready_at', v.ready_at,
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'name', oi.name, 'variation_name', oi.variation_name, 'addons', oi.addons,
        'note', oi.note, 'unit_price', oi.unit_price, 'quantity', oi.quantity)), '[]'::jsonb)
      from public.order_items oi where oi.order_id = v.id)
  );
end; $$;
grant execute on function public.get_order_by_code(uuid, text) to anon, authenticated;
