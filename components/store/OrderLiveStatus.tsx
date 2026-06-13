"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { orderStatusLabel, orderStatusIcon, ORDER_STATUS_COLOR } from "@/lib/orders";
import type { OrderStatus, OrderType } from "@/lib/types";
import OrderTimeline from "./OrderTimeline";

/**
 * Cabeçalho ao vivo do acompanhamento: número + selo de status + timeline.
 * Assina o canal de Broadcast `order:<code>` (disparado pelo trigger do 0002)
 * e atualiza o status sozinho quando o lojista avança o pedido — sem refresh.
 */
export default function OrderLiveStatus({
  number,
  code,
  initialStatus,
  orderType,
}: {
  number: number;
  code: string;
  initialStatus: OrderStatus;
  orderType: OrderType;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [flash, setFlash] = useState(false);

  // Se o servidor recarregar a página com um status mais novo, acompanha.
  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order:${code}`)
      .on("broadcast", { event: "status" }, (msg) => {
        const next = (msg.payload as { status?: OrderStatus }).status;
        if (next) {
          setStatus(next);
          setFlash(true);
          setTimeout(() => setFlash(false), 2500);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  const color = ORDER_STATUS_COLOR[status];

  return (
    <>
      <div className="text-center">
        <div className="text-sm text-muted">Pedido</div>
        <div className="text-4xl font-extrabold text-primary">#{number}</div>
        <div
          className={`mx-auto mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-sm font-semibold text-white transition-transform duration-300 ${
            flash ? "scale-110" : ""
          }`}
          style={{ background: color }}
        >
          {orderStatusIcon(status, orderType)} {orderStatusLabel(status, orderType)}
        </div>
        {flash && (
          <div className="mt-2 animate-pulse text-xs font-semibold text-green-600">
            ✨ Status atualizado!
          </div>
        )}
      </div>

      <div className="surface-2 my-5 rounded-xl p-4">
        <OrderTimeline status={status} orderType={orderType} />
      </div>
    </>
  );
}
