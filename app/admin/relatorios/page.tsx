import { getOwnerStore } from "@/lib/admin";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import AdminSoon from "@/components/admin/AdminSoon";

export const dynamic = "force-dynamic";

export default async function RelatoriosPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;
  return <AdminSoon title="📊 Relatórios" note="Vendas, itens mais vendidos e ticket médio chegam na parte 6D-2c." />;
}
