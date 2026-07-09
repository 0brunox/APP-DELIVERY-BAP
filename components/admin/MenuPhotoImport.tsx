"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Category } from "@/lib/types";

interface Draft {
  name: string;
  description: string;
  price: string;
  category: string;
  selected: boolean;
}

/** Lê o arquivo, reduz para no máx. 1600px e devolve JPEG base64 (sem prefixo). */
async function fileToBase64Jpeg(file: File): Promise<string> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, 1600 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.85).split(",")[1];
}

/** Cadastro por foto: a IA extrai os produtos e o lojista revisa antes de salvar. */
export default function MenuPhotoImport({
  storeId,
  categories,
}: {
  storeId: string;
  categories: Category[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [busy, setBusy] = useState(false);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  async function onFile(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setMsg("");
    setDrafts([]);
    try {
      const image = await fileToBase64Jpeg(file);
      const res = await fetch("/api/ai/menu-photo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ image, mediaType: "image/jpeg" }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Não foi possível ler a foto.");
        return;
      }
      const found = (data.products ?? []) as { name: string; description: string; price: number; category: string }[];
      if (found.length === 0) {
        setMsg("Nenhum item legível encontrado na foto. Tente uma foto mais nítida.");
        return;
      }
      setDrafts(
        found.map((p) => ({
          name: p.name,
          description: p.description,
          price: p.price ? String(p.price) : "",
          category: p.category,
          selected: true,
        }))
      );
    } catch {
      setMsg("Não foi possível processar a imagem.");
    } finally {
      setBusy(false);
    }
  }

  function edit(i: number, patch: Partial<Draft>) {
    setDrafts((d) => d.map((x, j) => (j === i ? { ...x, ...patch } : x)));
  }

  async function save() {
    const chosen = drafts.filter((d) => d.selected && d.name.trim());
    if (chosen.length === 0) return;
    setSaving(true);
    setMsg("");

    // Garante que as categorias citadas existem (cria as que faltam).
    const catByName = new Map(categories.map((c) => [c.name.toLowerCase(), c.id]));
    const missing = [...new Set(
      chosen.map((d) => d.category.trim()).filter((n) => n && !catByName.has(n.toLowerCase()))
    )];
    for (const name of missing) {
      const { data } = await supabase
        .from("categories")
        .insert({ store_id: storeId, name, position: 99 })
        .select("id, name")
        .single();
      if (data) catByName.set(data.name.toLowerCase(), data.id);
    }

    const rows = chosen.map((d) => ({
      store_id: storeId,
      name: d.name.trim(),
      description: d.description.trim(),
      price: parseFloat(d.price) || 0,
      category_id: catByName.get(d.category.trim().toLowerCase()) ?? null,
      available: true,
    }));
    const { error } = await supabase.from("products").insert(rows);
    setSaving(false);
    if (error) {
      setMsg("Não foi possível salvar os produtos.");
      return;
    }
    setDrafts([]);
    setMsg(`✅ ${rows.length} produto(s) cadastrados! Revise preços e fotos abaixo.`);
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">📸 Cadastrar por foto do cardápio</h2>
      <p className="mb-3 text-sm text-muted">
        Fotografe seu cardápio em papel e a IA pré-cadastra os produtos. Nada é publicado sem a sua revisão.
      </p>

      <label className={`inline-block cursor-pointer rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white ${busy ? "opacity-60" : "hover:bg-primary-dark"}`}>
        {busy ? "🔎 Lendo a foto..." : "📷 Enviar foto do cardápio"}
        <input
          type="file"
          accept="image/*"
          className="hidden"
          disabled={busy}
          onChange={(e) => onFile(e.target.files?.[0])}
        />
      </label>

      {msg && <p className="mt-3 rounded-lg bg-[var(--surface-2)] p-2.5 text-sm font-semibold">{msg}</p>}

      {drafts.length > 0 && (
        <div className="mt-4">
          <div className="mb-2 text-sm font-semibold">
            {drafts.filter((d) => d.selected).length} de {drafts.length} itens selecionados — revise antes de salvar:
          </div>
          <div className="max-h-96 space-y-2 overflow-y-auto pr-1">
            {drafts.map((d, i) => (
              <div key={i} className={`surface-2 rounded-xl p-2.5 ${d.selected ? "" : "opacity-50"}`}>
                <div className="flex flex-wrap items-center gap-2">
                  <input
                    type="checkbox"
                    checked={d.selected}
                    onChange={(e) => edit(i, { selected: e.target.checked })}
                    className="h-[18px] w-[18px] accent-[var(--primary)]"
                  />
                  <input
                    value={d.name}
                    onChange={(e) => edit(i, { name: e.target.value })}
                    className="surface min-w-40 flex-1 rounded-lg border-2 border-[var(--border)] p-1.5 text-sm font-semibold outline-none focus:border-primary"
                  />
                  <input
                    value={d.price}
                    onChange={(e) => edit(i, { price: e.target.value })}
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="R$"
                    className="surface w-24 rounded-lg border-2 border-[var(--border)] p-1.5 text-sm outline-none focus:border-primary"
                  />
                  <input
                    value={d.category}
                    onChange={(e) => edit(i, { category: e.target.value })}
                    placeholder="Categoria"
                    className="surface w-36 rounded-lg border-2 border-[var(--border)] p-1.5 text-sm outline-none focus:border-primary"
                  />
                </div>
                {d.description && (
                  <input
                    value={d.description}
                    onChange={(e) => edit(i, { description: e.target.value })}
                    className="surface mt-1.5 w-full rounded-lg border-2 border-[var(--border)] p-1.5 text-xs outline-none focus:border-primary"
                  />
                )}
              </div>
            ))}
          </div>
          <button
            onClick={save}
            disabled={saving || drafts.every((d) => !d.selected)}
            className="mt-3 rounded-xl bg-green-600 px-5 py-2.5 text-sm font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
          >
            {saving ? "Salvando..." : "💾 Salvar selecionados"}
          </button>
        </div>
      )}
    </section>
  );
}
