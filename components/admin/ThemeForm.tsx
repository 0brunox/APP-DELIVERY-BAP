"use client";

import { useState, type CSSProperties } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { darkenColor } from "@/lib/format";
import type { Store, StoreSettings } from "@/lib/types";

const FONTS = ["Poppins", "Inter", "Montserrat"];

export default function ThemeForm({ store }: { store: Store }) {
  const router = useRouter();
  const supabase = createClient();
  const t = store.settings?.theme;

  const [primary, setPrimary] = useState(t?.primary ?? "#f59e0b");
  const [secondary, setSecondary] = useState(t?.secondary ?? "#fbbf24");
  const [font, setFont] = useState(t?.font ?? "Poppins");
  const [heroBanner, setHeroBanner] = useState(t?.heroBanner ?? "");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const isHex = (v: string) => /^#[0-9a-f]{6}$/i.test(v);

  async function save() {
    setMsg(null);
    if (!isHex(primary) || !isHex(secondary)) return setMsg({ type: "err", text: "Cores devem estar no formato #RRGGBB." });

    const settings: StoreSettings = {
      ...(store.settings ?? {}),
      theme: { primary, secondary, font, heroBanner: heroBanner.trim() },
    };
    setSaving(true);
    const { error } = await supabase.from("stores").update({ settings }).eq("id", store.id);
    setSaving(false);
    if (error) return setMsg({ type: "err", text: "Não foi possível salvar." });
    setMsg({ type: "ok", text: "Tema salvo!" });
    router.refresh();
  }

  function reset() {
    setPrimary("#f59e0b");
    setSecondary("#fbbf24");
    setFont("Poppins");
    setHeroBanner("");
  }

  const previewStyle = {
    "--primary": primary,
    "--primary-dark": darkenColor(primary),
    fontFamily: `'${font}', sans-serif`,
  } as CSSProperties;

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-4 text-lg font-bold">🎨 Aparência</h2>

      <div className="grid gap-6 md:grid-cols-2">
        <div className="space-y-3">
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Cor primária</label>
            <div className="flex items-center gap-2">
              <input type="color" value={primary} onChange={(e) => setPrimary(e.target.value)} className="h-10 w-12 cursor-pointer rounded border-2 border-[var(--border)] p-0.5" />
              <input value={primary} onChange={(e) => setPrimary(e.target.value)} className={`${inp} font-mono`} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Cor secundária</label>
            <div className="flex items-center gap-2">
              <input type="color" value={secondary} onChange={(e) => setSecondary(e.target.value)} className="h-10 w-12 cursor-pointer rounded border-2 border-[var(--border)] p-0.5" />
              <input value={secondary} onChange={(e) => setSecondary(e.target.value)} className={`${inp} font-mono`} />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Fonte</label>
            <div className="flex gap-2">
              {FONTS.map((f) => (
                <button
                  key={f}
                  onClick={() => setFont(f)}
                  style={{ fontFamily: `'${f}', sans-serif` }}
                  className={`flex-1 rounded-lg border-2 py-2 text-sm font-semibold transition ${
                    font === f ? "border-primary bg-[var(--surface-2)] text-primary" : "border-[var(--border)] text-muted"
                  }`}
                >
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">Banner do hero (opcional)</label>
            <input value={heroBanner} onChange={(e) => setHeroBanner(e.target.value)} placeholder="https://..." className={inp} />
            <p className="mt-1 text-xs text-muted">Vazio = usa o gradiente das cores.</p>
          </div>
        </div>

        {/* Preview */}
        <div style={previewStyle}>
          <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">Pré-visualização</div>
          <div className="overflow-hidden rounded-xl border border-[var(--border)]">
            <div
              className="p-5 text-white"
              style={
                heroBanner.trim()
                  ? { backgroundImage: `linear-gradient(135deg, rgba(0,0,0,.45), rgba(0,0,0,.25)), url('${heroBanner}')`, backgroundSize: "cover", backgroundPosition: "center" }
                  : { background: `linear-gradient(135deg, ${primary}, ${secondary})` }
              }
            >
              <div className="text-lg font-bold">{store.name}</div>
              <div className="text-sm opacity-90">Delivery rápido e saboroso!</div>
            </div>
            <div className="surface p-4">
              <div className="mb-2 font-semibold">Pizza Margherita</div>
              <button className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark">
                + Adicionar
              </button>
            </div>
          </div>
        </div>
      </div>

      {msg && <p className={`mt-4 rounded-lg p-2.5 text-sm font-semibold ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>}

      <div className="mt-4 flex gap-2">
        <button onClick={save} disabled={saving} className="rounded-xl bg-primary px-6 py-3 font-semibold text-white disabled:opacity-60">
          {saving ? "Salvando..." : "💾 Salvar tema"}
        </button>
        <button onClick={reset} className="rounded-xl border-2 border-[var(--border)] px-4 py-3 font-semibold text-muted hover:border-primary hover:text-primary">
          ↺ Padrão
        </button>
      </div>
    </section>
  );
}

const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";
