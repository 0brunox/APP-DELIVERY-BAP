import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { PRO_PRICE, mpConfigured } from "@/lib/mp";
import type { Coupon, DeliveryZone } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import SettingsForm from "@/components/admin/SettingsForm";
import ZonesManager from "@/components/admin/ZonesManager";
import CouponsManager from "@/components/admin/CouponsManager";
import ImportBackup from "@/components/admin/ImportBackup";
import Subscription from "@/components/admin/Subscription";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const [{ data: zones }, { data: coupons }] = await Promise.all([
    supabase.from("delivery_zones").select("*").eq("store_id", store.id).order("name"),
    supabase.from("coupons").select("*").eq("store_id", store.id).order("code"),
  ]);

  return (
    <div className="space-y-8">
      <Subscription plan={store.plan} price={PRO_PRICE} configured={mpConfigured()} />
      <SettingsForm store={store} />
      <ZonesManager storeId={store.id} initialZones={(zones ?? []) as DeliveryZone[]} />
      <CouponsManager storeId={store.id} initialCoupons={(coupons ?? []) as Coupon[]} />
      <ImportBackup store={store} />
    </div>
  );
}
