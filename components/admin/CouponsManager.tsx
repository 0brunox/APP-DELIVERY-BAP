"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import type { Coupon } from "@/lib/types";

interface EditorState {
  id: string | null;
  code: string;
  type: "percent" | "fixed";
  value: string;
  min_order: string;
  expiry: string;
  max_uses: string;
  active: boolean;
}

function emptyEditor(): EditorState {
  return { id: null, code: "", type: "percent", value: "", min_order: "", expiry: "", max_uses: "", active: true };
}

export default function CouponsManager({
  storeId,
  initialCoupons,
}: {
  storeId: string;
  initialCoupons: Coupon[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  function openEdit(c: Coupon) {
    setError("");
    setEditor({
      id: c.id,
      code: c.code,
      type: c.type,
      value: String(c.value),
      min_order: c.min_order ? String(c.min_order) : "",
      expiry: c.expiry ?? "",
      max_uses: c.max_uses ? String(c.max_uses) : "",
      active: c.active,
    });
  }

  async function save() {
    if (!editor) return;
    setError("");
    const code = editor.code.trim().toUpperCase();
    if (!code) return setError("Informe o código.");
    const value = parseFloat(editor.value);
    if (!Number.isFinite(value) || value <= 0) return setError("Valor do desconto inválido.");
    if (editor.type === "percent" && value > 100) return setError("Percentual não pode passar de 100%.");

    const payload = {
      store_id: storeId,
      code,
      type: editor.type,
      value,
      min_order: parseFloat(editor.min_order) || 0,
      expiry: editor.expiry || null,
      max_uses: parseInt(editor.max_uses, 10) || 0,
      active: editor.active,
    };

    setBusy(true);
    const res = editor.id
      ? await supabase.from("coupons").update(payload).eq("id", editor.id)
      : await supabase.from("coupons").insert({ ...payload, uses: 0 });
    setBusy(false);

    if (res.error) {
      setError(res.error.code === "23505" ? "Já existe um cupom com esse código." : "Não foi possível salvar.");
      return;
    }
    setEditor(null);
    router.refresh();
  }

  async function toggle(c: Coupon) {
    await supabase.from("coupons").update({ active: !c.active }).eq("id", c.id);
    router.refresh();
  }

  async function remove(c: Coupon) {
    if (!confirm(`Excluir o cupom "${c.code}"?`)) return;
    await supabase.from("coupons").delete().eq("id", c.id);
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-lg font-bold">🎟️ Cupons de desconto</h2>
        <button onClick={() => { setError(""); setEditor(emptyEditor()); }} className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white">
          ➕ Adicionar
        </button>
      </div>

      {initialCoupons.length === 0 ? (
        <p className="text-sm text-muted">Nenhum cupom cadastrado.</p>
      ) : (
        <div className="space-y-2">
          {initialCoupons.map((c) => {
            const meta = [];
            if (c.min_order > 0) meta.push(`mín. ${brl(c.min_order)}`);
            if (c.expiry) meta.push(`até ${c.expiry.split("-").reverse().join("/")}`);
            meta.push(c.max_uses > 0 ? `${c.uses}/${c.max_uses} usos` : `${c.uses} usos`);
            return (
              <div key={c.id} className={`surface-2 flex items-center gap-2 rounded-lg p-2.5 ${c.active ? "" : "opacity-50"}`}>
                <div className="flex-1">
                  <span className="font-mono font-bold">{c.code}</span> ·{" "}
                  {c.type === "percent" ? `${c.value}% off` : `${brl(c.value)} off`}
                  <div className="text-xs text-muted">{meta.join(" · ")}</div>
                </div>
                <button onClick={() => toggle(c)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title={c.active ? "Desativar" : "Ativar"}>{c.active ? "👁️" : "🚫"}</button>
                <button onClick={() => openEdit(c)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Editar">✏️</button>
                <button onClick={() => remove(c)} className="rounded px-2 py-1 text-xs hover:bg-[var(--surface)]" title="Excluir">🗑️</button>
              </div>
            );
          })}
        </div>
      )}

      {editor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4" onClick={(e) => e.target === e.currentTarget && setEditor(null)}>
          <div className="surface w-full max-w-sm rounded-2xl p-5">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="text-lg font-bold">{editor.id ? "Editar cupom" : "Novo cupom"}</h3>
              <button onClick={() => setEditor(null)} aria-label="Fechar" className="text-2xl text-muted">✕</button>
            </div>
            <div className="space-y-3">
              <Field label="Código *"><input className={`${inp} uppercase`} value={editor.code} onChange={(e) => setEditor({ ...editor, code: e.target.value })} placeholder="BEMVINDO10" /></Field>
              <div className="flex gap-2">
                <Field label="Tipo">
                  <select className={inp} value={editor.type} onChange={(e) => setEditor({ ...editor, type: e.target.value as "percent" | "fixed" })}>
                    <option value="percent">Percentual (%)</option>
                    <option value="fixed">Valor fixo (R$)</option>
                  </select>
                </Field>
                <Field label="Valor *"><input type="number" step="0.01" min="0" className={inp} value={editor.value} onChange={(e) => setEditor({ ...editor, value: e.target.value })} /></Field>
              </div>
              <div className="flex gap-2">
                <Field label="Pedido mínimo R$"><input type="number" step="0.01" min="0" className={inp} value={editor.min_order} onChange={(e) => setEditor({ ...editor, min_order: e.target.value })} /></Field>
                <Field label="Limite de usos"><input type="number" min="0" step="1" className={inp} value={editor.max_uses} onChange={(e) => setEditor({ ...editor, max_uses: e.target.value })} placeholder="0 = ilimitado" /></Field>
              </div>
              <Field label="Validade (opcional)"><input type="date" className={inp} value={editor.expiry} onChange={(e) => setEditor({ ...editor, expiry: e.target.value })} /></Field>
              <label className="flex items-center gap-2 text-sm font-semibold">
                <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--primary)]" checked={editor.active} onChange={(e) => setEditor({ ...editor, active: e.target.checked })} />
                Cupom ativo
              </label>
              {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-600">{error}</p>}
              <button onClick={save} disabled={busy} className="w-full rounded-xl bg-primary py-3 font-semibold text-white disabled:opacity-60">
                {busy ? "Salvando..." : "💾 Salvar cupom"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex-1">
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}
