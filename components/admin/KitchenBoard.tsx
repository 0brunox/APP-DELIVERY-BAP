"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { ORDER_TYPE_LABELS } from "@/lib/constants";
import type { OrderStatus } from "@/lib/types";
import type { AdminOrder } from "@/app/admin/page";

/** Colunas do KDS (pedidos concluídos/cancelados saem da tela). */
const COLUMNS: { status: OrderStatus; title: string; color: string }[] = [
  { status: "received", title: "🆕 Novos", color: "#3b82f6" },
  { status: "preparing", title: "👨‍🍳 Em preparo", color: "#f59e0b" },
  { status: "ready", title: "✅ Prontos", color: "#8b5cf6" },
];

const NEXT_LABEL: Record<string, string> = {
  received: "Aceitar →",
  preparing: "Marcar pronto →",
  ready: "Concluir ✓",
};
const NEXT_STATUS: Record<string, OrderStatus> = {
  received: "preparing",
  preparing: "ready",
  ready: "completed",
};

/** "ding-dong" curto via Web Audio (sem arquivo de áudio). */
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
    /* áudio bloqueado até a 1ª interação */
  }
}

/** Minutos decorridos desde a criação. */
function minsAgo(iso: string, now: number): number {
  return Math.max(0, Math.floor((now - new Date(iso).getTime()) / 60000));
}

export default function KitchenBoard({
  initialOrders,
  storeId,
}: {
  initialOrders: AdminOrder[];
  storeId: string;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [orders, setOrders] = useState<AdminOrder[]>(initialOrders);
  const [busy, setBusy] = useState<string | null>(null);
  const [live, setLive] = useState(false);
  const [soundOn, setSoundOn] = useState(true);
  const [now, setNow] = useState(() => Date.now());
  const [newIds, setNewIds] = useState<Set<string>>(new Set());
  const soundRef = useRef(true);

  useEffect(() => setOrders(initialOrders), [initialOrders]);

  // Relógio para o "há N min".
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 20000);
    return () => clearInterval(id);
  }, []);

  // Realtime dos pedidos desta loja.
  useEffect(() => {
    let active = true;
    let channel: ReturnType<typeof supabase.channel> | null = null;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (data.session) supabase.realtime.setAuth(data.session.access_token);
      if (!active) return;
      channel = supabase
        .channel(`kitchen-${storeId}`)
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
            setOrders((prev) => (prev.some((o) => o.id === id) ? prev : [...prev, full as AdminOrder]));
            setNewIds((prev) => new Set(prev).add(id));
            setTimeout(() => setNewIds((prev) => { const n = new Set(prev); n.delete(id); return n; }), 10000);
            if (soundRef.current) playChime();
          }
        )
        .on(
          "postgres_changes",
          { event: "UPDATE", schema: "public", table: "orders", filter: `store_id=eq.${storeId}` },
          (payload) => {
            const row = payload.new as AdminOrder;
            setOrders((prev) => {
              // Sai da tela quando concluído/cancelado.
              if (row.status === "completed" || row.status === "cancelled") {
                return prev.filter((o) => o.id !== row.id);
              }
              return prev.map((o) => (o.id === row.id ? { ...o, ...row, order_items: o.order_items } : o));
            });
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
        .subscribe((status) => { if (active) setLive(status === "SUBSCRIBED"); });
    })();
    return () => { active = false; if (channel) supabase.removeChannel(channel); };
  }, [supabase, storeId]);

  function toggleSound() {
    const on = !soundOn;
    setSoundOn(on);
    soundRef.current = on;
    if (on) playChime();
  }

  async function advance(o: AdminOrder) {
    const next = NEXT_STATUS[o.status];
    if (!next) return;
    setBusy(o.id);
    // Otimista: se conclui, remove da tela; senão muda coluna.
    setOrders((prev) =>
      next === "completed" ? prev.filter((x) => x.id !== o.id) : prev.map((x) => (x.id === o.id ? { ...x, status: next } : x))
    );
    await supabase.from("orders").update({ status: next }).eq("id", o.id);
    setBusy(null);
  }

  async function cancel(o: AdminOrder) {
    setBusy(o.id);
    setOrders((prev) => prev.filter((x) => x.id !== o.id));
    await supabase.from("orders").update({ status: "cancelled" }).eq("id", o.id);
    setBusy(null);
  }

  function fullscreen() {
    const el = document.documentElement;
    if (document.fullscreenElement) document.exitFullscreen?.();
    else el.requestFullscreen?.().catch(() => undefined);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-neutral-900 text-white">
      {/* Barra superior */}
      <div className="flex items-center gap-3 border-b border-neutral-700 bg-neutral-950 px-4 py-2.5">
        <span className="text-lg font-extrabold">👨‍🍳 Cozinha</span>
        <span
          className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-bold ${
            live ? "bg-green-500/20 text-green-300" : "bg-yellow-500/20 text-yellow-300"
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${live ? "bg-green-400 animate-pulse" : "bg-yellow-400"}`} />
          {live ? "Ao vivo" : "Conectando"}
        </span>
        <div className="ml-auto flex items-center gap-2">
          <button onClick={toggleSound} className="rounded-lg border border-neutral-600 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-800">
            {soundOn ? "🔔 Som" : "🔕 Mudo"}
          </button>
          <button onClick={fullscreen} className="rounded-lg border border-neutral-600 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-800">
            ⛶ Tela cheia
          </button>
          <button onClick={() => router.push("/admin")} className="rounded-lg border border-neutral-600 px-3 py-1.5 text-sm font-semibold hover:bg-neutral-800">
            ✕ Sair
          </button>
        </div>
      </div>

      {/* Colunas */}
      <div className="grid flex-1 grid-cols-1 gap-3 overflow-hidden p-3 sm:grid-cols-3">
        {COLUMNS.map((col) => {
          const items = orders.filter((o) => o.status === col.status);
          return (
            <div key={col.status} className="flex min-h-0 flex-col rounded-xl bg-neutral-800/50">
              <div className="flex items-center justify-between border-b border-neutral-700 px-3 py-2">
                <span className="text-base font-bold" style={{ color: col.color }}>{col.title}</span>
                <span className="rounded-full bg-neutral-700 px-2 py-0.5 text-sm font-bold">{items.length}</span>
              </div>
              <div className="flex-1 space-y-3 overflow-y-auto p-3">
                {items.length === 0 && (
                  <div className="pt-10 text-center text-neutral-500">—</div>
                )}
                {items.map((o) => {
                  const customer = o.customer as Record<string, string>;
                  const isNew = newIds.has(o.id);
                  const mins = minsAgo(o.created_at, now);
                  const late = mins >= 20 && o.status !== "ready";
                  return (
                    <div
                      key={o.id}
                      className={`rounded-xl bg-neutral-900 p-3 shadow-lg ring-1 ring-neutral-700 ${isNew ? "animate-pulse ring-2 ring-green-400" : ""}`}
                      style={{ borderLeft: `6px solid ${col.color}` }}
                    >
                      <div className="mb-1 flex items-baseline justify-between">
                        <span className="text-3xl font-black leading-none">#{o.number}</span>
                        <span className={`text-sm font-bold ${late ? "text-red-400" : "text-neutral-400"}`}>
                          {mins === 0 ? "agora" : `há ${mins} min`}
                        </span>
                      </div>
                      <div className="mb-2 text-xs font-semibold text-neutral-400">
                        {ORDER_TYPE_LABELS[o.order_type]}
                        {o.order_type === "dinein" && customer.tableNumber ? ` · Mesa ${customer.tableNumber}` : ""}
                        {customer.name ? ` · ${customer.name}` : ""}
                      </div>

                      <ul className="mb-3 space-y-1">
                        {o.order_items.map((it, i) => (
                          <li key={i} className="text-lg font-bold leading-tight">
                            <span className="text-primary">{it.quantity}x</span> {it.name}
                            {it.variation_name ? <span className="text-neutral-300"> ({it.variation_name})</span> : ""}
                            {it.addons.length > 0 && (
                              <span className="block pl-6 text-sm font-normal text-neutral-400">+ {it.addons.map((a) => a.name).join(", ")}</span>
                            )}
                            {it.note && (
                              <span className="block pl-6 text-sm font-semibold text-amber-400">⚠ {it.note}</span>
                            )}
                          </li>
                        ))}
                      </ul>

                      <div className="flex gap-2">
                        <button
                          onClick={() => advance(o)}
                          disabled={busy === o.id}
                          className="flex-1 rounded-lg bg-green-600 py-2.5 text-base font-bold transition hover:bg-green-500 disabled:opacity-50"
                        >
                          {NEXT_LABEL[o.status]}
                        </button>
                        {o.status === "received" && (
                          <button
                            onClick={() => cancel(o)}
                            disabled={busy === o.id}
                            className="rounded-lg border border-red-500 px-3 py-2.5 text-base font-bold text-red-400 transition hover:bg-red-500 hover:text-white disabled:opacity-50"
                          >
                            ✕
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
