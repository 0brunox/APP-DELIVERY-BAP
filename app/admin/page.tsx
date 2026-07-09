import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { Order, OrderItem } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import OrdersBoard from "@/components/admin/OrdersBoard";

export const dynamic = "force-dynamic";

export type AdminOrder = Order & { order_items: OrderItem[] };

export default async function AdminPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const [{ data: orders }, { data: couriers }] = await Promise.all([
    supabase
      .from("orders")
      .select("*, order_items(*)")
      .eq("store_id", store.id)
      .order("created_at", { ascending: false }),
    supabase
      .from("couriers")
      .select("id, name")
      .eq("store_id", store.id)
      .eq("active", true)
      .order("name"),
  ]);

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-bold">{store.name}</h1>
        <Link href={`/${store.slug}`} target="_blank" className="text-sm font-semibold text-primary">
          /{store.slug} ↗
        </Link>
      </div>
      <OrdersBoard
        initialOrders={(orders ?? []) as AdminOrder[]}
        storeId={store.id}
        couriers={(couriers ?? []) as { id: string; name: string }[]}
      />
    </div>
  );
}
