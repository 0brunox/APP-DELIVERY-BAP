"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { orderStatusLabel, orderStatusIcon, ORDER_STATUS_COLOR } from "@/lib/orders";
import type { OrderStatus, OrderType } from "@/lib/types";
import OrderTimeline from "./OrderTimeline";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

/**
 * Cabeçalho ao vivo do acompanhamento: número + selo de status + timeline + ETA.
 * Assina o canal de Broadcast `order:<code>` (disparado pelo trigger do 0002/0003)
 * e atualiza status e previsão de pronto sozinho quando o lojista mexe no pedido.
 */
export default function OrderLiveStatus({
  number,
  code,
  initialStatus,
  initialReadyAt,
  orderType,
}: {
  number: number;
  code: string;
  initialStatus: OrderStatus;
  initialReadyAt: string | null;
  orderType: OrderType;
}) {
  const [status, setStatus] = useState<OrderStatus>(initialStatus);
  const [readyAt, setReadyAt] = useState<string | null>(initialReadyAt);
  const [flash, setFlash] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  // Acompanha se o servidor recarregar com dados mais novos.
  useEffect(() => {
    setStatus(initialStatus);
    setReadyAt(initialReadyAt);
  }, [initialStatus, initialReadyAt]);

  // Atualiza o "~N min" a cada 30s.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`order:${code}`)
      .on("broadcast", { event: "status" }, (msg) => {
        const p = msg.payload as { status?: OrderStatus; ready_at?: string | null };
        if (p.status) setStatus(p.status);
        if ("ready_at" in p) setReadyAt(p.ready_at ?? null);
        setFlash(true);
        setTimeout(() => setFlash(false), 2500);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  const color = ORDER_STATUS_COLOR[status];
  const minsLeft = readyAt ? Math.round((new Date(readyAt).getTime() - now) / 60000) : null;

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

      {readyAt && status === "preparing" && (
        <div className="mt-4 rounded-xl bg-amber-50 px-4 py-2.5 text-center text-sm font-semibold text-amber-700">
          ⏱️ Fica pronto por volta de {fmtTime(readyAt)}
          {minsLeft !== null && minsLeft > 0 ? ` · ~${minsLeft} min` : ""}
        </div>
      )}

      <div className="surface-2 my-5 rounded-xl p-4">
        <OrderTimeline status={status} orderType={orderType} />
      </div>
    </>
  );
}
