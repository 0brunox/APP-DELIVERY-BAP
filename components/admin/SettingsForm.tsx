"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Store, StoreSettings } from "@/lib/types";
import ImageUpload from "./ImageUpload";

export default function SettingsForm({ store }: { store: Store }) {
  const router = useRouter();
  const supabase = createClient();
  const s = store.settings ?? {};

  const [name, setName] = useState(store.name);
  const [subtitle, setSubtitle] = useState(s.subtitle ?? "");
  const [logoUrl, setLogoUrl] = useState(s.logoUrl ?? "");
  const [deliveryFee, setDeliveryFee] = useState(String(s.deliveryFee ?? 0));
  const [minOrderValue, setMinOrderValue] = useState(String(s.minOrderValue ?? 0));
  const [orderTypes, setOrderTypes] = useState({
    delivery: s.orderTypes?.delivery ?? true,
    pickup: s.orderTypes?.pickup ?? true,
    dinein: s.orderTypes?.dinein ?? false,
  });
  const [pay, setPay] = useState({
    pix: s.paymentMethods?.pix ?? true,
    card: s.paymentMethods?.card ?? true,
    cash: s.paymentMethods?.cash ?? true,
  });
  const [pix, setPix] = useState({
    keyType: s.pix?.keyType ?? "telefone",
    key: s.pix?.key ?? "",
    holder: s.pix?.holder ?? "",
  });
  const [etaDelivery, setEtaDelivery] = useState(s.estimatedTime?.delivery ?? "");
  const [etaPickup, setEtaPickup] = useState(s.estimatedTime?.pickup ?? "");
  const [enableScheduling, setEnableScheduling] = useState(s.enableScheduling ?? false);

  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  async function save() {
    setMsg(null);
    if (!name.trim()) return setMsg({ type: "err", text: "Informe o nome da loja." });
    if (!orderTypes.delivery && !orderTypes.pickup && !orderTypes.dinein)
      return setMsg({ type: "err", text: "Ative pelo menos um tipo de pedido." });
    if (!pay.pix && !pay.card && !pay.cash)
      return setMsg({ type: "err", text: "Ative pelo menos uma forma de pagamento." });

    const settings: StoreSettings = {
      ...s,
      subtitle: subtitle.trim(),
      logoUrl: logoUrl.trim(),
      deliveryFee: parseFloat(deliveryFee) || 0,
      minOrderValue: parseFloat(minOrderValue) || 0,
      orderTypes,
      paymentMethods: pay,
      pix: { keyType: pix.keyType, key: pix.key.trim(), holder: pix.holder.trim() },
      estimatedTime: { delivery: etaDelivery.trim(), pickup: etaPickup.trim() },
      enableScheduling,
    };

    setSaving(true);
    const { error } = await supabase.from("stores").update({ name: name.trim(), settings }).eq("id", store.id);
    setSaving(false);
    if (error) return setMsg({ type: "err", text: "Não foi possível salvar." });
    setMsg({ type: "ok", text: "Configurações salvas!" });
    router.refresh();
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-4 text-lg font-bold">🏪 Dados da loja</h2>

      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nome da loja"><input className={inp} value={name} onChange={(e) => setName(e.target.value)} /></Field>
        <Field label="Endereço (slug)"><input className={`${inp} opacity-60`} value={`/${store.slug}`} readOnly title="O endereço é definido na criação da loja." /></Field>
      </div>
      <Field label="Subtítulo"><input className={inp} value={subtitle} onChange={(e) => setSubtitle(e.target.value)} placeholder="Delivery rápido e saboroso!" /></Field>
      <Field label="Logo da loja (opcional)"><ImageUpload value={logoUrl} onChange={setLogoUrl} storeId={store.id} /></Field>

      <h3 className="mb-2 mt-5 font-bold">🛵 Entrega</h3>
      <Field label="Tipos de pedido">
        <div className="flex flex-col gap-1.5">
          <Toggle checked={orderTypes.delivery} onChange={(v) => setOrderTypes({ ...orderTypes, delivery: v })} label="🛵 Entrega (delivery)" />
          <Toggle checked={orderTypes.pickup} onChange={(v) => setOrderTypes({ ...orderTypes, pickup: v })} label="🏪 Retirada no local" />
          <Toggle checked={orderTypes.dinein} onChange={(v) => setOrderTypes({ ...orderTypes, dinein: v })} label="🍽️ Consumo no local (mesa)" />
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Taxa de entrega padrão (R$)"><input type="number" step="0.01" min="0" className={inp} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} /></Field>
        <Field label="Pedido mínimo p/ entrega (R$)"><input type="number" step="0.01" min="0" className={inp} value={minOrderValue} onChange={(e) => setMinOrderValue(e.target.value)} /></Field>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Tempo estimado de entrega"><input className={inp} value={etaDelivery} onChange={(e) => setEtaDelivery(e.target.value)} placeholder="30–45 min" /></Field>
        <Field label="Tempo estimado de retirada"><input className={inp} value={etaPickup} onChange={(e) => setEtaPickup(e.target.value)} placeholder="15–25 min" /></Field>
      </div>

      <h3 className="mb-2 mt-5 font-bold">💳 Pagamento</h3>
      <Field label="Formas aceitas">
        <div className="flex flex-col gap-1.5">
          <Toggle checked={pay.pix} onChange={(v) => setPay({ ...pay, pix: v })} label="📱 PIX" />
          <Toggle checked={pay.card} onChange={(v) => setPay({ ...pay, card: v })} label="💳 Cartão na entrega" />
          <Toggle checked={pay.cash} onChange={(v) => setPay({ ...pay, cash: v })} label="💵 Dinheiro" />
        </div>
      </Field>
      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="Tipo de chave PIX">
          <select className={inp} value={pix.keyType} onChange={(e) => setPix({ ...pix, keyType: e.target.value })}>
            <option value="telefone">Telefone</option>
            <option value="cpf">CPF</option>
            <option value="cnpj">CNPJ</option>
            <option value="email">E-mail</option>
            <option value="aleatoria">Aleatória</option>
          </select>
        </Field>
        <Field label="Chave PIX"><input className={inp} value={pix.key} onChange={(e) => setPix({ ...pix, key: e.target.value })} /></Field>
        <Field label="Recebedor (PIX)"><input className={inp} value={pix.holder} onChange={(e) => setPix({ ...pix, holder: e.target.value })} /></Field>
      </div>

      <h3 className="mb-2 mt-5 font-bold">⏰ Agendamento</h3>
      <Toggle checked={enableScheduling} onChange={setEnableScheduling} label="Permitir que o cliente agende o pedido" />

      {msg && (
        <p className={`mt-4 rounded-lg p-2.5 text-sm font-semibold ${msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"}`}>{msg.text}</p>
      )}
      <button onClick={save} disabled={saving} className="mt-4 rounded-xl bg-primary px-6 py-3 font-semibold text-white disabled:opacity-60">
        {saving ? "Salvando..." : "💾 Salvar configurações"}
      </button>
    </section>
  );
}

const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="mb-3">
      <label className="mb-1 block text-xs font-bold uppercase tracking-wide text-muted">{label}</label>
      {children}
    </div>
  );
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <label className="surface-2 flex cursor-pointer items-center gap-2.5 rounded-lg p-2 text-sm">
      <input type="checkbox" className="h-[18px] w-[18px] accent-[var(--primary)]" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      {label}
    </label>
  );
}
