"use client";

import type { DaySchedule } from "@/lib/types";
import { DAY_KEYS, DAY_LABELS, TIMEZONES, type DayKey } from "@/lib/storeHours";

// Segunda primeiro, como o lojista lê a semana.
const ORDER: DayKey[] = [...DAY_KEYS.slice(1), DAY_KEYS[0]];

export default function HoursEditor({
  enabled,
  onEnabledChange,
  schedule,
  onScheduleChange,
  timezone,
  onTimezoneChange,
}: {
  enabled: boolean;
  onEnabledChange: (v: boolean) => void;
  schedule: Record<DayKey, DaySchedule>;
  onScheduleChange: (v: Record<DayKey, DaySchedule>) => void;
  timezone: string;
  onTimezoneChange: (v: string) => void;
}) {
  function setDay(day: DayKey, patch: Partial<DaySchedule>) {
    onScheduleChange({ ...schedule, [day]: { ...schedule[day], ...patch } });
  }

  function copyToAll(from: DayKey) {
    const src = schedule[from];
    onScheduleChange(
      Object.fromEntries(DAY_KEYS.map((d) => [d, { ...src }])) as Record<DayKey, DaySchedule>
    );
  }

  return (
    <div>
      <label className="surface-2 flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm">
        <input
          type="checkbox"
          className="h-[18px] w-[18px] accent-[var(--primary)]"
          checked={enabled}
          onChange={(e) => onEnabledChange(e.target.checked)}
        />
        Abrir e fechar a loja automaticamente neste horário
      </label>
      {!enabled && (
        <p className="mt-2 text-sm text-muted">
          Sem horário, a loja fica aberta o tempo todo — use o botão <strong>Loja aberta/fechada</strong> no
          topo do painel para fechar quando quiser.
        </p>
      )}

      {enabled && (
        <>
          <div className="mt-3 space-y-1.5">
            {ORDER.map((day) => {
              const d = schedule[day];
              return (
                <div key={day} className="surface-2 flex flex-wrap items-center gap-2 rounded-lg p-2 text-sm">
                  <label className="flex w-28 cursor-pointer items-center gap-2 font-semibold">
                    <input
                      type="checkbox"
                      className="h-[18px] w-[18px] accent-[var(--primary)]"
                      checked={d.enabled}
                      onChange={(e) => setDay(day, { enabled: e.target.checked })}
                    />
                    {DAY_LABELS[day]}
                  </label>
                  {d.enabled ? (
                    <>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]}: abre`}
                        className={time}
                        value={d.open}
                        onChange={(e) => setDay(day, { open: e.target.value })}
                      />
                      <span className="text-muted">às</span>
                      <input
                        type="time"
                        aria-label={`${DAY_LABELS[day]}: fecha`}
                        className={time}
                        value={d.close}
                        onChange={(e) => setDay(day, { close: e.target.value })}
                      />
                      <button
                        type="button"
                        onClick={() => copyToAll(day)}
                        className="ml-auto text-xs font-semibold text-primary hover:underline"
                      >
                        Copiar p/ todos
                      </button>
                    </>
                  ) : (
                    <span className="text-muted">Fechado</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-2 text-xs text-muted">
            Fecha depois da meia-noite? Use um fechamento menor que a abertura (ex.: 18:00 às 02:00). Fora do
            horário a loja não recebe pedidos — o botão no topo do painel abre ou fecha a qualquer momento.
          </p>
          <div className="mt-3">
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Fuso horário</label>
            <select
              className="surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
              value={timezone}
              onChange={(e) => onTimezoneChange(e.target.value)}
            >
              {TIMEZONES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
        </>
      )}
    </div>
  );
}

const time = "surface rounded-lg border-2 border-[var(--border)] px-2 py-1 text-sm outline-none focus:border-primary";
