import { NextResponse } from "next/server";
import { getOwnerStore } from "@/lib/admin";
import { AI_ERRORS, AI_MODEL, aiConfigured, aiThinking, anthropic, checkAiLimit, textOf } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 120;

const SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          name: { type: "string" },
          description: { type: "string", description: "descrição do item como está no cardápio; vazio se não houver" },
          price: { type: "number", description: "preço em reais; 0 se ilegível" },
          category: { type: "string", description: "seção/categoria do cardápio a que o item pertence" },
        },
        required: ["name", "description", "price", "category"],
        additionalProperties: false,
      },
    },
  },
  required: ["products"],
  additionalProperties: false,
} as const;

type MediaType = "image/jpeg" | "image/png" | "image/webp" | "image/gif";
const ALLOWED: MediaType[] = ["image/jpeg", "image/png", "image/webp", "image/gif"];

/** Lojista fotografa o cardápio em papel; a IA extrai rascunhos de produtos. */
export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });

  let body: { image?: string; mediaType?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const image = body.image ?? "";
  const mediaType = body.mediaType as MediaType;
  if (!image || !ALLOWED.includes(mediaType)) {
    return NextResponse.json({ error: "Envie uma imagem JPEG, PNG ou WebP." }, { status: 400 });
  }
  if (image.length > 4_000_000) {
    return NextResponse.json({ error: "Imagem grande demais. Tente uma foto menor." }, { status: 413 });
  }
  if (!(await checkAiLimit(store.id))) return NextResponse.json(AI_ERRORS.limit, { status: 429 });

  try {
    const response = await anthropic().messages.create({
      model: AI_MODEL,
      max_tokens: 8000,
      ...aiThinking(),
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: [
            { type: "image", source: { type: "base64", media_type: mediaType, data: image } },
            {
              type: "text",
              text: "Esta é a foto de um cardápio de restaurante brasileiro. Extraia TODOS os itens legíveis com nome, descrição (se houver), preço em reais e a categoria/seção. Se um item tiver vários tamanhos com preços diferentes, crie um item por tamanho (ex: 'Pizza Calabresa G'). Não invente itens que não estão na foto.",
            },
          ],
        },
      ],
    });

    const parsed = JSON.parse(textOf(response.content)) as {
      products: { name: string; description: string; price: number; category: string }[];
    };
    const products = (parsed.products ?? [])
      .filter((p) => p.name?.trim())
      .slice(0, 80)
      .map((p) => ({
        name: p.name.trim().slice(0, 120),
        description: (p.description ?? "").trim().slice(0, 300),
        price: Math.max(0, Number(p.price) || 0),
        category: (p.category ?? "").trim().slice(0, 60),
      }));
    return NextResponse.json({ products });
  } catch {
    return NextResponse.json(AI_ERRORS.unavailable, { status: 502 });
  }
}
