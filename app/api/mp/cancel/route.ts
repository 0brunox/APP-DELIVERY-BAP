import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { cancelPreapproval, mpConfigured } from "@/lib/mp";

export const runtime = "nodejs";

/** Lojista cancela a assinatura Pro. O downgrade efetivo vem pelo webhook. */
export async function POST() {
  if (!mpConfigured()) {
    return NextResponse.json({ error: "Cobrança não configurada." }, { status: 503 });
  }

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!store.mp_preapproval_id) {
    return NextResponse.json({ error: "Nenhuma assinatura ativa encontrada." }, { status: 400 });
  }

  const ok = await cancelPreapproval(store.mp_preapproval_id);
  if (!ok) {
    return NextResponse.json({ error: "Não foi possível cancelar agora. Tente de novo." }, { status: 502 });
  }

  // Reflete imediatamente no painel; o webhook confirma depois.
  const supabase = await createClient();
  await supabase.from("stores").update({ plan: "free" }).eq("id", store.id);

  return NextResponse.json({ ok: true });
}
