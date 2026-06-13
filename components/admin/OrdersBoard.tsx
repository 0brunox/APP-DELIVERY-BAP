"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import { ORDER_TYPE_LABELS, PAYMENT_LABELS } from "@/lib/constants";
import { ORDER_FLOW, ORDER_STATUS_COLOR, orderStatusLabel, orderStatusIcon } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";
import type { AdminOrder } from "@/app/admin/page";
import PushToggle from "./PushToggle";

const FILTERS: { id: string; label: string }[] = [
  { id: "active", label: "Ativos" },
  { id: "all", label: "Todos" },
  { id: "completed", label: "Concluídos" },
  { id: "cancelled", label: "Cancelados" },
];

/** Toca um "ding-dong" curto via Web Audio (sem precisar de arquivo de áudio). */
function playChime() {
  try {
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    const now = ctx.currentTime;
    [880, 1175].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      osc.connect(gain);
      gain.connect(ctx.destination);
      const t = now + i * 0.18;
      gain.gain.setValueAtTime(0.0001, t);
      gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
      osc.start(t);
      osc.stop(t + 0.24);
    });
    setTimeout(() => ctx.close(), 800);
  } catch {
    // Áudio bloqueado pelo navegador até a primeira interação — ignorado.
  }
}

/** HH:MM local de um timestamp ISO. */
function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" });
}

export default function OrdersBoard({
  initialOrders,
  storeId,
}: {
  initialOrders: AdminOrder[];
  storeId: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [filter, setFilter] = useState("active");
  const [busy, setBusy] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const [soundOn, setSoundOn] = useState(true);
  const soundRef = useRef(true);

  // Preferência de som (persistida no navegador).
  useEffect(() => {
    const saved = localStorage.getItem("ordersSound");
    if (saved !== null) {
      const on = saved === "1";
      setSoundOn(on);
      soundRef.current = on;
    }
  }, []);

  function toggleSound() {
    const on = !soundOn;
    setSoundOn(on);
    soundRef.current = on;
    localStorage.setItem("ordersSound", on ? "1" : "0");
    if (on) playChime(); // o clique também "destrava" o áudio do navegador
  }

  // Mantém a lista em sincronia quando o servidor recarrega (botão Atualizar / navegação).
  useEffect(() => {
    setOrders(initialOrders);
  }, [initialOrders]);

  // Atualiza o título da aba quando chega pedido novo (visível em segundo plano).
  useEffect(() => {
    document.title = newIds.size > 0 ? `(${newIds.size}) 🔔 Pedidos` : "Pedidos · Painel";
  }, [newIds]);

  // === Realtime: assina mudanças nos pedidos desta loja ===
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;

    (async () => {
      // Garante que o Realtime use o token do lojista (RLS) antes de assinar.
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (!active) return;

      channel = supabase
        .channel(`orders-${storeId}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
          async (payload) => {
            const id = (payload.new as { id: string }).id;
            const { data: full } = await supabase
              .from("orders")
              .select("*, order_items(*)")
              .eq("id", id)
              .maybeSingle();
            if (!active || !full) return;
            setOrders((prev) => (prev.some((o) => o.id === id) ? prev : [full as AdminOrder, ...prev]));
            setNewIds((prev) => new Set(prev).add(id));
            setTimeout(() => {
              setNewIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              });
            }, 12000);
            if (soundRef.current) playChime();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
          (payload) => {
            const row = payload.new as AdminOrder;
            setOrders((prev) =>
              prev.map((o) => (o.id === row.id ? { ...o, ...row, order_items: o.order_items } : o))
            );
          }
        )
        .on(
          "postgres_changes",
          { event: "DELETE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
          (payload) => {
            const id = (payload.old as { id: string }).id;
            setOrders((prev) => prev.filter((o) => o.id !== id));
          }
        )
        .subscribe((status) => {
          if (active) setLive(status === "SUBSCRIBED");
        });
    })();

    return () => {
      active = false;
      if (channel) supabase.removeChannel(channel);
    };
  }, [supabase, storeId]);

  async function setStatus(id: string, status: OrderStatus) {
    setBusy(id);
    setOrders((prev) => prev.map((o) => (o.id === id ? { ...o, status } : o))); // otimista
    await supabase.from("orders").update({ status }).eq("id", id);
    setBusy(null);
  }

  // Aceita o pedido e define a previsão de pronto (agora + minutos escolhidos).
  async function accept(id: string, minutes: number) {
    setBusy(id);
    const readyAt = new Date(Date.now() + minutes * 60000).toISOString();
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, status: "preparing", ready_at: readyAt } : o))
    );
    setAcceptingId(null);
    await supabase.from("orders").update({ status: "preparing", ready_at: readyAt }).eq("id", id);
    setBusy(null);
  }

  const shown = orders.filter((o) => {
    if (filter === "active") return o.status !== "completed" && o.status !== "cancelled";
    if (filter === "all") return true;
    return o.status === filter;
  });

  const activeCount = orders.filter(
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

        <div className="ml-auto flex items-center gap-2">
          <PushToggle storeId={storeId} />
          <span
            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
              live ? "bg-green-100 text-green-700" : "bg-yellow-100 text-yellow-700"
            }`}
            title={live ? "Recebendo pedidos em tempo real" : "Conectando ao tempo real..."}
          >
            <span className={`h-2 w-2 rounded-full ${live ? "bg-green-500 animate-pulse" : "bg-yellow-500"}`} />
            {live ? "Ao vivo" : "Conectando"}
          </span>
          <button
            onClick={toggleSound}
            className="rounded-lg border-2 border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
            title={soundOn ? "Som de novo pedido ligado" : "Som de novo pedido desligado"}
          >
            {soundOn ? "🔔 Som" : "🔕 Mudo"}
          </button>
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border-2 border-[var(--border)] px-3 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
          >
            ↻ Atualizar
          </button>
        </div>
      </div>

      {newIds.size > 0 && (
        <button
          onClick={() => setNewIds(new Set())}
          className="mb-4 w-full animate-pulse rounded-xl bg-green-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg transition hover:bg-green-700"
        >
          🔔 {newIds.size} novo{newIds.size > 1 ? "s" : ""} pedido{newIds.size > 1 ? "s" : ""} chegou! (clique para dispensar o destaque)
        </button>
      )}

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
            const isNew = newIds.has(o.id);
            return (
              <div
                key={o.id}
                className={`surface-2 rounded-xl p-4 transition ${
                  isNew ? "ring-2 ring-green-400 ring-offset-2 ring-offset-[var(--bg)]" : ""
                }`}
                style={{ borderLeft: `5px solid ${color}` }}
              >
                <div className="mb-1 flex items-start justify-between gap-2">
                  <div>
                    <span className="text-lg font-bold">Pedido #{o.number}</span>
                    {isNew && (
                      <span className="ml-2 animate-bounce rounded-full bg-green-500 px-2 py-0.5 align-middle text-[10px] font-bold text-white">
                        NOVO
                      </span>
                    )}
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
                {o.ready_at && (o.status === "preparing" || o.status === "ready") && (
                  <div className="mb-2 text-sm font-semibold text-amber-600">
                    ⏱️ Fica pronto ~{fmtTime(o.ready_at)}
                  </div>
                )}
                <div className="mb-3 font-bold">Total: {brl(o.total)}</div>

                <div className="flex flex-wrap items-center gap-2">
                  {o.status === "received" ? (
                    acceptingId === o.id ? (
                      <>
                        <span className="text-xs font-semibold text-muted">Fica pronto em:</span>
                        {[15, 20, 30, 45, 60].map((m) => (
                          <button
                            key={m}
                            onClick={() => accept(o.id, m)}
                            disabled={busy === o.id}
                            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                          >
                            {m} min
                          </button>
                        ))}
                        <button
                          onClick={() => setAcceptingId(null)}
                          className="px-1.5 py-1 text-xs font-semibold text-muted hover:text-primary"
                        >
                          voltar
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={() => setAcceptingId(o.id)}
                          disabled={busy === o.id}
                          className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                        >
                          ✅ Aceitar
                        </button>
                        <button
                          onClick={() => setStatus(o.id, "cancelled")}
                          disabled={busy === o.id}
                          className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                        >
                          ✕ Recusar
                        </button>
                      </>
                    )
                  ) : (
                    !isFinal && (
                      <>
                        {nextStatus && (
                          <button
                            onClick={() => setStatus(o.id, nextStatus)}
                            disabled={busy === o.id}
                            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-green-700 disabled:opacity-50"
                          >
                            → {orderStatusLabel(nextStatus, o.order_type)}
                          </button>
                        )}
                        <button
                          onClick={() => setStatus(o.id, "cancelled")}
                          disabled={busy === o.id}
                          className="rounded-lg border border-red-500 px-3 py-1.5 text-xs font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                        >
                          Cancelar
                        </button>
                      </>
                    )
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
