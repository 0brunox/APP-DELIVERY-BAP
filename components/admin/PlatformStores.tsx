"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";

export interface PlatformStore {
  id: string;
  name: string;
  slug: string;
  plan: "free" | "pro";
  active: boolean;
  created_at: string;
  orders: number;
  gmv: number;
}

/** Lista de lojas com controles de plano e suspensão (só super-admin). */
export default function PlatformStores({ stores }: { stores: PlatformStore[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [rows, setRows] = useState(stores);
  const [busy, setBusy] = useState<string | null>(null);

  async function update(s: PlatformStore, plan: "free" | "pro", active: boolean) {
    setBusy(s.id);
    setRows((prev) => prev.map((x) => (x.id === s.id ? { ...x, plan, active } : x)));
    await supabase.rpc("platform_set_store", { p_store: s.id, p_plan: plan, p_active: active });
    setBusy(null);
    router.refresh();
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] text-sm">
        <thead>
          <tr className="border-b border-[var(--border)] text-left text-xs uppercase text-muted">
            <th className="p-2">Loja</th>
            <th className="p-2 text-right">Pedidos</th>
            <th className="p-2 text-right">GMV</th>
            <th className="p-2 text-center">Plano</th>
            <th className="p-2 text-center">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((s) => (
            <tr key={s.id} className="border-b border-[var(--border)]">
              <td className="p-2">
                <div className="font-semibold">{s.name}</div>
                <a href={`/${s.slug}`} target="_blank" rel="noopener noreferrer" className="text-xs text-primary hover:underline">
                  /{s.slug} ↗
                </a>
              </td>
              <td className="p-2 text-right font-semibold">{s.orders}</td>
              <td className="p-2 text-right font-semibold">{brl(Number(s.gmv))}</td>
              <td className="p-2 text-center">
                <button
                  onClick={() => update(s, s.plan === "pro" ? "free" : "pro", s.active)}
                  disabled={busy === s.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                    s.plan === "pro"
                      ? "bg-amber-100 text-amber-700 hover:bg-amber-200"
                      : "surface-2 text-muted hover:bg-[var(--surface)]"
                  }`}
                  title="Alternar plano"
                >
                  {s.plan === "pro" ? "⭐ Pro" : "Free"}
                </button>
              </td>
              <td className="p-2 text-center">
                <button
                  onClick={() => update(s, s.plan, !s.active)}
                  disabled={busy === s.id}
                  className={`rounded-full px-2.5 py-1 text-xs font-bold transition ${
                    s.active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-red-100 text-red-700 hover:bg-red-200"
                  }`}
                  title="Ativar/suspender loja"
                >
                  {s.active ? "Ativa" : "Suspensa"}
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
