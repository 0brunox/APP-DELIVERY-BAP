import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, Store } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import OrdersBoard from "@/components/admin/OrdersBoard";

export const dynamic = "force-dynamic";

export type AdminOrder = Order & { order_items: OrderItem[] };

export default async function AdminPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Primeira loja do usuário (multi-loja fica para a Etapa 12)
  const { data: stores } = await supabase
    .from("stores")
    .select("*")
    .eq("owner", user!.id)
    .order("created_at")
    .limit(1);

  const store = (stores?.[0] as Store | undefined) ?? null;

  if (!store) {
    return <CreateStoreForm />;
  }

  const { data: orders } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-5 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold">{store.name}</h1>
          <Link href={`/${store.slug}`} target="_blank" className="text-sm font-semibold text-primary">
            /{store.slug} ↗
          </Link>
        </div>
      </div>

      <OrdersBoard initialOrders={(orders ?? []) as AdminOrder[]} />
    </div>
  );
}
