import type { CSSProperties } from "react";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, Product, Store } from "@/lib/types";
import { brl, hasPromo, minPrice, basePrice } from "@/lib/format";
import SetupNotice from "@/components/SetupNotice";

const BADGES: Record<string, { label: string; color: string }> = {
  novo: { label: "Novo", color: "#3b82f6" },
  maisvendido: { label: "Mais vendido", color: "#8b5cf6" },
  promo: { label: "Promoção", color: "#ef4444" },
  vegetariano: { label: "Vegetariano", color: "#10b981" },
};

function darken(hex: string, amount = 0.18): string {
  const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  if (!m) return hex;
  const ch = (c: string) =>
    Math.max(0, Math.round(parseInt(c, 16) * (1 - amount)))
      .toString(16)
      .padStart(2, "0");
  return `#${ch(m[1])}${ch(m[2])}${ch(m[3])}`;
}

async function loadStore(slug: string) {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!store) return null;

  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("*").eq("store_id", store.id).order("position"),
    supabase.from("categories").select("*").eq("store_id", store.id).order("position"),
  ]);

  return {
    store: store as Store,
    products: (products ?? []) as Product[],
    categories: (categories ?? []) as Category[],
  };
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return { title: "Delivery Super App" };
  const data = await loadStore(slug);
  return {
    title: data ? `${data.store.name} — Delivery` : "Loja não encontrada",
    description: data?.store.settings?.subtitle ?? "Peça delivery de forma rápida e fácil.",
  };
}

export default async function StorePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const data = await loadStore(slug);
  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold">Loja não encontrada</h1>
        <p className="text-muted">
          Nenhuma loja com o endereço <strong>/{slug}</strong>. Confira o link ou
          crie sua loja no painel do lojista.
        </p>
      </main>
    );
  }

  const { store, products, categories } = data;
  const theme = store.settings?.theme;
  const themeStyle = {
    "--primary": theme?.primary ?? "#f59e0b",
    "--primary-dark": darken(theme?.primary ?? "#f59e0b"),
    "--secondary": theme?.secondary ?? "#fbbf24",
    "--font": `'${theme?.font ?? "Poppins"}', sans-serif`,
  } as CSSProperties;

  // Agrupa produtos por categoria ativa; sem categoria vai para "Outros"
  const activeCats = categories.filter((c) => c.active).sort((a, b) => a.position - b.position);
  const knownIds = new Set(categories.map((c) => c.id));
  const groups = activeCats
    .map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.category_id === c.id) }))
    .filter((g) => g.items.length > 0);
  const others = products.filter((p) => !p.category_id || !knownIds.has(p.category_id));
  if (others.length) groups.push({ id: "others", name: "Outros", items: others });

  return (
    <div style={themeStyle}>
      {/* Header */}
      <header className="surface bordered sticky top-0 z-10 border-x-0 border-t-0">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-4">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-xl text-white">
            {store.settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.settings.logoUrl} alt={store.name} className="h-full w-full object-cover" />
            ) : (
              "🍕"
            )}
          </div>
          <span className="text-lg font-bold text-primary">{store.name}</span>
        </div>
      </header>

      {/* Hero */}
      <section
        className="px-5 py-12 text-white"
        style={{ background: "linear-gradient(135deg, var(--primary), var(--secondary))" }}
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-2 text-3xl font-bold sm:text-4xl">{store.name}</h1>
          <p className="max-w-xl opacity-95">
            {store.settings?.subtitle ?? "Delivery rápido e saboroso. Peça agora!"}
          </p>
        </div>
      </section>

      {/* Cardápio */}
      <main className="mx-auto max-w-5xl px-5 py-10">
        <h2 className="mb-1 text-center text-2xl font-bold">Nosso Cardápio</h2>
        <p className="mb-8 text-center text-muted">Escolha seus pratos favoritos</p>

        {groups.length === 0 ? (
          <p className="text-center text-muted">Esta loja ainda não cadastrou produtos.</p>
        ) : (
          groups.map((g) => (
            <section key={g.id} className="mb-10">
              <h3 className="mb-4 border-b-2 border-primary pb-1 text-xl font-bold">{g.name}</h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <article key={p.id} className="surface bordered overflow-hidden rounded-2xl">
                    <div className="relative h-44 w-full bg-[var(--surface-2)]">
                      {p.image && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={p.image} alt={p.name} className="h-full w-full object-cover" />
                      )}
                      {p.badges?.length > 0 && (
                        <div className="absolute left-3 top-3 flex flex-col items-start gap-1">
                          {p.badges
                            .filter((b) => BADGES[b])
                            .map((b) => (
                              <span
                                key={b}
                                className="rounded-full px-2 py-0.5 text-[11px] font-semibold text-white"
                                style={{ background: BADGES[b].color }}
                              >
                                {BADGES[b].label}
                              </span>
                            ))}
                        </div>
                      )}
                      {!p.available && (
                        <span className="absolute right-3 top-3 rounded-full bg-red-500 px-2 py-0.5 text-[11px] font-semibold text-white">
                          Esgotado
                        </span>
                      )}
                    </div>
                    <div className="p-4">
                      <h4 className="font-semibold">{p.name}</h4>
                      <p className="mb-3 line-clamp-2 text-sm text-muted">{p.description}</p>
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-bold text-primary">
                          {p.variations.length > 0 ? (
                            <span className="text-sm font-medium text-muted">a partir de </span>
                          ) : null}
                          {hasPromo(p) && (
                            <span className="mr-1 text-sm text-muted line-through">{brl(p.price)}</span>
                          )}
                          {brl(p.variations.length ? minPrice(p) : basePrice(p))}
                        </span>
                        <button
                          className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-50"
                          disabled={!p.available}
                        >
                          {p.available ? "Adicionar" : "Indisponível"}
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          ))
        )}

        <p className="mt-8 rounded-xl border border-dashed border-[var(--border)] p-4 text-center text-sm text-muted">
          🚧 Carrinho e checkout interativos chegam na sub-etapa 6C. Esta é a
          visão pública lendo do banco (sub-etapa 6B).
        </p>
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-muted">
        {store.name} · Powered by Delivery Super App
      </footer>
    </div>
  );
}
