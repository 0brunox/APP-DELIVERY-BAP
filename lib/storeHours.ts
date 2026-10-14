// Horário de funcionamento da loja. Espelha store_open_by_schedule / store_is_open
// (migration 0011) — o banco é quem bloqueia o pedido; aqui é só para a interface.

import type { DaySchedule, Store, StoreSettings } from "./types";

export const DAY_KEYS = ["sunday", "monday", "tuesday", "wednesday", "thursday", "friday", "saturday"] as const;
export type DayKey = (typeof DAY_KEYS)[number];

export const DAY_LABELS: Record<DayKey, string> = {
  sunday: "Domingo",
  monday: "Segunda",
  tuesday: "Terça",
  wednesday: "Quarta",
  thursday: "Quinta",
  friday: "Sexta",
  saturday: "Sábado",
};
const DAY_SHORT = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

export const DEFAULT_TZ = "America/Sao_Paulo";
export const TIMEZONES: { value: string; label: string }[] = [
  { value: "America/Sao_Paulo", label: "Brasília (SP, RJ, MG, Sul, NE, GO, DF)" },
  { value: "America/Manaus", label: "Amazonas / MT / MS / RO / RR (−1h)" },
  { value: "America/Rio_Branco", label: "Acre (−2h)" },
  { value: "America/Noronha", label: "Fernando de Noronha (+1h)" },
];

export const DEFAULT_DAY: DaySchedule = { enabled: true, open: "09:00", close: "22:00" };

export function usesSchedule(s: StoreSettings): boolean {
  return (s.useSchedule ?? Boolean(s.schedule)) && Boolean(s.schedule);
}

function toMinutes(hhmm: string): number {
  const [h, m] = (hhmm || "0:0").split(":").map((n) => parseInt(n, 10) || 0);
  return h * 60 + m;
}

/** Dia da semana (0 = domingo) e minuto do dia no fuso da loja. */
function zoned(date: Date, tz: string): { dow: number; min: number } {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: tz,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const dow = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(get("weekday"));
  return { dow, min: (parseInt(get("hour"), 10) % 24) * 60 + parseInt(get("minute"), 10) };
}

/** Janela [start, end) em minutos a partir da 00:00 do dia; end > 1440 atravessa a meia-noite. */
function dayWindow(day: DaySchedule | undefined): [number, number] | null {
  if (!day?.enabled) return null;
  const start = toMinutes(day.open);
  let end = toMinutes(day.close);
  if (end <= start) end += 1440;
  return [start, end];
}

export function openBySchedule(s: StoreSettings, at: Date): boolean {
  if (!usesSchedule(s)) return true;
  const { dow, min } = zoned(at, s.timezone || DEFAULT_TZ);
  const today = dayWindow(s.schedule?.[DAY_KEYS[dow]]);
  if (today && min >= today[0] && min < today[1]) return true;
  const yesterday = dayWindow(s.schedule?.[DAY_KEYS[(dow + 6) % 7]]);
  return Boolean(yesterday && min + 1440 < yesterday[1]);
}

/** Próximo instante em que o horário muda o estado (abre ↔ fecha), ou null se nunca muda. */
export function nextScheduleChange(s: StoreSettings, from: Date): Date | null {
  if (!usesSchedule(s)) return null;
  const { dow, min } = zoned(from, s.timezone || DEFAULT_TZ);
  const minuteStart = Math.floor(from.getTime() / 60000) * 60000;
  const deltas: number[] = [];
  for (let d = -1; d <= 7; d++) {
    const w = dayWindow(s.schedule?.[DAY_KEYS[(dow + d + 7) % 7]]);
    if (!w) continue;
    for (const m of w) {
      const delta = d * 1440 + m - min;
      if (delta > 0) deltas.push(delta);
    }
  }
  const now = openBySchedule(s, from);
  for (const delta of deltas.sort((a, b) => a - b)) {
    const at = new Date(minuteStart + delta * 60000);
    if (openBySchedule(s, at) !== now) return at;
  }
  return null;
}

export interface OpenStatus {
  open: boolean;
  /** true quando o estado vem do botão manual, não do horário. */
  manual: boolean;
  /** Quando o estado atual muda sozinho (null = só manualmente). */
  until: Date | null;
}

export function storeStatus(
  store: Pick<Store, "settings" | "open_override" | "open_override_until">,
  now: Date = new Date()
): OpenStatus {
  const s = store.settings ?? {};
  const until = store.open_override_until ? new Date(store.open_override_until) : null;
  if (store.open_override != null && (!until || now < until)) {
    // No fim do override o horário costuma já concordar com ele (ex.: aberta à mão
    // às 23h até o horário abrir às 9h) — então a mudança real é a virada seguinte.
    const change =
      until && openBySchedule(s, until) === store.open_override ? nextScheduleChange(s, until) : until;
    return { open: store.open_override, manual: true, until: change };
  }
  return { open: openBySchedule(s, now), manual: false, until: nextScheduleChange(s, now) };
}

/** Override para o botão abrir/fechar: vale até a próxima virada do horário. */
export function overrideFor(
  s: StoreSettings,
  wantOpen: boolean,
  now: Date = new Date()
): { open_override: boolean | null; open_override_until: string | null } {
  if (openBySchedule(s, now) === wantOpen) return { open_override: null, open_override_until: null };
  const until = nextScheduleChange(s, now);
  return { open_override: wantOpen, open_override_until: until ? until.toISOString() : null };
}

/** "hoje às 22:00", "amanhã às 09:00", "sex às 18:00". */
export function formatWhen(date: Date, tz: string = DEFAULT_TZ, now: Date = new Date()): string {
  const time = new Intl.DateTimeFormat("pt-BR", { timeZone: tz, hour: "2-digit", minute: "2-digit" }).format(date);
  const dayOf = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d); // YYYY-MM-DD
  const diff = Math.round((Date.parse(dayOf(date)) - Date.parse(dayOf(now))) / 86400000);
  const day = diff === 0 ? "hoje" : diff === 1 ? "amanhã" : DAY_SHORT[zoned(date, tz).dow];
  return `${day} às ${time}`;
}
