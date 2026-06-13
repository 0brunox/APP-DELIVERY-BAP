import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import type { Category, Product, Store } from "@/lib/types";
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

  return (
    <StoreClient store={data.store} products={data.products} categories={data.categories} />
  );
}
