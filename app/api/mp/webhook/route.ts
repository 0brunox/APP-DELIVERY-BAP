import { NextResponse } from "next/server";
import {
  getAuthorizedPaymentPreapprovalId,
  getPreapproval,
  mpConfigured,
  serviceConfigured,
  supabaseService,
} from "@/lib/mp";

export const runtime = "nodejs";

/**
 * Webhook do Mercado Pago. Lê a assinatura direto na API do MP (fonte da
 * verdade, autenticada com o nosso token) e ajusta o plano da loja.
 * Logs com prefixo [mp/webhook] aparecem nos Runtime Logs da Vercel.
 */
export async function POST(req: Request) {
  const ok = () => NextResponse.json({ ok: true });

  // Identifica o evento (corpo JSON ou query, dependendo do formato do MP).
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

  console.log(`[mp/webhook] recebido type="${type}" id="${id}"`);

  if (!mpConfigured()) {
    console.warn("[mp/webhook] MP_ACCESS_TOKEN ausente — ignorando");
    return ok();
  }
  if (!serviceConfigured()) {
    console.warn("[mp/webhook] SUPABASE_SERVICE_ROLE_KEY ausente — não dá para atualizar o plano");
    return ok();
  }
  if (!id) return ok();

  // Descobre o id da assinatura (preapproval). Alguns eventos trazem um id de
  // pagamento; nesse caso resolvemos o preapproval a partir dele.
  let preapprovalId = id;
  if (!type.includes("preapproval")) {
    if (type.includes("payment")) {
      const resolved = await getAuthorizedPaymentPreapprovalId(id);
      if (!resolved) {
        console.log("[mp/webhook] pagamento sem preapproval vinculado — ignorando");
        return ok();
      }
      preapprovalId = resolved;
    } else {
      console.log(`[mp/webhook] tipo "${type}" não tratado — ignorando`);
      return ok();
    }
  }

  const pre = await getPreapproval(preapprovalId);
  console.log(`[mp/webhook] preapproval status="${pre?.status}" loja="${pre?.external_reference}"`);
  if (!pre?.external_reference) return ok();

  const supabase = supabaseService();
  const storeId = pre.external_reference;

  if (pre.status === "authorized") {
    // Sobe para Pro. Faz o update do plano SEPARADO do mp_preapproval_id, para
    // que uma coluna ausente (0010 não aplicada) não impeça a ativação.
    const { data: store } = await supabase.from("stores").select("plan").eq("id", storeId).maybeSingle();
    const patch: Record<string, unknown> = { plan: "pro" };
    if (store?.plan !== "pro") patch.plan_since = new Date().toISOString();
    const { error } = await supabase.from("stores").update(patch).eq("id", storeId);
    if (error) console.error(`[mp/webhook] erro ao ativar Pro: ${error.message}`);
    else console.log(`[mp/webhook] loja ${storeId} -> PRO`);

    const r = await supabase.from("stores").update({ mp_preapproval_id: preapprovalId }).eq("id", storeId);
    if (r.error) console.warn(`[mp/webhook] mp_preapproval_id não salvo (rode a 0010): ${r.error.message}`);
  } else if (pre.status === "cancelled" || pre.status === "paused") {
    const { error } = await supabase.from("stores").update({ plan: "free" }).eq("id", storeId);
    if (error) console.error(`[mp/webhook] erro ao voltar para Free: ${error.message}`);
    else console.log(`[mp/webhook] loja ${storeId} -> FREE (${pre.status})`);
  }

  return ok();
}

// O MP às vezes valida o endpoint com um GET.
export async function GET() {
  return NextResponse.json({ ok: true });
}
