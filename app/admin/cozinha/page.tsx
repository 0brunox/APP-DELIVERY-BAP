import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { AdminOrder } from "@/app/admin/page";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import KitchenBoard from "@/components/admin/KitchenBoard";

export const dynamic = "force-dynamic";

export default async function CozinhaPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", store.id)
    .in("status", ["received", "preparing", "ready"])
    .order("created_at", { ascending: true });

  return <KitchenBoard initialOrders={(orders ?? []) as AdminOrder[]} storeId={store.id} />;
}
