import { getOwnerStore } from "@/lib/admin";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import ThemeForm from "@/components/admin/ThemeForm";

export const dynamic = "force-dynamic";

export default async function AparenciaPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;
  return <ThemeForm store={store} />;
}
