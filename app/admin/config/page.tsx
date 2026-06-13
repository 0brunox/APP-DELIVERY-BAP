import { getOwnerStore } from "@/lib/admin";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import AdminSoon from "@/components/admin/AdminSoon";

export const dynamic = "force-dynamic";

export default async function ConfigPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;
  return <AdminSoon title="⚙️ Configurações" note="Dados da loja, entrega, zonas, pagamento/PIX, cupons e agendamento chegam na próxima parte (6D-2b)." />;
}
