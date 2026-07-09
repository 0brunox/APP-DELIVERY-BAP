"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Review } from "@/lib/types";

function stars(n: number) {
  return "⭐".repeat(n) + "☆".repeat(5 - n);
}

export default function ReviewsManager({ initialReviews }: { initialReviews: Review[] }) {
  const router = useRouter();
  const supabase = createClient();
  const [reviews, setReviews] = useState<Review[]>(initialReviews);
  const [busy, setBusy] = useState<string | null>(null);

  const approved = useMemo(() => reviews.filter((r) => r.approved), [reviews]);
  const avg = approved.length
    ? (approved.reduce((s, r) => s + r.rating, 0) / approved.length).toFixed(1)
    : "0.0";

  async function toggle(r: Review) {
    setBusy(r.id);
    setReviews((prev) => prev.map((x) => (x.id === r.id ? { ...x, approved: !x.approved } : x)));
    await supabase.from("reviews").update({ approved: !r.approved }).eq("id", r.id);
    setBusy(null);
    router.refresh();
  }

  async function remove(r: Review) {
    if (!confirm("Excluir esta avaliação permanentemente?")) return;
    setBusy(r.id);
    setReviews((prev) => prev.filter((x) => x.id !== r.id));
    await supabase.from("reviews").delete().eq("id", r.id);
    setBusy(null);
    router.refresh();
  }

  if (reviews.length === 0) {
    return (
      <div className="surface-2 rounded-2xl py-12 text-center text-muted">
        <div className="mb-2 text-4xl opacity-40">💬</div>
        <p>Nenhuma avaliação ainda. Elas aparecem quando o cliente avalia um pedido concluído.</p>
      </div>
    );
  }

  return (
    <div>
      <div className="surface bordered mb-4 flex items-center gap-4 rounded-2xl p-4">
        <div className="text-3xl font-extrabold text-primary">{avg}</div>
        <div className="text-sm text-muted">
          Nota média · <strong>{approved.length}</strong> avaliaç{approved.length === 1 ? "ão" : "ões"} pública
          {approved.length === 1 ? "" : "s"}
        </div>
      </div>

      <div className="space-y-3">
        {reviews.map((r) => (
          <div key={r.id} className={`surface-2 rounded-xl p-4 ${r.approved ? "" : "opacity-60"}`}>
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-sm">{stars(r.rating)}</div>
                <div className="text-xs text-muted">
                  {r.author || "Cliente"} ·{" "}
                  {new Date(r.created_at).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" })}
                  {!r.approved && (
                    <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold">OCULTA</span>
                  )}
                </div>
              </div>
              <div className="flex shrink-0 gap-1.5">
                <button
                  onClick={() => toggle(r)}
                  disabled={busy === r.id}
                  className="rounded-lg border-2 border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                >
                  {r.approved ? "🙈 Ocultar" : "👁️ Exibir"}
                </button>
                <button
                  onClick={() => remove(r)}
                  disabled={busy === r.id}
                  className="rounded-lg px-2 py-1 text-xs hover:bg-[var(--surface)]"
                  title="Excluir"
                >
                  🗑️
                </button>
              </div>
            </div>
            {r.comment && <p className="mt-2 text-sm">{r.comment}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}
