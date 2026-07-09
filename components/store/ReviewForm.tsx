"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { OrderStatus } from "@/lib/types";

/** Avaliação do pedido: aparece quando o pedido é concluído. */
export default function ReviewForm({
  storeId,
  code,
  status,
}: {
  storeId: string;
  code: string;
  status: OrderStatus;
}) {
  const [rating, setRating] = useState(0);
  const [hover, setHover] = useState(0);
  const [comment, setComment] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");
  const storageKey = `reviewed:${code}`;

  useEffect(() => {
    if (localStorage.getItem(storageKey)) setDone(true);
  }, [storageKey]);

  if (status !== "completed") return null;
  if (done) {
    return (
      <div className="mt-4 rounded-xl bg-green-50 p-4 text-center text-sm font-semibold text-green-700">
        ⭐ Obrigado pela sua avaliação!
      </div>
    );
  }

  async function submit() {
    if (rating < 1) return setError("Escolha de 1 a 5 estrelas.");
    setBusy(true);
    setError("");
    const supabase = createClient();
    const { data, error: rpcError } = await supabase.rpc("submit_review", {
      p_store: storeId,
      p_code: code,
      p_rating: rating,
      p_comment: comment.trim(),
    });
    setBusy(false);
    if (rpcError || !data?.ok) {
      setError(data?.reason ?? "Não foi possível enviar sua avaliação.");
      return;
    }
    try {
      localStorage.setItem(storageKey, "1");
    } catch {
      /* ignora */
    }
    setDone(true);
  }

  return (
    <div className="surface-2 mt-4 rounded-xl p-4">
      <div className="mb-2 text-center text-sm font-bold">Como foi seu pedido?</div>
      <div className="mb-3 flex justify-center gap-1">
        {[1, 2, 3, 4, 5].map((n) => (
          <button
            key={n}
            onClick={() => setRating(n)}
            onMouseEnter={() => setHover(n)}
            onMouseLeave={() => setHover(0)}
            aria-label={`${n} estrela${n > 1 ? "s" : ""}`}
            className="text-3xl transition-transform hover:scale-110"
          >
            <span className={(hover || rating) >= n ? "" : "opacity-30 grayscale"}>⭐</span>
          </button>
        ))}
      </div>
      <textarea
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Conte como foi (opcional)"
        rows={2}
        maxLength={500}
        className="surface mb-2 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
      />
      {error && <p className="mb-2 text-sm font-semibold text-red-600">{error}</p>}
      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Enviando..." : "Enviar avaliação"}
      </button>
    </div>
  );
}
