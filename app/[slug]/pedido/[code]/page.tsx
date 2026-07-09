import type { Metadata } from "next";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/env";
import { brl } from "@/lib/format";
import { ORDER_TYPE_LABELS } from "@/lib/constants";
import type { OrderStatus, OrderType, AddonOption } from "@/lib/types";
import OrderLiveStatus from "@/components/store/OrderLiveStatus";
import CourierLiveMap, { type TrackedCourier } from "@/components/store/CourierLiveMap";
import SetupNotice from "@/components/SetupNotice";

export const metadata: Metadata = { title: "Acompanhar pedido" };
export const dynamic = "force-dynamic"; // sempre status atualizado

interface TrackedItem {
  name: string;
  variation_name: string | null;
  addons: AddonOption[];
  note: string;
  unit_price: number;
  quantity: number;
}
interface TrackedOrder {
  number: number;
  code: string;
  status: OrderStatus;
  order_type: OrderType;
  total: number;
  created_at: string;
  schedule_at: string | null;
  ready_at: string | null;
  customer: Record<string, string>;
  courier: TrackedCourier | null;
  items: TrackedItem[];
}

export default async function TrackPage({
  params,
}: {
  params: Promise<{ slug: string; code: string }>;
}) {
  const { slug, code } = await params;
  if (!isSupabaseConfigured()) return <SetupNotice />;

  const supabase = await createClient();
  const { data: store } = await supabase
    .from("stores")
    .select("id,name,slug")
    .eq("slug", slug)
    .maybeSingle();

  const order = store
    ? ((await supabase.rpc("get_order_by_code", { p_store: store.id, p_code: code })).data as TrackedOrder | null)
    : null;

  if (!store || !order) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col items-center justify-center gap-3 p-6 text-center">
        <div className="text-5xl">🔍</div>
        <h1 className="text-2xl font-bold">Pedido não encontrado</h1>
        <p className="text-muted">Confira o código de acompanhamento.</p>
        {store && (
          <Link href={`/${store.slug}`} className="font-semibold text-primary">
            ← Voltar para {store.name}
          </Link>
        )}
      </main>
    );
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-5 py-8">
      <Link href={`/${store.slug}`} className="text-sm font-semibold text-primary">
        ← {store.name}
      </Link>

      <div className="surface bordered mt-4 rounded-2xl p-6">
        <OrderLiveStatus
          number={order.number}
          code={order.code}
          initialStatus={order.status}
          initialReadyAt={order.ready_at}
          orderType={order.order_type}
        />

        {order.order_type === "delivery" &&
          order.courier &&
          (order.status === "preparing" || order.status === "ready") && (
            <CourierLiveMap
              code={order.code}
              courier={order.courier}
              customer={order.customer ?? {}}
            />
          )}

        <div className="mb-1 flex justify-between text-sm">
          <span className="text-muted">Tipo</span>
          <span className="font-semibold">{ORDER_TYPE_LABELS[order.order_type]}</span>
        </div>
        {order.schedule_at && (
          <div className="mb-1 flex justify-between text-sm">
            <span className="text-muted">Agendado</span>
            <span className="font-semibold">{order.schedule_at}</span>
          </div>
        )}

        <div className="mt-4 border-t border-[var(--border)] pt-4">
          <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Itens</div>
          {order.items.map((it, i) => (
            <div key={i} className="mb-2 flex justify-between gap-2 text-sm">
              <span>
                {it.quantity}x {it.name}
                {it.variation_name ? ` (${it.variation_name})` : ""}
                {it.addons.length > 0 && (
                  <span className="text-muted"> · {it.addons.map((a) => a.name).join(", ")}</span>
                )}
                {it.note && <span className="block text-xs italic text-muted">Obs: {it.note}</span>}
              </span>
              <span className="whitespace-nowrap font-semibold">{brl(it.unit_price * it.quantity)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 flex justify-between border-t border-[var(--border)] pt-4 text-lg font-bold">
          <span>Total</span>
          <span>{brl(order.total)}</span>
        </div>
      </div>

      <p className="mt-4 text-center text-xs text-muted">
        Código <span className="font-mono font-semibold">{order.code}</span> · Esta página atualiza o status sozinha, em tempo real.
      </p>
    </main>
  );
}
