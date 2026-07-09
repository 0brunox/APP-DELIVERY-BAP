import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { Courier } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import CouriersManager from "@/components/admin/CouriersManager";

export const dynamic = "force-dynamic";

/** Entregas concluídas nos últimos 7 dias, agregadas por entregador. */
export interface CourierWeekStats {
  courier_id: string;
  count: number;
  fees: number;
}

export default async function CouriersPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const [{ data: couriers }, { data: delivered }] = await Promise.all([
    supabase
      .from("couriers")
      .select("*")
      .eq("store_id", store.id)
      .order("created_at"),
    supabase
      .from("orders")
      .select("courier_id, delivery_fee, delivered_at, created_at")
      .eq("store_id", store.id)
      .eq("status", "completed")
      .not("courier_id", "is", null)
      .gte("created_at", new Date(Date.now() - 7 * 86400000).toISOString()),
  ]);

  const stats = new Map<string, CourierWeekStats>();
  for (const o of delivered ?? []) {
    const id = o.courier_id as string;
    const s = stats.get(id) ?? { courier_id: id, count: 0, fees: 0 };
    s.count += 1;
    s.fees += Number(o.delivery_fee) || 0;
    stats.set(id, s);
  }

  return (
    <div>
      <h1 className="mb-5 text-2xl font-bold">🛵 Entregadores</h1>
      <CouriersManager
        storeId={store.id}
        initialCouriers={(couriers ?? []) as Courier[]}
        weekStats={[...stats.values()]}
      />
    </div>
  );
}
