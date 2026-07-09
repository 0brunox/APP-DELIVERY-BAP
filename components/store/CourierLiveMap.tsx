"use client";

import { useEffect, useRef, useState } from "react";
import type { Map as LeafletMap, Marker } from "leaflet";
import { createClient } from "@/lib/supabase/client";
import "leaflet/dist/leaflet.css";

export interface TrackedCourier {
  name: string;
  phone: string;
  lat: number | null;
  lng: number | null;
  location_at: string | null;
}

/** Distância em km entre dois pontos (linha reta, Haversine). */
function distanceKm(aLat: number, aLng: number, bLat: number, bLng: number): number {
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 6371 * 2 * Math.asin(Math.sqrt(h));
}

/**
 * Mapa ao vivo do entregador (Leaflet + OpenStreetMap, sem chave paga).
 * Posição inicial vem do banco; atualizações chegam por Broadcast no
 * tópico `track:<code>` (enviadas pela RPC courier_update_location).
 * O destino é geocodificado via Nominatim a partir do endereço do pedido.
 */
export default function CourierLiveMap({
  code,
  courier,
  customer,
  speedKmh = 22,
}: {
  code: string;
  courier: TrackedCourier;
  customer: Record<string, string>;
  speedKmh?: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const courierMarkerRef = useRef<Marker | null>(null);
  const destRef = useRef<{ lat: number; lng: number } | null>(null);
  const [pos, setPos] = useState<{ lat: number; lng: number } | null>(
    courier.lat != null && courier.lng != null ? { lat: courier.lat, lng: courier.lng } : null
  );
  const [etaMin, setEtaMin] = useState<number | null>(null);

  // Monta o mapa (Leaflet só no navegador) e geocodifica o destino.
  useEffect(() => {
    let disposed = false;

    (async () => {
      const L = (await import("leaflet")).default;
      if (disposed || !containerRef.current || mapRef.current) return;

      const start = pos ?? { lat: -14.235, lng: -51.9253 }; // fallback: Brasil
      const map = L.map(containerRef.current).setView([start.lat, start.lng], pos ? 15 : 4);
      L.tileLayer("https://tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
        maxZoom: 19,
      }).addTo(map);
      mapRef.current = map;

      const bikeIcon = L.divIcon({
        className: "",
        html: '<div style="font-size:28px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🛵</div>',
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });
      courierMarkerRef.current = L.marker([start.lat, start.lng], {
        icon: bikeIcon,
        opacity: pos ? 1 : 0,
      }).addTo(map);

      // Destino: geocodifica o endereço do cliente (melhor esforço).
      const q = [customer.street, customer.number, customer.neighborhood, customer.cep, "Brasil"]
        .filter(Boolean)
        .join(", ");
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(q)}`
        );
        const results = (await res.json()) as { lat: string; lon: string }[];
        if (!disposed && results[0] && mapRef.current) {
          const dest = { lat: parseFloat(results[0].lat), lng: parseFloat(results[0].lon) };
          destRef.current = dest;
          const homeIcon = L.divIcon({
            className: "",
            html: '<div style="font-size:26px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.4))">🏠</div>',
            iconSize: [26, 26],
            iconAnchor: [13, 13],
          });
          L.marker([dest.lat, dest.lng], { icon: homeIcon }).addTo(mapRef.current);
          if (pos) {
            mapRef.current.fitBounds(
              [
                [pos.lat, pos.lng],
                [dest.lat, dest.lng],
              ],
              { padding: [40, 40] }
            );
          } else {
            mapRef.current.setView([dest.lat, dest.lng], 15);
          }
        }
      } catch {
        // Sem geocodificação: o mapa segue mostrando só o entregador.
      }
    })();

    return () => {
      disposed = true;
      mapRef.current?.remove();
      mapRef.current = null;
      courierMarkerRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Posição ao vivo via Broadcast.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`track:${code}`)
      .on("broadcast", { event: "location" }, (msg) => {
        const p = msg.payload as { lat?: number; lng?: number };
        if (typeof p.lat === "number" && typeof p.lng === "number") {
          setPos({ lat: p.lat, lng: p.lng });
        }
      })
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [code]);

  // Move o marcador e recalcula o ETA quando a posição muda.
  useEffect(() => {
    if (!pos) return;
    const marker = courierMarkerRef.current;
    if (marker) {
      marker.setLatLng([pos.lat, pos.lng]);
      marker.setOpacity(1);
    }
    mapRef.current?.panTo([pos.lat, pos.lng]);
    const dest = destRef.current;
    if (dest) {
      const km = distanceKm(pos.lat, pos.lng, dest.lat, dest.lng);
      setEtaMin(Math.max(1, Math.round((km / Math.max(5, speedKmh)) * 60)));
    }
  }, [pos, speedKmh]);

  return (
    <div className="surface-2 mt-4 overflow-hidden rounded-xl">
      <div className="flex items-center justify-between px-4 py-2.5 text-sm">
        <span className="font-semibold">🛵 {courier.name} está a caminho</span>
        {etaMin !== null && (
          <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-bold text-green-700">
            ~{etaMin} min
          </span>
        )}
      </div>
      <div ref={containerRef} className="h-64 w-full" />
      {!pos && (
        <p className="px-4 py-2 text-center text-xs text-muted">
          Aguardando o sinal de localização do entregador...
        </p>
      )}
    </div>
  );
}
