"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { DeliveryZone, Store } from "@/lib/types";
import { brl } from "@/lib/format";
import { createClient } from "@/lib/supabase/client";
import { addLocalOrder } from "@/lib/localOrders";
import { useCart } from "./CartContext";
import OrderTimeline from "./OrderTimeline";

type OrderType = "delivery" | "pickup" | "dinein";
type Payment = "pix" | "credit" | "debit";

interface FormState {
  orderType: OrderType;
  payment: Payment;
  name: string;
  phone: string;
  cep: string;
  street: string;
  number: string;
  complement: string;
  reference: string;
  zoneId: string;
  neighborhood: string;
  tableNumber: string;
  scheduleMode: "now" | "later";
  scheduleAt: string;
}

interface PlacedOrder {
  number: number;
  code: string;
  total: number;
}

const ORDER_TYPE_META: Record<OrderType, { icon: string; label: string }> = {
  delivery: { icon: "🛵", label: "Entrega" },
  pickup: { icon: "🏪", label: "Retirada" },
  dinein: { icon: "🍽️", label: "Mesa" },
};
const PAYMENT_META: Record<Payment, { icon: string; label: string }> = {
  pix: { icon: "📱", label: "PIX" },
  credit: { icon: "💳", label: "Cartão de crédito" },
  debit: { icon: "💳", label: "Cartão de débito" },
};

export default function CheckoutModal({
  store,
  zones,
  onClose,
  initialTable,
}: {
  store: Store;
  zones: DeliveryZone[];
  onClose: () => void;
  initialTable?: string;
}) {
  const { cart, subtotal, clear } = useCart();
  const settings = store.settings ?? {};
  const supabase = useMemo(() => createClient(), []);

  const enabledTypes = (["delivery", "pickup", "dinein"] as OrderType[]).filter(
    (t) => settings.orderTypes?.[t]
  );
  // Lojas antigas podem ter só {pix, card, cash}: "card" habilita crédito e débito.
  const pm = settings.paymentMethods ?? {};
  const enabledPays = (["credit", "debit", "pix"] as Payment[]).filter((p) => {
    if (pm[p] !== undefined) return pm[p];
    return p === "pix" ? true : (pm.card ?? true);
  });

  const [form, setForm] = useState<FormState>(() => {
    let saved: Partial<FormState> = {};
    try {
      saved = JSON.parse(localStorage.getItem(`customer:${store.slug}`) || "{}");
    } catch {
      /* ignora */
    }
    return {
      orderType: initialTable ? "dinein" : enabledTypes[0] ?? "delivery",
      payment: enabledPays[0] ?? "credit",
      name: saved.name ?? "",
      phone: saved.phone ?? "",
      cep: saved.cep ?? "",
      street: saved.street ?? "",
      number: saved.number ?? "",
      complement: saved.complement ?? "",
      reference: saved.reference ?? "",
      zoneId: saved.zoneId ?? "",
      neighborhood: saved.neighborhood ?? "",
      tableNumber: initialTable ?? "",
      scheduleMode: "now",
      scheduleAt: "",
    };
  });
  const [couponInput, setCouponInput] = useState("");
  const [appliedCoupon, setAppliedCoupon] = useState<{ code: string; discount: number } | null>(null);
  const [cepLoading, setCepLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  const fee = useMemo<number | null>(() => {
    if (form.orderType !== "delivery") return 0;
    if (zones.length) {
      const z = zones.find((z) => z.id === form.zoneId);
      return z ? z.fee : null; // null = bairro ainda não escolhido
    }
    return settings.deliveryFee ?? 0;
  }, [form.orderType, form.zoneId, zones, settings.deliveryFee]);

  const discount = appliedCoupon?.discount ?? 0;
  const total = Math.max(0, subtotal - discount) + (fee ?? 0);
  const minOrder = settings.minOrderValue ?? 0;
  const belowMin = form.orderType === "delivery" && minOrder > 0 && subtotal < minOrder;

  async function lookupCEP() {
    const cep = form.cep.replace(/\D/g, "");
    if (cep.length !== 8) {
      setError("CEP inválido: digite os 8 dígitos.");
      return;
    }
    setCepLoading(true);
    setError("");
    try {
      const res = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
      const data = await res.json();
      if (data.erro) {
        setError("CEP não encontrado.");
        return;
      }
      setForm((f) => {
        const next = { ...f, cep, street: data.logradouro || f.street };
        if (zones.length) {
          const match = zones.find(
            (z) => z.name.toLowerCase() === String(data.bairro || "").toLowerCase()
          );
          next.zoneId = match ? match.id : "";
          if (!match && data.bairro) setError(`Não temos taxa para "${data.bairro}". Escolha seu bairro na lista.`);
        } else {
          next.neighborhood = data.bairro || f.neighborhood;
        }
        return next;
      });
    } catch {
      setError("Não foi possível consultar o CEP. Preencha o endereço manualmente.");
    } finally {
      setCepLoading(false);
    }
  }

  async function applyCoupon() {
    const code = couponInput.trim();
    if (!code) return;
    const { data, error: rpcError } = await supabase.rpc("validate_coupon", {
      p_store: store.id,
      p_code: code,
      p_subtotal: subtotal,
    });
    if (rpcError) {
      setError("Não foi possível validar o cupom agora.");
      return;
    }
    if (!data?.ok) {
      setError(data?.reason ?? "Cupom inválido.");
      return;
    }
    setAppliedCoupon({ code: data.code, discount: data.discount });
    setCouponInput("");
    setError("");
  }

  async function submit() {
    setError("");
    if (cart.length === 0) return;

    const name = form.name.trim();
    if (!name) return setError("Informe seu nome.");
    const phone = form.phone.replace(/\D/g, "");
    if (phone.length < 10 || phone.length > 15) return setError("Telefone inválido (DDD + número).");

    let neighborhood = form.neighborhood;
    if (form.orderType === "delivery") {
      if (!form.street.trim()) return setError("Informe a rua.");
      if (!form.number.trim()) return setError("Informe o número.");
      if (zones.length) {
        const z = zones.find((z) => z.id === form.zoneId);
        if (!z) return setError("Selecione seu bairro.");
        neighborhood = z.name;
      }
      if (belowMin) return setError(`Pedido mínimo para entrega: ${brl(minOrder)}.`);
    }
    if (form.orderType === "dinein" && !form.tableNumber.trim()) return setError("Informe o número da mesa.");

    let scheduleAt = "";
    if (settings.enableScheduling && form.scheduleMode === "later") {
      if (!form.scheduleAt) return setError("Escolha a data e hora do agendamento.");
      const when = new Date(form.scheduleAt);
      if (isNaN(when.getTime()) || when < new Date()) return setError("Agende para um horário futuro.");
      scheduleAt = when.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
    }

    setSubmitting(true);
    // Os preços são recalculados no servidor a partir do product_id.
    const p_items = cart.map((l) => ({
      product_id: l.productId,
      name: l.name,
      variation_name: l.variationName,
      addons: l.addons,
      note: l.note,
      quantity: l.quantity,
    }));
    const p_order = {
      order_type: form.orderType,
      customer: {
        name,
        phone,
        street: form.street,
        number: form.number,
        complement: form.complement,
        reference: form.reference,
        cep: form.cep,
        neighborhood,
        tableNumber: form.tableNumber,
      },
      payment: form.payment,
      change_for: "",
      coupon: appliedCoupon ? { code: appliedCoupon.code } : null,
      schedule_at: scheduleAt,
      zone_id: form.orderType === "delivery" ? form.zoneId : "",
    };

    const { data, error: rpcError } = await supabase.rpc("place_order", {
      p_store: store.id,
      p_order,
      p_items,
    });
    setSubmitting(false);

    if (rpcError || !data?.code) {
      const m = rpcError?.message ?? "";
      if (m.includes("LOJA_SUSPENSA")) {
        setError("Esta loja não está aceitando pedidos no momento.");
      } else if (m.includes("LIMITE_PLANO_PEDIDOS")) {
        setError("A loja atingiu o limite de pedidos deste mês. Tente novamente mais tarde.");
      } else {
        setError("Não foi possível registrar o pedido. Tente novamente.");
      }
      return;
    }

    // Salva os dados do cliente para a próxima compra
    try {
      localStorage.setItem(
        `customer:${store.slug}`,
        JSON.stringify({
          name,
          phone,
          cep: form.cep,
          street: form.street,
          number: form.number,
          complement: form.complement,
          reference: form.reference,
          zoneId: form.zoneId,
          neighborhood,
        })
      );
    } catch {
      /* ignora */
    }

    // Guarda no histórico local (permite reencontrar o acompanhamento mesmo sem login).
    addLocalOrder(store.slug, {
      code: data.code,
      number: data.number,
      total: data.total,
      orderType: form.orderType,
      createdAt: new Date().toISOString(),
    });

    clear();
    setPlaced({ number: data.number, code: data.code, total: data.total });

    // Avisa o lojista por push (não bloqueia a confirmação se falhar).
    fetch("/api/push/new-order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ storeId: store.id, code: data.code }),
    }).catch(() => {});
  }

  // ===== Tela de confirmação =====
  if (placed) {
    const eta =
      form.orderType === "delivery"
        ? settings.estimatedTime?.delivery
        : settings.estimatedTime?.pickup;
    const trackUrl = `/${store.slug}/pedido/${placed.code}`;
    return (
      <Overlay onClose={onClose}>
        <div className="p-6 text-center">
          <div className="mx-auto mb-3 flex h-16 w-16 items-center justify-center rounded-full bg-green-500 text-4xl text-white">
            ✓
          </div>
          <h2 className="text-2xl font-bold">Pedido confirmado!</h2>
          <p className="mb-1 text-muted">Recebemos seu pedido e já estamos cuidando dele.</p>
          <div className="my-3 text-4xl font-extrabold text-primary">#{placed.number}</div>
          {eta && <p className="mb-3 text-sm text-muted">⏱️ Previsão: {eta}</p>}

          <div className="surface-2 mb-4 rounded-xl p-4 text-left">
            <OrderTimeline status="received" orderType={form.orderType} />
          </div>

          <div className="surface-2 mb-4 flex items-center justify-between rounded-xl p-3 text-left">
            <div>
              <div className="text-xs text-muted">Código de acompanhamento</div>
              <div className="font-mono text-lg font-bold">{placed.code}</div>
            </div>
            <div className="text-right">
              <div className="text-xs text-muted">Total</div>
              <div className="font-bold">{brl(placed.total)}</div>
            </div>
          </div>

          <div className="mb-4 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-left text-sm text-muted">
            🤝 <strong>Pagamento na {form.orderType === "delivery" ? "entrega" : "retirada"}:</strong>{" "}
            {PAYMENT_META[form.payment]?.label ?? form.payment} na maquininha.
          </div>

          <Link
            href={trackUrl}
            className="mb-2 block w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark"
          >
            📦 Acompanhar meu pedido
          </Link>
          <button
            onClick={onClose}
            className="w-full rounded-xl border-2 border-[var(--border)] py-2.5 font-semibold text-muted transition hover:border-primary hover:text-primary"
          >
            Fazer novo pedido
          </button>
        </div>
      </Overlay>
    );
  }

  // ===== Formulário de checkout =====
  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h2 className="text-xl font-bold">Finalizar pedido</h2>
        <button onClick={onClose} aria-label="Fechar" className="text-2xl text-muted hover:text-[var(--text)]">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {/* Tipo de pedido */}
        {enabledTypes.length > 1 && (
          <Section title="Tipo de pedido">
            <div className="flex gap-2">
              {enabledTypes.map((t) => (
                <button
                  key={t}
                  onClick={() => set("orderType", t)}
                  className={`flex-1 rounded-xl border-2 py-2.5 text-sm font-semibold transition ${
                    form.orderType === t ? "border-primary bg-[var(--surface-2)] text-primary" : "border-[var(--border)] text-muted"
                  }`}
                >
                  <span className="block text-lg">{ORDER_TYPE_META[t].icon}</span>
                  {ORDER_TYPE_META[t].label}
                </button>
              ))}
            </div>
          </Section>
        )}

        {/* Dados */}
        <Section title="Seus dados">
          <Input value={form.name} onChange={(v) => set("name", v)} placeholder="Nome completo *" />
          <Input value={form.phone} onChange={(v) => set("phone", v)} placeholder="Telefone (ex: 21999999999) *" type="tel" />
        </Section>

        {/* Endereço / Mesa */}
        {form.orderType === "delivery" && (
          <Section title="Endereço de entrega">
            <div className="flex gap-2">
              <Input value={form.cep} onChange={(v) => set("cep", v)} placeholder="CEP" />
              <button
                onClick={lookupCEP}
                disabled={cepLoading}
                className="shrink-0 rounded-lg bg-[var(--text)] px-4 text-sm font-semibold text-[var(--surface)] disabled:opacity-60"
              >
                {cepLoading ? "..." : "Buscar"}
              </button>
            </div>
            <Input value={form.street} onChange={(v) => set("street", v)} placeholder="Rua / Logradouro *" />
            <div className="flex gap-2">
              <Input value={form.number} onChange={(v) => set("number", v)} placeholder="Nº *" className="w-28" />
              <Input value={form.complement} onChange={(v) => set("complement", v)} placeholder="Complemento" />
            </div>
            <Input value={form.reference} onChange={(v) => set("reference", v)} placeholder="Ponto de referência" />
            {zones.length > 0 ? (
              <select
                value={form.zoneId}
                onChange={(e) => set("zoneId", e.target.value)}
                className="surface w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
              >
                <option value="">Selecione o bairro *</option>
                {zones.map((z) => (
                  <option key={z.id} value={z.id}>
                    {z.name} — {brl(z.fee)}
                  </option>
                ))}
              </select>
            ) : (
              <Input value={form.neighborhood} onChange={(v) => set("neighborhood", v)} placeholder="Bairro" />
            )}
          </Section>
        )}
        {form.orderType === "dinein" && (
          <Section title="Mesa">
            <Input value={form.tableNumber} onChange={(v) => set("tableNumber", v)} placeholder="Número da mesa *" />
          </Section>
        )}
        {form.orderType === "pickup" && (
          <p className="mb-4 text-sm text-muted">🏪 Você retira o pedido no balcão. Avisaremos quando estiver pronto.</p>
        )}

        {/* Agendamento */}
        {settings.enableScheduling && (
          <Section title="Quando">
            <div className="flex gap-2">
              {(["now", "later"] as const).map((m) => (
                <button
                  key={m}
                  onClick={() => set("scheduleMode", m)}
                  className={`flex-1 rounded-xl border-2 py-2 text-sm font-semibold transition ${
                    form.scheduleMode === m ? "border-primary bg-[var(--surface-2)] text-primary" : "border-[var(--border)] text-muted"
                  }`}
                >
                  {m === "now" ? "Assim que possível" : "Agendar"}
                </button>
              ))}
            </div>
            {form.scheduleMode === "later" && (
              <input
                type="datetime-local"
                value={form.scheduleAt}
                onChange={(e) => set("scheduleAt", e.target.value)}
                className="surface mt-2 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
              />
            )}
          </Section>
        )}

        {/* Pagamento */}
        <Section title="Pagamento">
          <div className="flex flex-col gap-2">
            {enabledPays.map((p) => (
              <label
                key={p}
                className={`flex cursor-pointer items-center gap-3 rounded-xl border-2 p-2.5 text-sm transition ${
                  form.payment === p ? "border-primary bg-[var(--surface-2)]" : "border-[var(--border)]"
                }`}
              >
                <input
                  type="radio"
                  name="payment"
                  className="h-[18px] w-[18px] accent-[var(--primary)]"
                  checked={form.payment === p}
                  onChange={() => set("payment", p)}
                />
                <span>{PAYMENT_META[p].icon} {PAYMENT_META[p].label}</span>
              </label>
            ))}
          </div>
          <div className="mt-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] p-3 text-sm text-muted">
            {form.orderType === "delivery"
              ? "🤝 Você paga na hora da entrega: o entregador leva a maquininha (crédito, débito ou PIX)."
              : "🤝 Você paga na loja ao receber o pedido, na maquininha (crédito, débito ou PIX)."}
          </div>
        </Section>

        {/* Cupom */}
        <Section title="Cupom">
          {appliedCoupon ? (
            <div className="flex items-center justify-between rounded-xl border border-green-300 bg-green-50 p-2.5 text-sm font-semibold text-green-800">
              <span>🎟️ {appliedCoupon.code} — {brl(appliedCoupon.discount)} off</span>
              <button onClick={() => setAppliedCoupon(null)} className="text-red-500">✕</button>
            </div>
          ) : (
            <div className="flex gap-2">
              <Input value={couponInput} onChange={setCouponInput} placeholder="Código do cupom" />
              <button onClick={applyCoupon} className="shrink-0 rounded-lg bg-primary px-4 text-sm font-semibold text-white">
                Aplicar
              </button>
            </div>
          )}
        </Section>

        {belowMin && (
          <div className="mb-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            ⚠️ Pedido mínimo para entrega: {brl(minOrder)}. Faltam {brl(minOrder - subtotal)}.
          </div>
        )}
        {error && <p className="mb-3 rounded-lg bg-red-50 p-3 text-sm font-semibold text-red-600">{error}</p>}
      </div>

      {/* Resumo + confirmar */}
      <div className="surface-2 border-t border-[var(--border)] p-4">
        <div className="mb-1 flex justify-between text-sm text-muted">
          <span>Subtotal</span>
          <span>{brl(subtotal)}</span>
        </div>
        {discount > 0 && (
          <div className="mb-1 flex justify-between text-sm font-semibold text-green-600">
            <span>Desconto</span>
            <span>- {brl(discount)}</span>
          </div>
        )}
        {form.orderType === "delivery" && (
          <div className="mb-1 flex justify-between text-sm text-muted">
            <span>Entrega</span>
            <span>{fee === null ? "escolha o bairro" : brl(fee)}</span>
          </div>
        )}
        <div className="mb-3 flex justify-between text-lg font-bold">
          <span>Total</span>
          <span>{brl(total)}</span>
        </div>
        <button
          onClick={submit}
          disabled={submitting || belowMin || (form.orderType === "delivery" && fee === null)}
          className="w-full rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark disabled:cursor-not-allowed disabled:opacity-50"
        >
          {submitting ? "Enviando..." : "Confirmar pedido"}
        </button>
      </div>
    </Overlay>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface flex max-h-[94vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl">
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mb-4">
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{title}</div>
      <div className="flex flex-col gap-2">{children}</div>
    </div>
  );
}

function Input({
  value,
  onChange,
  placeholder,
  type = "text",
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={`surface w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary ${className}`}
    />
  );
}
