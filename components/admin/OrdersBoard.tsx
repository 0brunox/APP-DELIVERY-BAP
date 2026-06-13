"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import { ORDER_TYPE_LABELS, PAYMENT_LABELS } from "@/lib/constants";
import { ORDER_FLOW, ORDER_STATUS_COLOR, orderStatusLabel, orderStatusIcon } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";
import type { AdminOrder } from "@/app/admin/page";

const FILTERS: { id: string; label: string }[] = [
  { id: "active", label: "Ativos" },
  { id: "all", label: "Todos" },
  { id: "completed", label: "Concluídos" },
  { id: "cancelled", label: "Cancelados" },
];

export default function OrdersBoard({ initialOrders }: { initialOrders: AdminOrder[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState<string | null>(null);

  async function setStatus(id: string, status: OrderStatus) {
    setBusy(id);
    await supabase.from("orders").update({ status }).eq("id", id);
    setBusy(null);
    router.refresh();
  }

  const shown = initialOrders.filter((o) => {
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    if (filter === "all") return true;
    return o.status === filter;
  });

  const activeCount = initialOrders.filter(
    (o) => o.status !== "completed" && o.status !== "cancelled"
  ).length;

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <div className="flex flex-wrap gap-1.5">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`rounded-full border-2 px-3 py-1 text-xs font-semibold transition ${
                filter === f.id ? "border-primary bg-primary text-white" : "surface border-[var(--border)] text-muted"
              }`}
            >
              {f.label}
              {f.id === "active" && activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
          ))}
        </div>
        <button
          onClick={() => router.refresh()}
          className="ml-auto rounded-lg border-2 border-[var(--border)] px-3 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
        >
          ↻ Atualizar
        </button>
      </div>

      {shown.length === 0 ? (
        <div className="surface-2 rounded-xl py-12 text-center text-muted">
          <div className="mb-2 text-4xl opacity-40">📭</div>
          <p>Nenhum pedido {filter === "active" ? "ativo" : ""} por aqui ainda.</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {shown.map((o) => {
            const color = ORDER_STATUS_COLOR[o.status];
            const isFinal = o.status === "completed" || o.status === "cancelled";
            const nextStatus = ORDER_FLOW[ORDER_FLOW.indexOf(o.status) + 1];
            const customer = o.customer as Record<string, string>;
            return (
              <div
                key={o.id}
                className="surface-2 rounded-xl p-4"
                style={{ borderLeft: `5px solid ${color}` }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-lg font-bold">Pedido #{o.number}</span>
                    <div className="text-xs text-muted">
                      {new Date(o.created_at).toLocaleString("pt-BR", {
                        day: "2-digit",
                        month: "2-digit",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                      {o.schedule_at ? ` · ⏰ ${o.schedule_at}` : ""}
                    </div>
                  </div>
                  <span
                    className="whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: color }}
                  >
                    {orderStatusIcon(o.status, o.order_type)} {orderStatusLabel(o.status, o.order_type)}
                  </span>
                </div>

                <span className="surface mb-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-semibold text-muted">
                  {ORDER_TYPE_LABELS[o.order_type]}
                  {o.order_type === "dinein" && customer.tableNumber ? ` · Mesa ${customer.tableNumber}` : ""}
                </span>

                <div className="mb-2 text-sm">
                  <strong>{customer.name}</strong> · 📱 {customer.phone}
                  {o.order_type === "delivery" && customer.street && (
                    <div className="text-muted">
                      📍 {customer.street}, {customer.number}
                      {customer.complement ? ` - ${customer.complement}` : ""}
                      {customer.neighborhood ? ` · ${customer.neighborhood}` : ""}
                    </div>
                  )}
                </div>

                <ul className="mb-2 text-sm text-muted">
                  {o.order_items.map((it, i) => (
                    <li key={i}>
                      {it.quantity}x {it.name}
                      {it.variation_name ? ` (${it.variation_name})` : ""}
                      {it.addons.length > 0 ? ` · ${it.addons.map((a) => a.name).join(", ")}` : ""}
                      {it.note ? ` — ${it.note}` : ""}
                    </li>
                  ))}
                </ul>

                <div className="mb-2 text-sm">
                  💳 {PAYMENT_LABELS[o.payment] ?? o.payment}
                  {o.change_for ? ` (troco p/ ${brl(o.change_for)})` : ""}
                  {o.coupon ? ` · 🎟️ ${o.coupon.code}` : ""}
                </div>
                <div className="mb-3 font-bold">Total: {brl(o.total)}</div>

                <div className="flex flex-wrap gap-2">
                  {!isFinal && nextStatus && (
                    <button
                      onClick={() => setStatus(o.id, nextStatus)}
                      disabled={busy === o.id}
                      className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                    >
                      → {orderStatusLabel(nextStatus, o.order_type)}
                    </button>
                  )}
                  {!isFinal && (
                    <button
                      onClick={() => setStatus(o.id, "cancelled")}
                      disabled={busy === o.id}
                      className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                    >
                      Cancelar
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
