"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import { PAYMENT_LABELS } from "@/lib/constants";

interface CourierDeliveryItem {
  name: string;
  variation_name: string | null;
  quantity: number;
}

interface CourierDelivery {
  id: string;
  number: number;
  code: string;
  status: "preparing" | "ready";
  customer: Record<string, string>;
  payment: string;
  total: number;
  delivery_fee: number;
  created_at: string;
  ready_at: string | null;
  items: CourierDeliveryItem[];
}

export interface CourierBoardData {
  courier: { name: string; phone: string };
  store: { name: string; slug: string };
  deliveries: CourierDelivery[];
  week: { count: number; fees: number };
}

function addressText(c: Record<string, string>): string {
  const parts = [
    [c.street, c.number].filter(Boolean).join(", "),
    c.complement,
    c.neighborhood,
  ].filter(Boolean);
  return parts.join(" · ");
}

function mapsUrl(c: Record<string, string>): string {
  const q = [c.street, c.number, c.neighborhood, c.cep].filter(Boolean).join(", ");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(q)}`;
}

function waUrl(phone: string): string {
  const digits = (phone || "").replace(/\D/g, "");
  return `https://wa.me/${digits.length <= 11 ? "55" + digits : digits}`;
}

export default function CourierBoard({
  token,
  initial,
}: {
  token: string;
  initial: CourierBoardData;
}) {
  const [supabase] = useState(() => createClient());
  const [data, setData] = useState<CourierBoardData>(initial);
  const [busy, setBusy] = useState<string | null>(null);
  const [geoStatus, setGeoStatus] = useState<"off" | "on" | "denied">("off");
  const lastSentRef = useRef(0);
  const watchIdRef = useRef<number | null>(null);

  const refresh = useCallback(async () => {
    const { data: fresh } = await supabase.rpc("courier_get_board", { p_token: token });
    if (fresh) setData(fresh as CourierBoardData);
  }, [supabase, token]);

  // Novas atribuições aparecem sozinhas (a página fica aberta no celular).
  useEffect(() => {
    const id = setInterval(refresh, 15000);
    return () => clearInterval(id);
  }, [refresh]);

  const hasActiveRoute = data.deliveries.some((d) => d.status === "ready");

  // GPS: compartilha a posição enquanto houver entrega em rota.
  useEffect(() => {
    if (!hasActiveRoute) {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setGeoStatus("off");
      return;
    }
    if (!("geolocation" in navigator)) return;

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setGeoStatus("on");
        const now = Date.now();
        if (now - lastSentRef.current < 5000) return; // no máximo 1 envio a cada 5s
        lastSentRef.current = now;
        supabase
          .rpc("courier_update_location", {
            p_token: token,
            p_lat: pos.coords.latitude,
            p_lng: pos.coords.longitude,
          })
          .then(() => undefined);
      },
      () => setGeoStatus("denied"),
      { enableHighAccuracy: true, maximumAge: 3000 }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
    };
  }, [hasActiveRoute, supabase, token]);

  async function setStatus(d: CourierDelivery, status: "ready" | "completed") {
    setBusy(d.id);
    const { error } = await supabase.rpc("courier_set_status", {
      p_token: token,
      p_order: d.id,
      p_status: status,
    });
    if (!error) await refresh();
    setBusy(null);
  }

  return (
    <main className="mx-auto min-h-screen max-w-md px-4 py-6">
      <header className="mb-5 text-center">
        <div className="text-3xl">🛵</div>
        <h1 className="text-xl font-bold">Olá, {data.courier.name}!</h1>
        <p className="text-sm text-muted">Entregas de {data.store.name}</p>
        {hasActiveRoute && (
          <div
            className={`mt-2 inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold ${
              geoStatus === "on"
                ? "bg-green-100 text-green-700"
                : geoStatus === "denied"
                  ? "bg-red-100 text-red-700"
                  : "bg-yellow-100 text-yellow-700"
            }`}
          >
            {geoStatus === "on" && <>📍 Compartilhando localização</>}
            {geoStatus === "denied" && <>⚠️ Ative a localização para o cliente te acompanhar</>}
            {geoStatus === "off" && <>📍 Ativando localização...</>}
          </div>
        )}
      </header>

      {data.deliveries.length === 0 ? (
        <div className="surface-2 rounded-2xl py-12 text-center text-muted">
          <div className="mb-2 text-4xl opacity-40">📭</div>
          <p>Nenhuma entrega atribuída a você agora.</p>
          <p className="mt-1 text-xs">Esta tela atualiza sozinha.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {data.deliveries.map((d) => {
            const c = d.customer ?? {};
            const inRoute = d.status === "ready";
            return (
              <div
                key={d.id}
                className="surface bordered rounded-2xl p-4"
                style={{ borderLeft: `5px solid ${inRoute ? "#8b5cf6" : "#f59e0b"}` }}
              >
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-lg font-bold">Pedido #{d.number}</span>
                  <span
                    className="rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                    style={{ background: inRoute ? "#8b5cf6" : "#f59e0b" }}
                  >
                    {inRoute ? "🛵 Em rota" : "👨‍🍳 Preparando"}
                  </span>
                </div>

                <div className="mb-1 text-sm font-semibold">{c.name}</div>
                <div className="mb-2 text-sm text-muted">📍 {addressText(c)}</div>
                {c.reference && <div className="mb-2 text-xs text-muted">🧭 Ref: {c.reference}</div>}

                <ul className="mb-2 text-xs text-muted">
                  {d.items.map((it, i) => (
                    <li key={i}>
                      {it.quantity}x {it.name}
                      {it.variation_name ? ` (${it.variation_name})` : ""}
                    </li>
                  ))}
                </ul>

                <div className="mb-3 rounded-lg bg-amber-50 p-2.5 text-sm font-semibold text-amber-800">
                  💳 Cobrar {brl(d.total)} — {PAYMENT_LABELS[d.payment] ?? d.payment}
                </div>

                <div className="mb-3 flex gap-2">
                  <a
                    href={mapsUrl(c)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex-1 rounded-xl border-2 border-[var(--border)] py-2 text-center text-sm font-semibold text-muted transition hover:border-primary hover:text-primary"
                  >
                    🗺️ Rota
                  </a>
                  {c.phone && (
                    <a
                      href={waUrl(c.phone)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 rounded-xl border-2 border-[var(--border)] py-2 text-center text-sm font-semibold text-muted transition hover:border-green-500 hover:text-green-600"
                    >
                      💬 WhatsApp
                    </a>
                  )}
                </div>

                {d.status === "preparing" ? (
                  <button
                    onClick={() => setStatus(d, "ready")}
                    disabled={busy === d.id}
                    className="w-full rounded-xl bg-primary py-3 text-base font-bold text-white transition hover:bg-primary-dark disabled:opacity-50"
                  >
                    📦 Peguei o pedido
                  </button>
                ) : (
                  <button
                    onClick={() => setStatus(d, "completed")}
                    disabled={busy === d.id}
                    className="w-full rounded-xl bg-green-600 py-3 text-base font-bold text-white transition hover:bg-green-700 disabled:opacity-50"
                  >
                    ✅ Entregue
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}

      <footer className="mt-6 rounded-2xl bg-[var(--surface-2)] p-4 text-center text-sm">
        <div className="text-xs font-bold uppercase tracking-wide text-muted">Últimos 7 dias</div>
        <div className="mt-1 font-bold">
          {data.week.count} entrega{data.week.count === 1 ? "" : "s"} · {brl(data.week.fees)} em taxas
        </div>
        <p className="mt-1 text-xs text-muted">Use este resumo para o acerto semanal com a loja.</p>
      </footer>
    </main>
  );
}
