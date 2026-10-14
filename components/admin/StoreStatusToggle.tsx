"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Store } from "@/lib/types";
import { DEFAULT_TZ, formatWhen, overrideFor, storeStatus } from "@/lib/storeHours";

/** Botão abrir/fechar a loja (cabeçalho do painel). O fechamento manual vale até a
 *  próxima virada do horário de funcionamento; sem horário, até reabrir no botão. */
export default function StoreStatusToggle({ store }: { store: Store }) {
  const router = useRouter();
  const [override, setOverride] = useState({
    open_override: store.open_override ?? null,
    open_override_until: store.open_override_until ?? null,
  });
  const [now, setNow] = useState(() => new Date());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setOverride({
      open_override: store.open_override ?? null,
      open_override_until: store.open_override_until ?? null,
    });
  }, [store.open_override, store.open_override_until]);

  // Reavalia a cada 30s para virar sozinho no horário.
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(id);
  }, []);

  const settings = store.settings ?? {};
  const tz = settings.timezone || DEFAULT_TZ;
  const status = storeStatus({ settings, ...override }, now);

  const detail = status.until
    ? `${status.open ? "fecha" : "abre"} ${formatWhen(status.until, tz, now)}`
    : status.manual
      ? `${status.open ? "aberta" : "fechada"} até você mudar`
      : status.open
        ? "sem horário definido"
        : "fora do horário";

  async function toggle() {
    const wantOpen = !status.open;
    const next = overrideFor(settings, wantOpen);
    if (!wantOpen) {
      const reopen = next.open_override_until
        ? `Ela reabre sozinha ${formatWhen(new Date(next.open_override_until), tz)}, ou quando você clicar de novo.`
        : "Ela só reabre quando você clicar de novo.";
      if (!confirm(`Fechar a loja agora? Novos pedidos ficam bloqueados.\n\n${reopen}`)) return;
    }

    setSaving(true);
    const prev = override;
    setOverride(next);
    const { error } = await createClient().from("stores").update(next).eq("id", store.id);
    setSaving(false);
    if (error) {
      setOverride(prev);
      alert(
        error.message?.includes("open_override")
          ? "Rode a migration 0011_store_hours.sql no Supabase para ativar o abrir/fechar."
          : "Não foi possível alterar o status da loja."
      );
      return;
    }
    setNow(new Date());
    router.refresh();
  }

  return (
    <button
      type="button"
      role="switch"
      aria-checked={status.open}
      onClick={toggle}
      disabled={saving}
      title={status.open ? "Clique para fechar a loja" : "Clique para abrir a loja"}
      className={`flex items-center gap-2 rounded-full border-2 py-1 pl-1.5 pr-3 text-left transition disabled:opacity-60 ${
        status.open
          ? "border-green-500 bg-green-50 text-green-800 dark:bg-green-950/40 dark:text-green-300"
          : "border-red-500 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
      }`}
    >
      <span
        className={`relative h-5 w-9 shrink-0 rounded-full transition ${status.open ? "bg-green-500" : "bg-red-400"}`}
      >
        <span
          className={`absolute top-0.5 h-4 w-4 rounded-full bg-white shadow transition-all ${
            status.open ? "left-[18px]" : "left-0.5"
          }`}
        />
      </span>
      <span className="leading-tight">
        <span className="block text-sm font-bold">{status.open ? "Loja aberta" : "Loja fechada"}</span>
        <span className="hidden text-[11px] font-medium opacity-80 sm:block">{detail}</span>
      </span>
    </button>
  );
}
