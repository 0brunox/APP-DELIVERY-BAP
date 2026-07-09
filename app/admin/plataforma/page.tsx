import { createClient } from "@/lib/supabase/server";
import { brl } from "@/lib/format";
import PlatformStores, { type PlatformStore } from "@/components/admin/PlatformStores";

export const dynamic = "force-dynamic";

interface PlatformStats {
  stores: PlatformStore[];
  totals: { stores: number; stores_pro: number; orders: number; gmv: number };
}

export default async function PlataformaPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("platform_stats");

  if (error || !data) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <div className="mb-2 text-5xl">🔒</div>
        <h1 className="text-2xl font-bold">Acesso restrito</h1>
        <p className="text-muted">Esta área é exclusiva do administrador da plataforma.</p>
      </div>
    );
  }

  const stats = data as PlatformStats;
  const t = stats.totals;

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold">🛡️ Painel da plataforma</h1>
      <p className="mb-5 text-sm text-muted">Visão geral de todas as lojas.</p>

      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <Card value={String(t.stores)} label="Lojas" />
        <Card value={String(t.stores_pro)} label="Lojas Pro" />
        <Card value={String(t.orders)} label="Pedidos totais" />
        <Card value={brl(Number(t.gmv))} label="GMV total" />
      </div>

      <PlatformStores stores={stats.stores} />
    </div>
  );
}

function Card({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface bordered rounded-2xl p-4 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-xs text-muted">{label}</div>
    </div>
  );
}
