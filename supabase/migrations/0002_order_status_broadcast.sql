-- ============================================================================
-- 0002 — Status do pedido em tempo real para o CLIENTE (Etapa 7B)
--
-- O cliente é anônimo e, por RLS, não tem SELECT na tabela `orders` (só enxerga
-- o pedido via a função get_order_by_code). Por isso o Realtime "postgres_changes"
-- não chega para ele. A solução aqui é Realtime BROADCAST disparado pelo banco:
-- quando o status de um pedido muda, transmitimos a novidade por um canal
-- nomeado pelo CÓDIGO secreto do pedido (tópico `order:<code>`). A tela pública
-- de acompanhamento assina esse canal e atualiza na hora, sem refresh.
--
-- Segurança: o canal é público, mas o nome dele é o código aleatório do pedido
-- (mesmo modelo de "quem tem o código, acompanha" da função get_order_by_code).
--
-- COMO USAR: rode este arquivo inteiro no SQL Editor do Supabase (depois do 0001).
-- ============================================================================

create or replace function public.broadcast_order_status()
returns trigger
language plpgsql
security definer
set search_path = public, realtime
as $$
begin
  -- Só transmite quando o status realmente muda.
  if new.status is distinct from old.status then
    perform realtime.send(
      jsonb_build_object(
        'status', new.status,
        'number', new.number
      ),
      'status',                 -- nome do evento
      'order:' || new.code,     -- tópico (canal) = código secreto do pedido
      false                     -- público: a segurança é o código aleatório
    );
  end if;
  return new;
end;
$$;

drop trigger if exists trg_broadcast_order_status on public.orders;
create trigger trg_broadcast_order_status
  after update on public.orders
  for each row
  execute function public.broadcast_order_status();
