import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { AI_ERRORS, AI_MODEL, aiConfigured, aiThinking, anthropic, checkAiLimit, textOf } from "@/lib/ai";
import type { Order, OrderItem } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 60;

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

/** Chat de insights: responde perguntas do lojista sobre as vendas reais. */
export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const history = (body.messages ?? []).slice(-12);
  if (history.length === 0 || history.some((m) => typeof m.content !== "string" || m.content.length > 1000)) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (!(await checkAiLimit(store.id))) return NextResponse.json(AI_ERRORS.limit, { status: 429 });

  // Resumo das vendas dos últimos 30 dias (sessão do lojista; RLS de dono).
  const supabase = await createClient();
  const since = new Date(Date.now() - 30 * 86400000).toISOString();
  const { data } = await supabase
    .from("orders")
    .select("*, order_items(*)")
    .eq("store_id", store.id)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(1000);

  const orders = ((data ?? []) as (Order & { order_items: OrderItem[] })[]);
  const valid = orders.filter((o) => o.status !== "cancelled");
  const byDay: Record<string, { orders: number; revenue: number }> = {};
  const byItem: Record<string, { qty: number; revenue: number }> = {};
  const byPayment: Record<string, number> = {};
  const byType: Record<string, number> = {};
  const byHour: Record<string, number> = {};
  for (const o of valid) {
    const day = o.created_at.slice(0, 10);
    byDay[day] = byDay[day] ?? { orders: 0, revenue: 0 };
    byDay[day].orders++;
    byDay[day].revenue = Math.round((byDay[day].revenue + Number(o.total)) * 100) / 100;
    byPayment[o.payment] = (byPayment[o.payment] ?? 0) + 1;
    byType[o.order_type] = (byType[o.order_type] ?? 0) + 1;
    const h = new Date(o.created_at).getHours();
    byHour[h] = (byHour[h] ?? 0) + 1;
    for (const it of o.order_items) {
      byItem[it.name] = byItem[it.name] ?? { qty: 0, revenue: 0 };
      byItem[it.name].qty += it.quantity;
      byItem[it.name].revenue = Math.round((byItem[it.name].revenue + Number(it.unit_price) * it.quantity) * 100) / 100;
    }
  }
  const summary = {
    period: "últimos 30 dias",
    totals: {
      orders: valid.length,
      cancelled: orders.length - valid.length,
      revenue: Math.round(valid.reduce((s, o) => s + Number(o.total), 0) * 100) / 100,
    },
    byDay,
    items: byItem,
    payments: byPayment,
    orderTypes: byType,
    ordersByHour: byHour,
  };

  try {
    const response = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 1200,
      ...aiThinking(),
      system: [
        {
          type: "text",
          text: `Você é o analista de vendas da loja "${store.name}" num app de delivery. Responda às perguntas do lojista usando SOMENTE os dados reais abaixo (valores em R$, datas em ISO). Seja direto e útil (máx. 6 frases), em português brasileiro, sem markdown. Se os dados não respondem à pergunta, diga isso honestamente. Hoje é ${new Date().toISOString().slice(0, 10)}.

DADOS: ${JSON.stringify(summary)}`,
        },
      ],
      messages: history.map((m) => ({ role: m.role, content: m.content })),
    });
    return NextResponse.json({ reply: textOf(response.content) });
  } catch {
    return NextResponse.json(AI_ERRORS.unavailable, { status: 502 });
  }
}
