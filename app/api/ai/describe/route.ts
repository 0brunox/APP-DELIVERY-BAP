import { NextResponse } from "next/server";
import { getOwnerStore } from "@/lib/admin";
import { AI_ERRORS, AI_MODEL, aiConfigured, anthropic, checkAiLimit, textOf } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 30;

/** Gera uma descrição apetitosa para um produto do lojista. */
export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { name?: string; category?: string; current?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const name = (body.name ?? "").trim().slice(0, 120);
  if (!name) return NextResponse.json({ error: "Informe o nome do produto." }, { status: 400 });
  if (!(await checkAiLimit(store.id))) return NextResponse.json(AI_ERRORS.limit, { status: 429 });

  try {
    const response = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 300,
      messages: [
        {
          role: "user",
          content: `Escreva UMA descrição apetitosa e curta (máx. 120 caracteres, sem aspas, sem emoji, pt-BR) para o cardápio de delivery.
Produto: ${name}${body.category ? `\nCategoria: ${String(body.category).slice(0, 60)}` : ""}${body.current ? `\nDescrição atual (melhore): ${String(body.current).slice(0, 300)}` : ""}
Responda somente com a descrição.`,
        },
      ],
    });
    const description = textOf(response.content).replace(/^["']|["']$/g, "").slice(0, 160);
    return NextResponse.json({ description });
  } catch {
    return NextResponse.json(AI_ERRORS.unavailable, { status: 502 });
  }
}
