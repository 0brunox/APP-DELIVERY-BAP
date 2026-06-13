import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { Category, Product } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import CategoriesManager from "@/components/admin/CategoriesManager";
import ProductsManager from "@/components/admin/ProductsManager";

export const dynamic = "force-dynamic";

export default async function CardapioPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const [{ data: categories }, { data: products }] = await Promise.all([
    supabase.from("categories").select("*").eq("store_id", store.id).order("position"),
    supabase.from("products").select("*").eq("store_id", store.id).order("position"),
  ]);

  return (
    <div className="space-y-8">
      <CategoriesManager storeId={store.id} initialCategories={(categories ?? []) as Category[]} />
      <ProductsManager
        storeId={store.id}
        initialProducts={(products ?? []) as Product[]}
        categories={(categories ?? []) as Category[]}
      />
    </div>
  );
}
