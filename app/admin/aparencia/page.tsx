import { getOwnerStore } from "@/lib/admin";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import AdminSoon from "@/components/admin/AdminSoon";

export const dynamic = "force-dynamic";

export default async function AparenciaPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;
  return <AdminSoon title="🎨 Aparência" note="Editor de tema (cores, fonte, banner) chega na parte 6D-2c." />;
}
