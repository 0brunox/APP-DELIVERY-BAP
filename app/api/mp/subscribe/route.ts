import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { baseUrlFrom, createPreapproval, mpConfigured } from "@/lib/mp";

export const runtime = "nodejs";

/** Lojista clica "Assinar Pro" -> cria a assinatura e devolve o link de pagamento. */
export async function POST(req: Request) {
  if (!mpConfigured()) {
    return NextResponse.json({ error: "Cobrança não configurada nesta plataforma." }, { status: 503 });
  }

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (store.plan === "pro") {
    return NextResponse.json({ error: "Sua loja já está no plano Pro." }, { status: 400 });
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email;
  if (!email) return NextResponse.json({ error: "Sessão inválida." }, { status: 401 });

  try {
    const pre = await createPreapproval({
      storeId: store.id,
      payerEmail: email,
      backUrl: `${baseUrlFrom(req.headers)}/admin/config?assinatura=ok`,
    });
    // Guarda o id para permitir cancelamento; o plano só vira Pro no webhook.
    await supabase.from("stores").update({ mp_preapproval_id: pre.id }).eq("id", store.id);

    if (!pre.init_point) {
      return NextResponse.json({ error: "Não foi possível iniciar o pagamento." }, { status: 502 });
    }
    return NextResponse.json({ init_point: pre.init_point });
  } catch {
    return NextResponse.json({ error: "Não foi possível iniciar a assinatura agora." }, { status: 502 });
  }
}
