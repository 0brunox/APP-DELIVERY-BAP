import { createClient } from "@/lib/supabase/server";
import type { PlanUsage } from "@/lib/types";

/** Mostra plano atual e uso (produtos e pedidos do mês) com aviso ao chegar no limite. */
export default async function PlanBanner({ storeId }: { storeId: string }) {
  const supabase = await createClient();
  const { data } = await supabase.rpc("plan_usage", { p_store: storeId });
  const u = data as PlanUsage | null;
  if (!u) return null;

  if (u.plan === "pro") {
    return (
      <div className="mb-5 flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm font-semibold text-amber-800">
        ⭐ Plano <strong>Pro</strong> ativo — produtos e pedidos ilimitados.
      </div>
    );
  }

  const prodPct = u.products_limit ? Math.min(100, (u.products / u.products_limit) * 100) : 0;
  const ordPct = u.orders_limit ? Math.min(100, (u.orders_month / u.orders_limit) * 100) : 0;
  const nearProd = u.products_limit != null && u.products >= u.products_limit * 0.8;
  const nearOrd = u.orders_limit != null && u.orders_month >= u.orders_limit * 0.8;

  return (
    <div className="mb-5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-4 text-sm">
      <div className="mb-2 flex items-center justify-between">
        <span className="font-bold">Plano Free</span>
        {(nearProd || nearOrd) && (
          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-700">
            Perto do limite — considere o Pro
          </span>
        )}
      </div>
      <Meter label="Produtos" value={u.products} limit={u.products_limit} pct={prodPct} />
      <Meter label="Pedidos este mês" value={u.orders_month} limit={u.orders_limit} pct={ordPct} />
    </div>
  );
}

function Meter({
  label,
  value,
  limit,
  pct,
}: {
  label: string;
  value: number;
  limit: number | null;
  pct: number;
}) {
  return (
    <div className="mb-2 last:mb-0">
      <div className="mb-1 flex justify-between text-xs text-muted">
        <span>{label}</span>
        <span className="font-semibold">
          {value}
          {limit != null ? ` / ${limit}` : ""}
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(2, pct)}%`, background: pct >= 80 ? "#f59e0b" : "var(--primary)" }}
        />
      </div>
    </div>
  );
}
