-- =====================================================================
-- Etapa 12 (cobrança) — Assinatura Pro via Mercado Pago
--
-- A plataforma (você) cobra os lojistas pelo plano Pro. O dinheiro vai
-- para a SUA conta Mercado Pago. Guardamos aqui apenas o id da assinatura
-- (preapproval) para vincular pagamento -> loja e permitir cancelamento.
-- A troca de plano em si é feita pelo webhook (0008 já tem plan/plan_since).
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0009).
-- =====================================================================

alter table public.stores add column if not exists mp_preapproval_id text;
create index if not exists stores_mp_preapproval_idx on public.stores(mp_preapproval_id);
