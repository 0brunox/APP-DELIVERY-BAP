"use client";

import { createClient } from "@/lib/supabase/client";

/** O navegador suporta Web Push? */
export function pushSupported(): boolean {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const arr = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);
  return arr;
}

async function getSubscription(): Promise<PushSubscription> {
  const key = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  if (!key) throw new Error("Notificações não configuradas (chave VAPID ausente).");
  const reg = await navigator.serviceWorker.register("/sw.js");
  await navigator.serviceWorker.ready;
  const existing = await reg.pushManager.getSubscription();
  if (existing) return existing;
  return reg.pushManager.subscribe({
    userVisibleOnly: true,
    applicationServerKey: urlBase64ToUint8Array(key) as BufferSource,
  });
}

/** Pede permissão, registra o Service Worker e salva a inscrição no Supabase. */
export async function enablePush(opts: {
  storeId: string;
  scope: "owner" | "customer";
  code?: string;
}): Promise<void> {
  if (!pushSupported()) throw new Error("Seu navegador não suporta notificações.");
  const perm = await Notification.requestPermission();
  if (perm !== "granted") throw new Error("Permissão de notificação negada.");

  const sub = await getSubscription();
  const json = sub.toJSON();
  const supabase = createClient();
  const { error } = await supabase.rpc("save_push_subscription", {
    p_store: opts.storeId,
    p_scope: opts.scope,
    p_code: opts.code ?? "",
    p_endpoint: sub.endpoint,
    p_p256dh: json.keys?.p256dh ?? "",
    p_auth: json.keys?.auth ?? "",
  });
  if (error) throw new Error("Não foi possível salvar a inscrição de notificação.");
}
