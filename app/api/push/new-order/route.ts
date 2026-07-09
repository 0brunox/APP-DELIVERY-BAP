import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import webpush from "web-push";

export const runtime = "nodejs";

interface Target {
  endpoint: string;
  p256dh: string;
  auth: string;
}

function configured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY &&
      process.env.VAPID_PRIVATE_KEY &&
      process.env.NEXT_PUBLIC_SUPABASE_URL &&
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  );
}

export async function POST(req: Request) {
  // Sem chaves configuradas, não é erro: só não há push (o pedido já foi gravado).
  if (!configured()) return NextResponse.json({ ok: false, reason: "push-not-configured" });

  let body: { storeId?: string; code?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }
  const storeId = body.storeId;
  const code = body.code;
  if (!storeId || !code) return NextResponse.json({ ok: false }, { status: 400 });

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  // Anti-spam: só envia push se o código corresponder a um pedido real,
  // recém-criado (últimos 10 min) e ainda não aceito pelo lojista.
  const { data: order } = await supabase.rpc("get_order_by_code", {
    p_store: storeId,
    p_code: code,
  });
  if (!order || order.status !== "received") {
    return NextResponse.json({ ok: false }, { status: 403 });
  }
  const ageMs = Date.now() - new Date(order.created_at).getTime();
  if (!Number.isFinite(ageMs) || ageMs > 10 * 60 * 1000) {
    return NextResponse.json({ ok: false }, { status: 403 });
  }

  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:no-reply@sabor-express.app",
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
    process.env.VAPID_PRIVATE_KEY!
  );

  const { data: targets } = await supabase.rpc("list_push_targets", {
    p_store: storeId,
    p_scope: "owner",
    p_code: "",
  });

  const payload = JSON.stringify({
    title: "🔔 Novo pedido!",
    body: `Pedido #${order.number} chegou. Toque para abrir o painel.`,
    url: "/admin",
    tag: "new-order",
    requireInteraction: true,
  });

  await Promise.all(
    ((targets as Target[]) ?? []).map(async (t) => {
      try {
        await webpush.sendNotification(
          { endpoint: t.endpoint, keys: { p256dh: t.p256dh, auth: t.auth } },
          payload
        );
      } catch (e) {
        const status = (e as { statusCode?: number }).statusCode;
        // 404/410 = inscrição expirada/cancelada: limpa do banco.
        if (status === 404 || status === 410) {
          await supabase.rpc("delete_push_subscription", { p_endpoint: t.endpoint });
        }
      }
    })
  );

  return NextResponse.json({ ok: true, sent: ((targets as Target[]) ?? []).length });
}
