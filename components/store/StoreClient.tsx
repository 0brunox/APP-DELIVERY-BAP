"use client";

import { useMemo, useState, type CSSProperties } from "react";
import type { Category, DeliveryZone, Product, Store } from "@/lib/types";
import { darkenColor, normalizeText } from "@/lib/format";
import { CartProvider, useCart } from "./CartContext";
import ProductCard from "./ProductCard";
import ProductDetailModal from "./ProductDetailModal";
import CartSidebar from "./CartSidebar";
import CheckoutModal from "./CheckoutModal";

export default function StoreClient({
  store,
  products,
  categories,
  zones,
}: {
  store: Store;
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
}) {
  const theme = store.settings?.theme;
  const themeStyle = {
    "--primary": theme?.primary ?? "#f59e0b",
    "--primary-dark": darkenColor(theme?.primary ?? "#f59e0b"),
    "--secondary": theme?.secondary ?? "#fbbf24",
    "--font": `'${theme?.font ?? "Poppins"}', sans-serif`,
  } as CSSProperties;

  return (
    <CartProvider storeSlug={store.slug}>
      <div style={themeStyle}>
        <StoreInner store={store} products={products} categories={categories} zones={zones} />
      </div>
    </CartProvider>
  );
}

function StoreInner({
  store,
  products,
  categories,
  zones,
}: {
  store: Store;
  products: Product[];
  categories: Category[];
  zones: DeliveryZone[];
}) {
  const { count } = useCart();
  const heroBanner = store.settings?.theme?.heroBanner?.trim();
  const [search, setSearch] = useState("");
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [detail, setDetail] = useState<Product | null>(null);
  const [cartOpen, setCartOpen] = useState(false);
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  // Agrupa produtos por categoria ativa (+ "Outros"); aplica busca
  const groups = useMemo(() => {
    const term = search.trim() ? normalizeText(search) : "";
    const matches = (p: Product) =>
      !term ||
      normalizeText(p.name).includes(term) ||
      normalizeText(p.description).includes(term);

    const activeCats = categories.filter((c) => c.active).sort((a, b) => a.position - b.position);
    const knownIds = new Set(categories.map((c) => c.id));
    const result = activeCats
      .map((c) => ({ id: c.id, name: c.name, items: products.filter((p) => p.category_id === c.id && matches(p)) }))
      .filter((g) => g.items.length > 0);
    const others = products.filter((p) => (!p.category_id || !knownIds.has(p.category_id)) && matches(p));
    if (others.length) result.push({ id: "others", name: "Outros", items: others });
    return result;
  }, [products, categories, search]);

  const chips = useMemo(
    () => [{ id: "all", name: "Todos" }, ...groups.map((g) => ({ id: g.id, name: g.name }))],
    [groups]
  );

  const searching = search.trim() !== "";
  const visibleGroups = searching || selectedCat === "all" ? groups : groups.filter((g) => g.id === selectedCat);

  function handleCheckout() {
    setCartOpen(false);
    setCheckoutOpen(true);
  }

  return (
    <>
      {/* Header */}
      <header className="surface sticky top-0 z-30 border-b border-[var(--border)]">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-5 py-3.5">
          <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-primary text-xl text-white">
            {store.settings?.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={store.settings.logoUrl} alt={store.name} className="h-full w-full object-cover" />
            ) : (
              "🍕"
            )}
          </div>
          <span className="flex-1 text-lg font-bold text-primary">{store.name}</span>
          <button
            onClick={() => setCartOpen(true)}
            aria-label="Abrir carrinho"
            className="surface-2 relative flex h-11 w-11 items-center justify-center rounded-full text-xl transition hover:bg-primary hover:text-white"
          >
            🛒
            {count > 0 && (
              <span className="absolute -right-1 -top-1 flex h-5 w-5 items-center justify-center rounded-full bg-red-500 text-xs font-bold text-white">
                {count}
              </span>
            )}
          </button>
        </div>
      </header>

      {/* Hero */}
      <section
        className="px-5 py-12 text-white"
        style={
          heroBanner
            ? {
                backgroundImage: `linear-gradient(135deg, rgba(0,0,0,.45), rgba(0,0,0,.25)), url('${heroBanner}')`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
            : { background: "linear-gradient(135deg, var(--primary), var(--secondary))" }
        }
      >
        <div className="mx-auto max-w-5xl">
          <h1 className="mb-2 text-3xl font-bold sm:text-4xl">{store.name}</h1>
          <p className="max-w-xl opacity-95">
            {store.settings?.subtitle ?? "Delivery rápido e saboroso. Peça agora!"}
          </p>
        </div>
      </section>

      {/* Cardápio */}
      <main className="mx-auto max-w-5xl px-5 py-8">
        {/* Toolbar: busca + categorias */}
        <div className="surface sticky top-[64px] z-20 -mx-5 mb-6 px-5 py-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 Buscar no cardápio..."
            className="surface mx-auto mb-3 block w-full max-w-md rounded-full border-2 border-[var(--border)] px-5 py-2.5 outline-none focus:border-primary"
          />
          {chips.length > 2 && (
            <div className="flex flex-wrap justify-center gap-2">
              {chips.map((c) => (
                <button
                  key={c.id}
                  onClick={() => {
                    setSelectedCat(c.id);
                    setSearch("");
                  }}
                  className={`rounded-full border-2 px-4 py-1.5 text-sm font-semibold transition ${
                    selectedCat === c.id && !searching
                      ? "border-primary bg-primary text-white"
                      : "surface border-[var(--border)] text-muted hover:border-primary hover:text-primary"
                  }`}
                >
                  {c.name}
                </button>
              ))}
            </div>
          )}
        </div>

        {visibleGroups.length === 0 ? (
          <p className="py-10 text-center text-muted">
            Nenhum produto encontrado{searching ? ` para "${search}"` : ""}.
          </p>
        ) : (
          visibleGroups.map((g) => (
            <section key={g.id} className="mb-10">
              <h3 className="mb-4 border-b-2 border-primary pb-1 text-xl font-bold">{g.name}</h3>
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {g.items.map((p) => (
                  <ProductCard key={p.id} product={p} onOpen={setDetail} />
                ))}
              </div>
            </section>
          ))
        )}
      </main>

      <footer className="border-t border-[var(--border)] py-6 text-center text-sm text-muted">
        {store.name} · Powered by Delivery Super App
      </footer>

      {detail && <ProductDetailModal product={detail} onClose={() => setDetail(null)} />}
      <CartSidebar open={cartOpen} onClose={() => setCartOpen(false)} onCheckout={handleCheckout} />
      {checkoutOpen && (
        <CheckoutModal store={store} zones={zones} onClose={() => setCheckoutOpen(false)} />
      )}
    </>
  );
}
