"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import type { DeliveryZone } from "@/lib/types";

export default function ZonesManager({
  storeId,
  initialZones,
}: {
  storeId: string;
  initialZones: DeliveryZone[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [newFee, setNewFee] = useState("");
  const [busy, setBusy] = useState(false);

  async function add() {
    const name = newName.trim();
    const fee = parseFloat(newFee);
    if (!name) return;
    if (!Number.isFinite(fee) || fee < 0) return;
    setBusy(true);
    await supabase.from("delivery_zones").insert({ store_id: storeId, name, fee });
    setNewName("");
    setNewFee("");
    setBusy(false);
    router.refresh();
  }

  async function remove(z: DeliveryZone) {
    await supabase.from("delivery_zones").delete().eq("id", z.id);
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">📍 Zonas de entrega (por bairro)</h2>
      <p className="mb-3 text-sm text-muted">
        Com zonas cadastradas, o cliente escolhe o bairro e a taxa correspondente. Sem zonas, vale a taxa padrão das configurações.
      </p>

      <div className="mb-3 space-y-2">
        {initialZones.length === 0 && <p className="text-sm text-muted">Nenhuma zona cadastrada.</p>}
        {initialZones.map((z) => (
          <div key={z.id} className="surface-2 flex items-center gap-2 rounded-lg p-2.5">
            <span className="flex-1 font-semibold">{z.name}</span>
            <span className="text-sm font-semibold text-primary">{brl(z.fee)}</span>
            <button onClick={() => remove(z)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Excluir">🗑️</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Bairro"
          className="surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={newFee}
          onChange={(e) => setNewFee(e.target.value)}
          type="number"
          step="0.01"
          min="0"
          placeholder="Taxa R$"
          className="surface w-28 rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
        />
        <button onClick={add} disabled={busy} className="shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
          ➕
        </button>
      </div>
    </section>
  );
}
