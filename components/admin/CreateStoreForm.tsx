"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import ImageUpload from "./ImageUpload";

const PRESET_COLORS = ["#f59e0b", "#ef4444", "#10b981", "#3b82f6", "#8b5cf6", "#ec4899", "#0ea5e9", "#111827"];

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

/** Wizard de primeira configuração: nome/endereço → visual → primeiro produto. */
export default function CreateStoreForm() {
  const router = useRouter();
  const supabase = createClient();
  const [step, setStep] = useState(1);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Passo 1
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [whatsapp, setWhatsapp] = useState("");
  // Passo 2
  const [primary, setPrimary] = useState("#f59e0b");
  const [logoUrl, setLogoUrl] = useState("");
  // Passo 3
  const [prodName, setProdName] = useState("");
  const [prodPrice, setProdPrice] = useState("");

  const finalSlug = slug.trim() || slugify(name);

  function next() {
    setError("");
    if (step === 1) {
      if (!name.trim()) return setError("Informe o nome da loja.");
      if (!finalSlug) return setError("Informe um endereço (slug) válido.");
    }
    setStep((s) => s + 1);
  }

  async function finish() {
    setError("");
    setLoading(true);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    const settings = {
      subtitle: "Delivery rápido e saboroso! Peça agora.",
      whatsappNumber: whatsapp.replace(/\D/g, ""),
      logoUrl: logoUrl.trim(),
      deliveryFee: 6,
      minOrderValue: 0,
      orderTypes: { delivery: true, pickup: true, dinein: false },
      paymentMethods: { pix: true, credit: true, debit: true },
      enableScheduling: false,
      theme: { primary, secondary: primary, font: "Poppins", heroBanner: "" },
    };

    const { data: store, error: insertError } = await supabase
      .from("stores")
      .insert({ owner: user!.id, slug: finalSlug, name: name.trim(), settings })
      .select("id")
      .single();

    if (insertError) {
      setLoading(false);
      setError(
        insertError.code === "23505"
          ? "Esse endereço (slug) já está em uso. Escolha outro."
          : "Não foi possível criar a loja. Tente novamente."
      );
      return;
    }

    // Primeiro produto (opcional)
    const price = parseFloat(prodPrice);
    if (store && prodName.trim() && Number.isFinite(price) && price >= 0) {
      await supabase.from("products").insert({
        store_id: store.id,
        name: prodName.trim(),
        price,
        available: true,
      });
    }

    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <div className="mb-2 text-5xl">🏪</div>
        <h1 className="text-2xl font-bold">Crie sua loja</h1>
        <p className="text-sm text-muted">Passo {step} de 3 — leva menos de 2 minutos.</p>
      </div>

      <div className="mb-4 flex gap-1.5">
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 flex-1 rounded-full ${n <= step ? "bg-primary" : "bg-[var(--surface-2)]"}`} />
        ))}
      </div>

      <div className="surface bordered rounded-2xl p-6">
        {step === 1 && (
          <>
            <label className="mb-1 block text-sm font-semibold">Nome da loja</label>
            <input
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
              placeholder="Ex: Sabor Express"
              className="surface mb-4 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
            />

            <label className="mb-1 block text-sm font-semibold">Endereço da loja</label>
            <div className="flex items-center gap-1 rounded-lg border-2 border-[var(--border)] px-2.5 focus-within:border-primary">
              <span className="text-sm text-muted">/</span>
              <input
                value={slug}
                onChange={(e) => {
                  setSlugTouched(true);
                  setSlug(slugify(e.target.value));
                }}
                placeholder="sua-loja"
                className="surface w-full bg-transparent py-2.5 text-sm outline-none"
              />
            </div>
            <p className="mb-4 mt-1 text-xs text-muted">Seu cardápio ficará em /{finalSlug || "sua-loja"}</p>

            <label className="mb-1 block text-sm font-semibold">WhatsApp (opcional)</label>
            <input
              value={whatsapp}
              onChange={(e) => setWhatsapp(e.target.value)}
              placeholder="Ex: 21999998888"
              type="tel"
              className="surface w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
            />
          </>
        )}

        {step === 2 && (
          <>
            <label className="mb-2 block text-sm font-semibold">Cor da sua marca</label>
            <div className="mb-4 flex flex-wrap gap-2">
              {PRESET_COLORS.map((c) => (
                <button
                  key={c}
                  onClick={() => setPrimary(c)}
                  aria-label={`Cor ${c}`}
                  className={`h-9 w-9 rounded-full border-2 transition ${primary === c ? "border-[var(--text)] scale-110" : "border-transparent"}`}
                  style={{ background: c }}
                />
              ))}
              <input
                type="color"
                value={primary}
                onChange={(e) => setPrimary(e.target.value)}
                className="h-9 w-9 cursor-pointer rounded-full border-2 border-[var(--border)]"
                aria-label="Cor personalizada"
              />
            </div>

            <label className="mb-1 block text-sm font-semibold">Logo (opcional)</label>
            <ImageUpload value={logoUrl} onChange={setLogoUrl} storeId="onboarding" />

            <div className="mt-4 rounded-xl p-4 text-center text-white" style={{ background: primary }}>
              <div className="text-lg font-bold">{name || "Sua Loja"}</div>
              <div className="text-sm opacity-90">Prévia da sua marca</div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <p className="mb-3 text-sm text-muted">
              Cadastre seu primeiro produto para já sair com a loja no ar. Você adiciona mais depois. (Opcional)
            </p>
            <label className="mb-1 block text-sm font-semibold">Nome do produto</label>
            <input
              value={prodName}
              onChange={(e) => setProdName(e.target.value)}
              placeholder="Ex: X-Burger"
              className="surface mb-4 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
            />
            <label className="mb-1 block text-sm font-semibold">Preço (R$)</label>
            <input
              value={prodPrice}
              onChange={(e) => setProdPrice(e.target.value)}
              placeholder="Ex: 29.90"
              type="number"
              step="0.01"
              min="0"
              className="surface w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
            />
          </>
        )}

        {error && <p className="mt-4 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}

        <div className="mt-5 flex gap-2">
          {step > 1 && (
            <button
              onClick={() => {
                setError("");
                setStep((s) => s - 1);
              }}
              className="rounded-xl border-2 border-[var(--border)] px-4 py-3 font-semibold text-muted transition hover:border-primary hover:text-primary"
            >
              Voltar
            </button>
          )}
          {step < 3 ? (
            <button
              onClick={next}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark"
            >
              Continuar →
            </button>
          ) : (
            <button
              onClick={finish}
              disabled={loading}
              className="flex-1 rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              {loading ? "Criando..." : "🚀 Criar loja"}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
