// Integração com Mercado Pago Assinaturas (Preapproval) — só no servidor.
import "server-only";
import { createClient } from "@supabase/supabase-js";

const MP_API = "https://api.mercadopago.com";

/** Preço mensal do plano Pro, em reais (configurável). */
export const PRO_PRICE = Number(process.env.MP_PRO_PRICE || 49.9);

export function mpConfigured(): boolean {
  return Boolean(process.env.MP_ACCESS_TOKEN);
}

function mpToken(): string {
  return process.env.MP_ACCESS_TOKEN!;
}

/**
 * Cliente Supabase com a SERVICE ROLE — ignora RLS. Usado APENAS pelo webhook
 * (server-only) para atualizar o plano da loja após o Mercado Pago confirmar.
 * Nunca exponha essa chave ao cliente.
 */
export function supabaseService() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false } }
  );
}

export function serviceConfigured(): boolean {
  return Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY && process.env.NEXT_PUBLIC_SUPABASE_URL);
}

interface Preapproval {
  id: string;
  status: "pending" | "authorized" | "paused" | "cancelled";
  init_point?: string;
  external_reference?: string;
  payer_email?: string;
}

/** Cria uma assinatura (preapproval) e devolve o link de checkout (init_point). */
export async function createPreapproval(params: {
  storeId: string;
  payerEmail: string;
  backUrl: string;
}): Promise<Preapproval> {
  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${mpToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: "Plano Pro — Delivery Super App",
      external_reference: params.storeId,
      payer_email: params.payerEmail,
      back_url: params.backUrl,
      status: "pending",
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: PRO_PRICE,
        currency_id: "BRL",
      },
    }),
  });
  if (!res.ok) {
    throw new Error(`MP preapproval failed: ${res.status} ${await res.text()}`);
  }
  return (await res.json()) as Preapproval;
}

/** Lê uma assinatura pelo id (fonte da verdade — usada no webhook). */
export async function getPreapproval(id: string): Promise<Preapproval | null> {
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    headers: { Authorization: `Bearer ${mpToken()}` },
  });
  if (!res.ok) return null;
  return (await res.json()) as Preapproval;
}

/** Cancela uma assinatura. */
export async function cancelPreapproval(id: string): Promise<boolean> {
  const res = await fetch(`${MP_API}/preapproval/${id}`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${mpToken()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ status: "cancelled" }),
  });
  return res.ok;
}

/** URL pública base a partir dos headers da requisição (respeita proxy da Vercel). */
export function baseUrlFrom(headers: Headers): string {
  const env = process.env.NEXT_PUBLIC_SITE_URL;
  if (env) return env.replace(/\/$/, "");
  const host = headers.get("x-forwarded-host") ?? headers.get("host") ?? "localhost:3000";
  const proto = headers.get("x-forwarded-proto") ?? (host.includes("localhost") ? "http" : "https");
  return `${proto}://${host}`;
}
