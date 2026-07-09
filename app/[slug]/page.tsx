import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, DeliveryZone, Product, Store, StoreRating } from "@/lib/types";
import SetupNotice from "@/components/SetupNotice";
import StoreClient from "@/components/store/StoreClient";

async function loadStore(slug: string) {
  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("*")
    .eq("slug", slug)
    .maybeSingle();
  if (!store) return null;

  const [{ data: products }, { data: categories }, { data: zones }, { data: rating }] =
    await Promise.all([
      supabase.from("products").select("*").eq("store_id", store.id).order("position"),
      supabase.from("categories").select("*").eq("store_id", store.id).order("position"),
      supabase.from("delivery_zones").select("*").eq("store_id", store.id),
      supabase.rpc("store_rating", { p_store: store.id }),
    ]);

  return {
    store: store as Store,
    products: (products ?? []) as Product[],
    categories: (categories ?? []) as Category[],
    zones: (zones ?? []) as DeliveryZone[],
    rating: (rating ?? { avg: 0, count: 0 }) as StoreRating,
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
  if (!data) return { title: "Loja não encontrada" };

  const title = `${data.store.name} — Delivery`;
  const description = data.store.settings?.subtitle ?? "Peça delivery de forma rápida e fácil.";
  return {
    title,
    description,
    openGraph: { title, description, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  };
}

export default async function StorePage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ mesa?: string }>;
}) {
  const { slug } = await params;
  const { mesa } = await searchParams;
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

  // Estrito: só bloqueia quando explicitamente suspensa (antes da migration 0008
  // a coluna `active` não existe e vem undefined — não deve bloquear).
  if (data.store.active === false) {
    return (
      <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🚧</div>
        <h1 className="text-2xl font-bold">Loja temporariamente indisponível</h1>
        <p className="text-muted">Esta loja não está aceitando pedidos no momento.</p>
      </main>
    );
  }

  const tableNumber = (mesa ?? "").replace(/\D/g, "").slice(0, 4);

  return (
    <StoreClient
      store={data.store}
      products={data.products}
      categories={data.categories}
      zones={data.zones}
      rating={data.rating}
      initialTable={tableNumber || undefined}
    />
  );
}
