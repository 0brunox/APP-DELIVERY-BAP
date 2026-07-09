import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { brl } from "@/lib/format";
import type { Order, OrderItem } from "@/lib/types";
import { aiConfigured } from "@/lib/ai";
import CreateStoreForm from "@/components/admin/CreateStoreForm";
import InsightsChat from "@/components/admin/InsightsChat";

export const dynamic = "force-dynamic";

type ReportOrder = Order & { order_items: OrderItem[] };

export default async function RelatoriosPage() {
  const store = await getOwnerStore();
  if (!store) return <CreateStoreForm />;

  const supabase = await createClient();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", store.id)
    .order("created_at", { ascending: false });

  const orders = ((data ?? []) as ReportOrder[]).filter((o) => o.status !== "cancelled");
  const revenue = orders.reduce((s, o) => s + Number(o.total), 0);
  const avg = orders.length ? revenue / orders.length : 0;

  // Vendas dos últimos 7 dias
  const days: { label: string; total: number }[] = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - i);
    days.push({ label: d.toLocaleDateString("pt-BR", { weekday: "short" }).replace(".", ""), total: 0 });
  }
  const today0 = new Date();
  today0.setHours(0, 0, 0, 0);
  orders.forEach((o) => {
    const od = new Date(o.created_at);
    od.setHours(0, 0, 0, 0);
    const diff = Math.round((today0.getTime() - od.getTime()) / 86400000);
    if (diff >= 0 && diff <= 6) days[6 - diff].total += Number(o.total);
  });
  const maxDay = Math.max(1, ...days.map((d) => d.total));

  // Itens mais vendidos
  const itemMap: Record<string, number> = {};
  orders.forEach((o) => o.order_items.forEach((it) => { itemMap[it.name] = (itemMap[it.name] ?? 0) + it.quantity; }));
  const topItems = Object.entries(itemMap).sort((a, b) => b[1] - a[1]).slice(0, 5);
  const maxItem = Math.max(1, ...topItems.map((t) => t[1]));

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card value={String(orders.length)} label="Pedidos" />
        <Card value={brl(revenue)} label="Faturamento" />
        <Card value={brl(avg)} label="Ticket médio" />
      </div>

      {orders.length === 0 ? (
        <div className="surface-2 rounded-2xl py-12 text-center text-muted">
          <div className="mb-2 text-4xl opacity-40">📊</div>
          <p>Sem dados ainda. Os relatórios aparecem após o primeiro pedido.</p>
        </div>
      ) : (
        <>
          <section className="surface bordered rounded-2xl p-5">
            <h2 className="mb-4 font-bold">📅 Vendas nos últimos 7 dias</h2>
            <div className="space-y-2">
              {days.map((d, i) => (
                <Bar key={i} label={d.label} pct={(d.total / maxDay) * 100} value={brl(d.total)} />
              ))}
            </div>
          </section>

          <section className="surface bordered rounded-2xl p-5">
            <h2 className="mb-4 font-bold">🏆 Itens mais vendidos</h2>
            <div className="space-y-2">
              {topItems.map(([name, qty]) => (
                <Bar key={name} label={name} pct={(qty / maxItem) * 100} value={`${qty}x`} />
              ))}
            </div>
          </section>

          {aiConfigured() && <InsightsChat />}
        </>
      )}
    </div>
  );
}

function Card({ value, label }: { value: string; label: string }) {
  return (
    <div className="surface bordered rounded-2xl p-5 text-center">
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="mt-1 text-sm text-muted">{label}</div>
    </div>
  );
}

function Bar({ label, pct, value }: { label: string; pct: number; value: string }) {
  return (
    <div className="grid grid-cols-[80px_1fr_64px] items-center gap-2 text-sm">
      <span className="truncate text-muted" title={label}>{label}</span>
      <div className="h-4 overflow-hidden rounded-full bg-[var(--surface-2)]">
        <div className="h-full rounded-full" style={{ width: `${Math.max(2, pct)}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))" }} />
      </div>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
