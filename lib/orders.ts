import type { OrderStatus, OrderType } from "./types";

/** Fluxo linear de status (cancelado fica fora). */
export const ORDER_FLOW: OrderStatus[] = ["received", "preparing", "ready", "completed"];

const LABELS: Record<OrderStatus, string> = {
  received: "Recebido",
  preparing: "Em preparo",
  ready: "Pronto",
  completed: "Concluído",
  cancelled: "Cancelado",
};

const ICONS: Record<OrderStatus, string> = {
  received: "🆕",
  preparing: "👨‍🍳",
  ready: "✅",
  completed: "🎉",
  cancelled: "❌",
};

export const ORDER_STATUS_COLOR: Record<OrderStatus, string> = {
  received: "#3b82f6",
  preparing: "#f59e0b",
  ready: "#8b5cf6",
  completed: "#10b981",
  cancelled: "#ef4444",
};

/** Rótulo do status, adaptado ao tipo de pedido (entrega usa "Saiu/Entregue"). */
export function orderStatusLabel(status: OrderStatus, orderType: OrderType): string {
  if (orderType === "delivery" && status === "ready") return "Saiu para entrega";
  if (orderType === "delivery" && status === "completed") return "Entregue";
  return LABELS[status];
}

export function orderStatusIcon(status: OrderStatus, orderType: OrderType): string {
  if (orderType === "delivery" && status === "ready") return "🛵";
  return ICONS[status];
}
