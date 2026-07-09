"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DEFAULT_SETTINGS = {
  subtitle: "Delivery rápido e saboroso! Peça agora.",
  deliveryFee: 6,
  minOrderValue: 0,
  orderTypes: { delivery: true, pickup: true, dinein: false },
  paymentMethods: { pix: true, credit: true, debit: true },
  enableScheduling: false,
  theme: { primary: "#f59e0b", secondary: "#fbbf24", font: "Poppins", heroBanner: "" },
};

function slugify(s: string) {
  return s
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export default function CreateStoreForm() {
  const router = useRouter();
  const supabase = createClient();
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    const finalSlug = slug.trim() || slugify(name);
    if (!name.trim()) return setError("Informe o nome da loja.");
    if (!finalSlug) return setError("Informe um endereço (slug) válido.");

    setLoading(true);
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error: insertError } = await supabase.from("stores").insert({
      owner: user!.id,
      slug: finalSlug,
      name: name.trim(),
      settings: DEFAULT_SETTINGS,
    });
    setLoading(false);

    if (insertError) {
      setError(
        insertError.code === "23505"
          ? "Esse endereço (slug) já está em uso. Escolha outro."
          : "Não foi possível criar a loja. Tente novamente."
      );
      return;
    }
    router.refresh();
  }

  return (
    <div className="mx-auto max-w-md">
      <div className="mb-6 text-center">
        <div className="mb-2 text-5xl">🏪</div>
        <h1 className="text-2xl font-bold">Crie sua loja</h1>
        <p className="text-sm text-muted">Em segundos sua loja estará no ar com link próprio.</p>
      </div>

      <form onSubmit={handleSubmit} className="surface bordered rounded-2xl p-6">
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
        <p className="mb-4 mt-1 text-xs text-muted">Seu cardápio ficará em /{slug || "sua-loja"}</p>

        {error && <p className="mb-3 rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
        >
          {loading ? "Criando..." : "Criar loja"}
        </button>
      </form>
    </div>
  );
}
