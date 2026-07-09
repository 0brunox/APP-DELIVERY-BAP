import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import SetupNotice from "@/components/SetupNotice";
import CourierBoard, { type CourierBoardData } from "@/components/courier/CourierBoard";

export const metadata: Metadata = { title: "Minhas entregas" };
export const dynamic = "force-dynamic";

export default async function CourierPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data } = await supabase.rpc("courier_get_board", { p_token: token });

  if (!data) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🔒</div>
        <h1 className="text-2xl font-bold">Link inválido</h1>
        <p className="text-muted">
          Este link de entregador não existe ou foi desativado. Fale com a loja para receber um novo.
        </p>
      </main>
    );
  }

  return <CourierBoard token={token} initial={data as CourierBoardData} />;
}
