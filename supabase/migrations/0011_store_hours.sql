-- =====================================================================
-- Horário de funcionamento + abrir/fechar a loja manualmente
--
-- • settings.schedule (jsonb) guarda os horários por dia da semana
--   ({ monday: { enabled, open: "09:00", close: "22:00" }, ... }).
--   settings.useSchedule liga/desliga a abertura automática pelo horário
--   (sem a chave, vale "tem schedule?" — compatível com backups antigos).
--   settings.timezone é o fuso da loja (padrão America/Sao_Paulo).
-- • open_override força a loja aberta/fechada pelo botão do painel até
--   open_override_until (a próxima virada do horário); null = indefinido.
-- • Um trigger bloqueia pedidos com a loja fechada (LOJA_FECHADA).
--
-- Rode este arquivo no SQL Editor do Supabase (depois do 0010).
-- =====================================================================

alter table public.stores add column if not exists open_override       boolean;
alter table public.stores add column if not exists open_override_until timestamptz;

-- A loja está aberta pelo horário configurado neste instante?
-- Janela do dia: [open, close). Se close <= open, a janela atravessa a
-- meia-noite (ex.: 18:00–02:00); open = close significa 24h a partir de open.
create or replace function public.store_open_by_schedule(p_settings jsonb, p_at timestamptz)
returns boolean language plpgsql stable set search_path = public as $$
declare
  v_days  text[] := array['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
  v_tz    text := coalesce(nullif(p_settings->>'timezone', ''), 'America/Sao_Paulo');
  v_local timestamp;
  v_dow   int;
  v_min   int;
  v_day   jsonb;
  v_start int;
  v_end   int;
  i       int;
begin
  if not coalesce((p_settings->>'useSchedule')::boolean, p_settings ? 'schedule') then
    return true;
  end if;
  if jsonb_typeof(p_settings->'schedule') is distinct from 'object' then
    return true;
  end if;

  v_local := p_at at time zone v_tz;
  v_dow := extract(dow from v_local)::int;
  v_min := extract(hour from v_local)::int * 60 + extract(minute from v_local)::int;

  -- i = 0: hoje; i = 1: ontem (sobra da madrugada)
  for i in 0..1 loop
    v_day := p_settings->'schedule'->(v_days[((v_dow - i + 7) % 7) + 1]);
    if v_day is not null and coalesce((v_day->>'enabled')::boolean, false) then
      v_start := split_part(v_day->>'open', ':', 1)::int * 60 + split_part(v_day->>'open', ':', 2)::int;
      v_end   := split_part(v_day->>'close', ':', 1)::int * 60 + split_part(v_day->>'close', ':', 2)::int;
      if v_end <= v_start then v_end := v_end + 1440; end if;
      if i = 0 and v_min >= v_start and v_min < v_end then return true; end if;
      if i = 1 and v_min + 1440 < v_end then return true; end if;
    end if;
  end loop;
  return false;
exception when others then
  -- Horário malformado não pode travar a loja.
  return true;
end; $$;

-- Estado efetivo: botão manual (se vigente) ou horário.
create or replace function public.store_is_open(p_store uuid)
returns boolean language plpgsql stable security definer set search_path = public as $$
declare v public.stores;
begin
  select * into v from public.stores where id = p_store;
  if not found then return false; end if;
  if v.open_override is not null and (v.open_override_until is null or now() < v.open_override_until) then
    return v.open_override;
  end if;
  return public.store_open_by_schedule(v.settings, now());
end; $$;
grant execute on function public.store_is_open(uuid) to anon, authenticated;

-- Bloqueia pedidos com a loja fechada.
create or replace function public.enforce_store_open()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.store_is_open(new.store_id) then
    raise exception 'LOJA_FECHADA' using errcode = 'P0001';
  end if;
  return new;
end; $$;
drop trigger if exists trg_store_open on public.orders;
create trigger trg_store_open before insert on public.orders
  for each row execute function public.enforce_store_open();
