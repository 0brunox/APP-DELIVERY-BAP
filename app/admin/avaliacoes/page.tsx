import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import type { Review } from "@/lib/types";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import ReviewsManager from "@/components/admin/ReviewsManager";

export const dynamic = "force-dynamic";

export default async function AvaliacoesPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const { data: reviews } = await supabase
    .from("reviews")
    .select("*")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">⭐ Avaliações</h1>
      <p className="mb-5 text-sm text-muted">
        Só avaliações <strong>aprovadas</strong> aparecem na sua loja. Oculte as que não quiser exibir.
      </p>
      <ReviewsManager initialReviews={(reviews ?? []) as Review[]} />
    </div>
  );
}
