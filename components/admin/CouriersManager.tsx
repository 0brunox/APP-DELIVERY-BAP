"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import type { Courier } from "@/lib/types";
import type { CourierWeekStats } from "@/app/admin/entregadores/page";

export default function CouriersManager({
  storeId,
  initialCouriers,
  weekStats,
}: {
  storeId: string;
  initialCouriers: Courier[];
  weekStats: CourierWeekStats[];
}) {
  const router = useRouter();
  const supabase = createClient();
  const [newName, setNewName] = useState("");
  const [newPhone, setNewPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [error, setError] = useState("");

  const statsById = new Map(weekStats.map((s) => [s.courier_id, s]));

  function courierUrl(c: Courier): string {
    return `${window.location.origin}/entregador/${c.token}`;
  }

  async function add() {
    const name = newName.trim();
    if (!name) return;
    setBusy(true);
    setError("");
    const { error: err } = await supabase
      .from("couriers")
      .insert({ store_id: storeId, name, phone: newPhone.replace(/\D/g, "") });
    setBusy(false);
    if (err) return setError("Não foi possível cadastrar o entregador.");
    setNewName("");
    setNewPhone("");
    router.refresh();
  }

  async function toggleActive(c: Courier) {
    await supabase.from("couriers").update({ active: !c.active }).eq("id", c.id);
    router.refresh();
  }

  async function remove(c: Courier) {
    if (!confirm(`Excluir o entregador "${c.name}"? O link dele deixa de funcionar.`)) return;
    await supabase.from("couriers").delete().eq("id", c.id);
    router.refresh();
  }

  async function copyLink(c: Courier) {
    try {
      await navigator.clipboard.writeText(courierUrl(c));
      setCopiedId(c.id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      prompt("Copie o link do entregador:", courierUrl(c));
    }
  }

  function shareWhatsApp(c: Courier) {
    const text = encodeURIComponent(
      `Olá ${c.name}! Este é o seu link de entregas — abra no celular e salve na tela inicial: ${courierUrl(c)}`
    );
    const phone = c.phone ? (c.phone.length <= 11 ? "55" + c.phone : c.phone) : "";
    window.open(phone ? `https://wa.me/${phone}?text=${text}` : `https://wa.me/?text=${text}`, "_blank");
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">🛵 Equipe de entrega</h2>
      <p className="mb-4 text-sm text-muted">
        Cada entregador recebe um <strong>link secreto</strong> — ele abre no celular, salva na tela
        inicial e pronto: vê as entregas atribuídas, avança o status e compartilha a localização.
        Sem e-mail nem senha.
      </p>

      <div className="mb-4 space-y-3">
        {initialCouriers.length === 0 && (
          <p className="text-sm text-muted">Nenhum entregador cadastrado ainda.</p>
        )}
        {initialCouriers.map((c) => {
          const s = statsById.get(c.id);
          return (
            <div key={c.id} className={`surface-2 rounded-xl p-3.5 ${c.active ? "" : "opacity-60"}`}>
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex-1">
                  <div className="font-bold">
                    {c.name}
                    {!c.active && (
                      <span className="ml-2 rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10px] font-bold text-muted">
                        INATIVO
                      </span>
                    )}
                  </div>
                  {c.phone && <div className="text-xs text-muted">📱 {c.phone}</div>}
                  <div className="mt-0.5 text-xs text-muted">
                    Últimos 7 dias: <strong>{s?.count ?? 0}</strong> entrega{(s?.count ?? 0) === 1 ? "" : "s"} ·{" "}
                    <strong>{brl(s?.fees ?? 0)}</strong> em taxas
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    onClick={() => copyLink(c)}
                    className="rounded-lg border-2 border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                    title="Copiar link de acesso do entregador"
                  >
                    {copiedId === c.id ? "✓ Copiado!" : "🔗 Copiar link"}
                  </button>
                  <button
                    onClick={() => shareWhatsApp(c)}
                    className="rounded-lg border-2 border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-green-500 hover:text-green-600"
                    title="Enviar o link pelo WhatsApp"
                  >
                    📤 WhatsApp
                  </button>
                  <button
                    onClick={() => toggleActive(c)}
                    className="rounded-lg border-2 border-[var(--border)] px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-primary hover:text-primary"
                    title={c.active ? "Desativar (o link para de funcionar)" : "Reativar"}
                  >
                    {c.active ? "⏸️ Desativar" : "▶️ Ativar"}
                  </button>
                  <button
                    onClick={() => remove(c)}
                    className="rounded-lg px-2 py-1 text-xs hover:bg-[var(--surface)]"
                    title="Excluir"
                  >
                    🗑️
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap gap-2">
        <input
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          placeholder="Nome do entregador"
          className="surface min-w-40 flex-1 rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
        />
        <input
          value={newPhone}
          onChange={(e) => setNewPhone(e.target.value)}
          type="tel"
          placeholder="Telefone (opcional)"
          className="surface w-44 rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary"
        />
        <button
          onClick={add}
          disabled={busy || !newName.trim()}
          className="shrink-0 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white disabled:opacity-60"
        >
          ➕ Cadastrar
        </button>
      </div>
      {error && <p className="mt-2 rounded-lg bg-red-50 p-2.5 text-sm font-semibold text-red-600">{error}</p>}
    </section>
  );
}
