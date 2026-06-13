"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import { BADGES } from "@/lib/constants";
import type { Category, Product } from "@/lib/types";
import ImageUpload from "./ImageUpload";

interface VarRow { name: string; price: string }
interface OptRow { name: string; price: string }
interface GroupRow { name: string; min: string; max: string; options: OptRow[] }

interface EditorState {
  id: string | null;
  name: string;
  description: string;
  price: string;
  promo_price: string;
  image: string;
  category_id: string;
  available: boolean;
  badges: string[];
  variations: VarRow[];
  addonGroups: GroupRow[];
}

const BADGE_KEYS = Object.keys(BADGES);

function emptyEditor(): EditorState {
  return {
    id: null, name: "", description: "", price: "", promo_price: "", image: "",
    category_id: "", available: true, badges: [], variations: [], addonGroups: [],
  };
}

export default function ProductsManager({
  storeId,
  initialProducts,
  categories,
}: {
  storeId: string;
  initialProducts: Product[];
  categories: Category[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const catName = (id: string | null) => categories.find((c) => c.id === id)?.name ?? "Outros";

  function openNew() {
    setError("");
    setEditor(emptyEditor());
  }

  function openEdit(p: Product) {
    setError("");
    setEditor({
      id: p.id,
      name: p.name,
      description: p.description,
      price: String(p.price),
      promo_price: p.promo_price != null ? String(p.promo_price) : "",
      image: p.image,
      category_id: p.category_id ?? "",
      available: p.available,
      badges: [...p.badges],
      variations: p.variations.map((v) => ({ name: v.name, price: String(v.price) })),
      addonGroups: p.addon_groups.map((g) => ({
        name: g.name,
        min: String(g.min),
        max: String(g.max),
        options: g.options.map((o) => ({ name: o.name, price: String(o.price) })),
      })),
    });
  }

  function upd(patch: Partial<EditorState>) {
    setEditor((e) => (e ? { ...e, ...patch } : e));
  }

  async function save() {
    if (!editor) return;
    setError("");
    const price = parseFloat(editor.price);
    if (!editor.name.trim()) return setError("Informe o nome do produto.");
    if (!Number.isFinite(price) || price < 0) return setError("Preço inválido.");

    let promo: number | null = null;
    if (editor.promo_price !== "") {
      promo = parseFloat(editor.promo_price);
      if (!Number.isFinite(promo) || promo <= 0) return setError("Preço promocional inválido.");
      if (promo >= price) return setError("O preço promocional deve ser menor que o normal.");
    }

    const variations = editor.variations
      .map((v) => ({ name: v.name.trim(), price: parseFloat(v.price) }))
      .filter((v) => v.name !== "");
    if (variations.some((v) => !Number.isFinite(v.price) || v.price < 0))
      return setError("Toda variação precisa de um preço válido.");

    const addon_groups = editor.addonGroups
      .map((g) => ({
        name: g.name.trim() || "Adicionais",
        min: Math.max(0, parseInt(g.min, 10) || 0),
        max: Math.max(0, parseInt(g.max, 10) || 0),
        options: g.options
          .map((o) => ({ name: o.name.trim(), price: parseFloat(o.price) || 0 }))
          .filter((o) => o.name !== ""),
      }))
      .filter((g) => g.options.length > 0);
    for (const g of addon_groups) {
      if (g.max > 0 && g.min > g.max) return setError(`No grupo "${g.name}", o mínimo não pode ser maior que o máximo.`);
    }

    const payload = {
      store_id: storeId,
      category_id: editor.category_id || null,
      name: editor.name.trim(),
      description: editor.description.trim(),
      price,
      promo_price: promo,
      image: editor.image.trim(),
      available: editor.available,
      badges: editor.badges,
      variations,
      addon_groups,
    };

    setBusy(true);
    const res = editor.id
      ? await supabase.from("products").update(payload).eq("id", editor.id)
      : await supabase.from("products").insert({ ...payload, position: initialProducts.length });
    setBusy(false);

    if (res.error) return setError("Não foi possível salvar o produto.");
    setEditor(null);
    router.refresh();
  }

  async function toggle(p: Product) {
    await supabase.from("products").update({ available: !p.available }).eq("id", p.id);
    router.refresh();
  }

  async function remove(p: Product) {
    if (!confirm(`Excluir "${p.name}"?`)) return;
    await supabase.from("products").delete().eq("id", p.id);
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🍕 Produtos</h2>
        <button onClick={openNew} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          ➕ Adicionar produto
        </button>
      </div>

      {initialProducts.length === 0 ? (
        <p className="text-sm text-muted">Nenhum produto cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {initialProducts.map((p) => (
            <div key={p.id} className={`surface-2 flex items-center gap-3 rounded-lg p-2.5 ${p.available ? "" : "opacity-50"}`}>
              {p.image && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.image} alt={p.name} className="h-12 w-12 shrink-0 rounded object-cover" />
              )}
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">{p.name}</div>
                <div className="text-xs text-muted">
                  📂 {catName(p.category_id)} ·{" "}
                  {p.variations.length ? `a partir de ${brl(Math.min(...p.variations.map((v) => v.price)))}` : brl(p.promo_price ?? p.price)}
                </div>
              </div>
              <button onClick={() => toggle(p)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title={p.available ? "Desativar" : "Ativar"}>{p.available ? "👁️" : "🚫"}</button>
              <button onClick={() => openEdit(p)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Editar">✏️</button>
              <button onClick={() => remove(p)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Excluir">🗑️</button>
            </div>
          ))}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={(e) => e.target === e.currentTarget && setEditor(null)}>
          <div className="surface flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
              <h3 className="text-lg font-bold">{editor.id ? "Editar produto" : "Novo produto"}</h3>
              <button onClick={() => setEditor(null)} aria-label="Fechar" className="text-2xl text-muted">✕</button>
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              <Field label="Nome *"><input className={inp} value={editor.name} onChange={(e) => upd({ name: e.target.value })} /></Field>
              <Field label="Descrição"><textarea className={inp} rows={2} value={editor.description} onChange={(e) => upd({ description: e.target.value })} /></Field>
              <Field label="Categoria">
                <select className={inp} value={editor.category_id} onChange={(e) => upd({ category_id: e.target.value })}>
                  <option value="">Sem categoria (Outros)</option>
                  {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </Field>
              <div className="flex gap-2">
                <Field label="Preço R$ *"><input type="number" step="0.01" min="0" className={inp} value={editor.price} onChange={(e) => upd({ price: e.target.value })} /></Field>
                <Field label="Promo R$"><input type="number" step="0.01" min="0" className={inp} value={editor.promo_price} onChange={(e) => upd({ promo_price: e.target.value })} /></Field>
              </div>
              <Field label="Imagem"><ImageUpload value={editor.image} onChange={(url) => upd({ image: url })} storeId={storeId} /></Field>

              <Field label="Selos">
                <div className="flex flex-wrap gap-3">
                  {BADGE_KEYS.map((b) => (
                    <label key={b} className="flex items-center gap-1.5 text-sm">
                      <input type="checkbox" className="accent-[var(--primary)]" checked={editor.badges.includes(b)}
                        onChange={(e) => upd({ badges: e.target.checked ? [...editor.badges, b] : editor.badges.filter((x) => x !== b) })} />
                      {BADGES[b].label}
                    </label>
                  ))}
                </div>
              </Field>

              {/* Variações */}
              <Field label="Variações de tamanho (opcional)">
                {editor.variations.map((v, i) => (
                  <div key={i} className="mb-1.5 flex gap-2">
                    <input className={inp} placeholder="Nome (ex: Grande)" value={v.name} onChange={(e) => upd({ variations: editor.variations.map((x, j) => j === i ? { ...x, name: e.target.value } : x) })} />
                    <input type="number" step="0.01" className={`${inp} w-28`} placeholder="Preço" value={v.price} onChange={(e) => upd({ variations: editor.variations.map((x, j) => j === i ? { ...x, price: e.target.value } : x) })} />
                    <button onClick={() => upd({ variations: editor.variations.filter((_, j) => j !== i) })} className="shrink-0 rounded bg-red-100 px-2 text-red-600">🗑️</button>
                  </div>
                ))}
                <button onClick={() => upd({ variations: [...editor.variations, { name: "", price: "" }] })} className={miniBtn}>➕ Variação</button>
              </Field>

              {/* Grupos de adicionais */}
              <Field label="Grupos de adicionais (opcional)">
                {editor.addonGroups.map((g, gi) => (
                  <div key={gi} className="mb-2 rounded-lg border-2 border-[var(--border)] p-2">
                    <div className="mb-1.5 flex gap-2">
                      <input className={inp} placeholder="Nome do grupo" value={g.name} onChange={(e) => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, name: e.target.value } : x) })} />
                      <input type="number" className={`${inp} w-16`} placeholder="Mín" value={g.min} onChange={(e) => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, min: e.target.value } : x) })} />
                      <input type="number" className={`${inp} w-16`} placeholder="Máx" value={g.max} onChange={(e) => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, max: e.target.value } : x) })} />
                      <button onClick={() => upd({ addonGroups: editor.addonGroups.filter((_, j) => j !== gi) })} className="shrink-0 rounded bg-red-100 px-2 text-red-600">🗑️</button>
                    </div>
                    {g.options.map((o, oi) => (
                      <div key={oi} className="mb-1 flex gap-2 pl-3">
                        <input className={inp} placeholder="Opção" value={o.name} onChange={(e) => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, name: e.target.value } : y) } : x) })} />
                        <input type="number" step="0.01" className={`${inp} w-24`} placeholder="+ R$" value={o.price} onChange={(e) => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, options: x.options.map((y, k) => k === oi ? { ...y, price: e.target.value } : y) } : x) })} />
                        <button onClick={() => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, options: x.options.filter((_, k) => k !== oi) } : x) })} className="shrink-0 rounded bg-red-100 px-2 text-red-600">🗑️</button>
                      </div>
                    ))}
                    <button onClick={() => upd({ addonGroups: editor.addonGroups.map((x, j) => j === gi ? { ...x, options: [...x.options, { name: "", price: "" }] } : x) })} className={`${miniBtn} ml-3`}>➕ Opção</button>
                  </div>
                ))}
                <button onClick={() => upd({ addonGroups: [...editor.addonGroups, { name: "", min: "0", max: "0", options: [{ name: "", price: "" }] }] })} className={miniBtn}>➕ Grupo de adicionais</button>
              </Field>

              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--primary)]" checked={editor.available} onChange={(e) => upd({ available: e.target.checked })} />
                Produto disponível
              </label>

              {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-600">{error}</p>}
            </div>

            <div className="border-t border-[var(--border)] p-4">
              <button onClick={save} disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-60">
                {busy ? "Salvando..." : "💾 Salvar produto"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";
const miniBtn = "rounded-lg border-2 border-dashed border-[var(--border)] px-3 py-1 text-xs font-semibold text-muted hover:border-primary hover:text-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}
