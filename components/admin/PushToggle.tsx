"use client";

import { useEffect, useState } from "react";
import { enablePush, pushSupported } from "@/lib/push";

/** Botão do lojista para ativar as notificações de novo pedido (push). */
export default function PushToggle({ storeId }: { storeId: string }) {
  const [supported, setSupported] = useState(true);
  const [perm, setPerm] = useState<NotificationPermission>("default");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  useEffect(() => {
    const ok = pushSupported();
    setSupported(ok);
    if (ok) setPerm(Notification.permission);
  }, []);

  if (!supported) return null;

  async function enable() {
    setErr("");
    setBusy(true);
    try {
      await enablePush({ storeId, scope: "owner" });
      setPerm("granted");
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Erro ao ativar.");
    } finally {
      setBusy(false);
    }
  }

  if (perm === "granted") {
    return (
      <span
        className="inline-flex items-center gap-1 rounded-lg bg-green-100 px-2.5 py-1 text-[11px] font-bold text-green-700"
        title="Você recebe notificação de novos pedidos, mesmo com o painel fechado."
      >
        🔔 Notificações ativas
      </span>
    );
  }

  return (
    <button
      onClick={enable}
      disabled={busy || perm === "denied"}
      className="rounded-lg border-2 border-primary px-2.5 py-1 text-[11px] font-bold text-primary transition hover:bg-primary hover:text-white disabled:opacity-50"
      title={
        perm === "denied"
          ? "Notificações bloqueadas nas permissões do navegador."
          : err || "Receber notificação de novos pedidos."
      }
    >
      {busy ? "Ativando..." : perm === "denied" ? "🔕 Bloqueado" : "🔔 Ativar notificações"}
    </button>
  );
}
