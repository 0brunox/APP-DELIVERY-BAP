"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Seção de assinatura Pro no painel do lojista. */
export default function Subscription({
  plan,
  price,
  configured,
}: {
  plan: "free" | "pro";
  price: number;
  configured: boolean;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const priceLabel = price.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

  async function subscribe() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mp/subscribe", { method: "POST" });
      const data = await res.json();
      if (!res.ok || !data.init_point) {
        setError(data.error ?? "Não foi possível iniciar a assinatura.");
        setBusy(false);
        return;
      }
      // Vai para o checkout do Mercado Pago.
      window.location.href = data.init_point;
    } catch {
      setError("Não foi possível iniciar a assinatura.");
      setBusy(false);
    }
  }

  async function cancel() {
    if (!confirm("Cancelar a assinatura Pro? Sua loja volta ao plano Free.")) return;
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mp/cancel", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Não foi possível cancelar.");
        setBusy(false);
        return;
      }
      router.refresh();
    } catch {
      setError("Não foi possível cancelar.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">⭐ Plano da loja</h2>

      {plan === "pro" ? (
        <>
          <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-amber-100 px-3 py-1 text-sm font-bold text-amber-800">
            ⭐ Plano Pro ativo
          </div>
          <p className="mb-4 text-sm text-muted">
            Produtos e pedidos ilimitados. Obrigado por assinar! A cobrança de {priceLabel}/mês é feita
            automaticamente pelo Mercado Pago.
          </p>
          {configured && (
            <button
              onClick={cancel}
              disabled={busy}
              className="rounded-xl border-2 border-red-500 px-4 py-2.5 text-sm font-semibold text-red-500 transition hover:bg-red-500 hover:text-white disabled:opacity-60"
            >
              {busy ? "..." : "Cancelar assinatura"}
            </button>
          )}
        </>
      ) : (
        <>
          <p className="mb-3 text-sm text-muted">
            Você está no <strong>plano Free</strong> (até 30 produtos e 100 pedidos/mês). Passe para o
            <strong> Pro</strong> e tenha produtos e pedidos ilimitados.
          </p>
          <div className="surface-2 mb-4 rounded-xl p-4">
            <div className="text-2xl font-extrabold text-primary">{priceLabel}<span className="text-base font-semibold text-muted">/mês</span></div>
            <ul className="mt-2 space-y-1 text-sm text-muted">
              <li>✓ Produtos ilimitados</li>
              <li>✓ Pedidos ilimitados por mês</li>
              <li>✓ Cancele quando quiser</li>
            </ul>
          </div>
          {configured ? (
            <button
              onClick={subscribe}
              disabled={busy}
              className="rounded-xl bg-primary px-6 py-3 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
            >
              {busy ? "Abrindo pagamento..." : "⭐ Assinar Pro"}
            </button>
          ) : (
            <p className="rounded-lg bg-[var(--surface-2)] p-3 text-sm text-muted">
              A assinatura online ainda não está disponível. Fale com o suporte da plataforma para ativar o Pro.
            </p>
          )}
        </>
      )}

      {error && <p className="mt-3 rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-600">{error}</p>}
    </section>
  );
}
