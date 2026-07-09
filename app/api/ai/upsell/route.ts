import { NextResponse } from "next/server";
import {
  AI_ERRORS,
  AI_MODEL,
  aiConfigured,
  anthropic,
  checkAiLimit,
  menuForPrompt,
  supabaseAnon,
  textOf,
} from "@/lib/ai";
import type { Product } from "@/lib/types";

export const runtime = "nodejs";
export const maxDuration = 30;

const SCHEMA = {
  type: "object",
  properties: {
    suggestions: {
      type: "array",
      items: {
        type: "object",
        properties: {
          product_id: { type: "string" },
          reason: { type: "string", description: "frase curta e apetitosa em pt-BR (máx 60 caracteres)" },
        },
        required: ["product_id", "reason"],
        additionalProperties: false,
      },
    },
  },
  required: ["suggestions"],
  additionalProperties: false,
} as const;

export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  let body: { storeId?: string; cartNames?: string[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const { storeId } = body;
  const cartNames = (body.cartNames ?? []).slice(0, 20).map((n) => String(n).slice(0, 120));
  if (!storeId || cartNames.length === 0) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (!(await checkAiLimit(storeId))) return NextResponse.json(AI_ERRORS.limit, { status: 429 });

  const supabase = supabaseAnon();
  const [{ data: products }, { data: categories }, { data: popular }] = await Promise.all([
    supabase.from("products").select("*").eq("store_id", storeId).eq("available", true),
    supabase.from("categories").select("id, name").eq("store_id", storeId),
    supabase.rpc("top_items", { p_store: storeId }),
  ]);
  if (!products?.length) return NextResponse.json({ suggestions: [] });

  // Só sugere itens de 1 clique (sem variações) que ainda não estão no carrinho.
  const inCart = new Set(cartNames.map((n) => n.toLowerCase()));
  const candidates = (products as Product[]).filter(
    (p) => p.variations.length === 0 && !inCart.has(p.name.toLowerCase())
  );
  if (candidates.length === 0) return NextResponse.json({ suggestions: [] });
  const menu = menuForPrompt(candidates, categories ?? []);

  try {
    const response = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 600,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Você faz upsell num app de delivery. Carrinho atual do cliente: ${JSON.stringify(cartNames)}.
Itens mais pedidos da loja (populares): ${JSON.stringify(popular ?? [])}.
Candidatos disponíveis para sugerir: ${JSON.stringify(menu)}.

Escolha no máximo 2 candidatos que COMPLEMENTAM o carrinho (bebida para comida, acompanhamento, sobremesa...). Não sugira algo redundante com o que já está no carrinho. Se nada combinar, retorne lista vazia.`,
        },
      ],
    });

    const parsed = JSON.parse(textOf(response.content)) as {
      suggestions: { product_id: string; reason: string }[];
    };
    const byId = new Map(candidates.map((p) => [p.id, p]));
    const suggestions = (parsed.suggestions ?? [])
      .filter((s) => byId.has(s.product_id))
      .slice(0, 2)
      .map((s) => ({ product_id: s.product_id, reason: s.reason.slice(0, 80) }));
    return NextResponse.json({ suggestions });
  } catch {
    // Upsell é opcional: falha silenciosa, sem quebrar o carrinho.
    return NextResponse.json({ suggestions: [] });
  }
}
