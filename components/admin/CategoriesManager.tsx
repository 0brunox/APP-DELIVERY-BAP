"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

export default function CategoriesManager({
  storeId,
  initialCategories,
}: {
  storeId: string;
  initialCategories: Category[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);

  const cats = [...initialCategories].sort((a, b) => a.position - b.position);

  async function addCategory() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    const nextPos = cats.length ? Math.max(...cats.map((c) => c.position)) + 1 : 0;
    await supabase.from("categories").insert({ store_id: storeId, name, position: nextPos, active: true });
    setNewName("");
    setBusy(false);
    router.refresh();
  }

  async function rename(cat: Category) {
    const name = prompt("Novo nome da categoria:", cat.name);
    if (!name || !name.trim()) return;
    await supabase.from("categories").update({ name: name.trim() }).eq("id", cat.id);
    router.refresh();
  }

  async function toggle(cat: Category) {
    await supabase.from("categories").update({ active: !cat.active }).eq("id", cat.id);
    router.refresh();
  }

  async function move(cat: Category, dir: -1 | 1) {
    const idx = cats.findIndex((c) => c.id === cat.id);
    const target = idx + dir;
    if (target < 0 || target >= cats.length) return;
    const other = cats[target];
    setBusy(true);
    await Promise.all([
      supabase.from("categories").update({ position: other.position }).eq("id", cat.id),
      supabase.from("categories").update({ position: cat.position }).eq("id", other.id),
    ]);
    setBusy(false);
    router.refresh();
  }

  async function remove(cat: Category) {
    if (!confirm(`Excluir a categoria "${cat.name}"? Os produtos dela passam para "Outros".`)) return;
    setBusy(true);
    // Desvincula os produtos antes de excluir
    await supabase.from("products").update({ category_id: null }).eq("category_id", cat.id);
    await supabase.from("categories").delete().eq("id", cat.id);
    setBusy(false);
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-3 text-lg font-bold">📂 Categorias</h2>

      <div className="mb-3 space-y-2">
        {cats.length === 0 && <p className="text-sm text-muted">Nenhuma categoria ainda.</p>}
        {cats.map((cat, idx) => (
          <div
            key={cat.id}
            className={`surface-2 flex items-center gap-2 rounded-lg p-2 ${cat.active ? "" : "opacity-50"}`}
          >
            <button onClick={() => move(cat, -1)} disabled={idx === 0 || busy} className="px-1 text-muted disabled:opacity-30" aria-label="Subir">▲</button>
            <button onClick={() => move(cat, 1)} disabled={idx === cats.length - 1 || busy} className="px-1 text-muted disabled:opacity-30" aria-label="Descer">▼</button>
            <span className="flex-1 font-semibold">{cat.name}</span>
            <button onClick={() => toggle(cat)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title={cat.active ? "Desativar" : "Ativar"}>
              {cat.active ? "👁️" : "🚫"}
            </button>
            <button onClick={() => rename(cat)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Renomear">✏️</button>
            <button onClick={() => remove(cat)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Excluir">🗑️</button>
          </div>
        ))}
      </div>

      <div className="flex gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && addCategory()}
          placeholder="Nova categoria (ex: Bebidas)"
          className="surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
        />
        <button onClick={addCategory} disabled={busy} className="shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white disabled:opacity-60">
          ➕ Adicionar
        </button>
      </div>
    </section>
  );
}
