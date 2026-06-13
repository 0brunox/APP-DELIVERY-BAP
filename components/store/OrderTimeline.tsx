import type { OrderStatus, OrderType } from "@/lib/types";
import { ORDER_FLOW, orderStatusLabel } from "@/lib/orders";

export default function OrderTimeline({
  status,
  orderType,
}: {
  status: OrderStatus;
  orderType: OrderType;
}) {
  if (status === "cancelled") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-xl bg-red-50 py-3 font-semibold text-red-600">
        ❌ Pedido cancelado
      </div>
    );
  }

  const currentIdx = ORDER_FLOW.indexOf(status);

  return (
    <div className="flex items-start">
      {ORDER_FLOW.map((s, i) => {
        const done = i <= currentIdx;
        return (
          <div key={s} className="relative flex flex-1 flex-col items-center text-center">
            {i > 0 && (
              <div
                className={`absolute right-1/2 top-3 h-1 w-full ${i <= currentIdx ? "bg-green-500" : "bg-[var(--surface-2)]"}`}
              />
            )}
            <div
              className={`relative z-10 flex h-7 w-7 items-center justify-center rounded-full text-xs ${
                done ? "bg-green-500 text-white" : "surface-2 text-muted"
              }`}
            >
              {done ? "✓" : i + 1}
            </div>
            <span className={`mt-1 text-[11px] leading-tight ${done ? "font-semibold" : "text-muted"}`}>
              {orderStatusLabel(s, orderType)}
            </span>
          </div>
        );
      })}
    </div>
  );
}
