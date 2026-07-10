import { NextResponse } from "next/server";
import { getPreapproval, mpConfigured, serviceConfigured, supabaseService } from "@/lib/mp";

export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago. Recebe a notificação, LÊ a assinatura direto na API
 * do MP (fonte da verdade, autenticada com o nosso token) e ajusta o plano da
 * loja. Como só agimos sobre dados buscados no MP com a nossa credencial, uma
 * notificação forjada não consegue nos fazer marcar Pro sem uma assinatura real.
 *
 * Configure a URL deste endpoint no painel do Mercado Pago
 * (Suas integrações -> Webhooks), tópico "Assinaturas".
 */
export async function POST(req: Request) {
  // Sempre responde 200 para o MP não reenfileirar indefinidamente.
  const ok = () => NextResponse.json({ ok: true });
  if (!mpConfigured() || !serviceConfigured()) return ok();

  // O id da assinatura pode vir no corpo ou na query, dependendo do evento.
  let type = "";
  let id = "";
  try {
    const body = (await req.json()) as { type?: string; action?: string; data?: { id?: string } };
    type = body.type ?? body.action ?? "";
    id = body.data?.id ?? "";
  } catch {
    /* sem corpo JSON */
  }
  const url = new URL(req.url);
  type = type || url.searchParams.get("type") || url.searchParams.get("topic") || "";
  id = id || url.searchParams.get("data.id") || url.searchParams.get("id") || "";

  // Só tratamos eventos de assinatura (preapproval).
  if (!id || !type.includes("preapproval")) return ok();

  const pre = await getPreapproval(id);
  if (!pre?.external_reference) return ok();

  const supabase = supabaseService();
  const storeId = pre.external_reference;

  if (pre.status === "authorized") {
    // Ativa o Pro (marca plan_since se ainda não era Pro).
    const { data: store } = await supabase.from("stores").select("plan").eq("id", storeId).maybeSingle();
    await supabase
      .from("stores")
      .update({
        plan: "pro",
        mp_preapproval_id: id,
        ...(store?.plan !== "pro" ? { plan_since: new Date().toISOString() } : {}),
      })
      .eq("id", storeId);
  } else if (pre.status === "cancelled" || pre.status === "paused") {
    // Assinatura encerrada/pausada -> volta para Free.
    await supabase.from("stores").update({ plan: "free" }).eq("id", storeId);
  }

  return ok();
}

// O MP às vezes valida o endpoint com um GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
