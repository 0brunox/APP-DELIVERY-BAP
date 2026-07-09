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
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [editFee, setEditFee] = useState("");

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

  function startEdit(z: DeliveryZone) {
    setEditingId(z.id);
    setEditName(z.name);
    setEditFee(String(z.fee));
  }

  async function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    const fee = parseFloat(editFee);
    if (!name) return;
    if (!Number.isFinite(fee) || fee < 0) return;
    setBusy(true);
    await supabase.from("delivery_zones").update({ name, fee }).eq("id", editingId);
    setEditingId(null);
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
        {initialZones.map((z) =>
          editingId === z.id ? (
            <div key={z.id} className="surface-2 flex items-center gap-2 rounded-lg p-2.5">
              <input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                className="surface w-full rounded-lg border-2 border-[var(--border)] p-1.5 text-sm outline-none focus:border-primary"
              />
              <input
                value={editFee}
                onChange={(e) => setEditFee(e.target.value)}
                type="number"
                step="0.01"
                min="0"
                className="surface w-24 rounded-lg border-2 border-[var(--border)] p-1.5 text-sm outline-none focus:border-primary"
              />
              <button onClick={saveEdit} disabled={busy} className="rounded bg-primary px-2 py-1 text-xs font-semibold text-white disabled:opacity-60" title="Salvar">
                ✓
              </button>
              <button onClick={() => setEditingId(null)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Cancelar">
                ✕
              </button>
            </div>
          ) : (
            <div key={z.id} className="surface-2 flex items-center gap-2 rounded-lg p-2.5">
              <span className="flex-1 font-semibold">{z.name}</span>
              <span className="text-sm font-semibold text-primary">{brl(z.fee)}</span>
              <button onClick={() => startEdit(z)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Editar">✏️</button>
              <button onClick={() => remove(z)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Excluir">🗑️</button>
            </div>
          )
        )}
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
