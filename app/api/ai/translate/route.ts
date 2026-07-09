import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getOwnerStore } from "@/lib/admin";
import { AI_ERRORS, AI_MODEL, aiConfigured, anthropic, checkAiLimit, textOf } from "@/lib/ai";

export const runtime = "nodejs";
export const maxDuration = 300;

const SCHEMA = {
  type: "object",
  properties: {
    products: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          en: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" } },
            required: ["name", "description"],
            additionalProperties: false,
          },
          es: {
            type: "object",
            properties: { name: { type: "string" }, description: { type: "string" } },
            required: ["name", "description"],
            additionalProperties: false,
          },
        },
        required: ["id", "en", "es"],
        additionalProperties: false,
      },
    },
    categories: {
      type: "array",
      items: {
        type: "object",
        properties: {
          id: { type: "string" },
          en: { type: "string" },
          es: { type: "string" },
        },
        required: ["id", "en", "es"],
        additionalProperties: false,
      },
    },
  },
  required: ["products", "categories"],
  additionalProperties: false,
} as const;

/** Traduz o cardápio inteiro para EN/ES e grava em products/categories.translations. */
export async function POST() {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  const store = await getOwnerStore();
  if (!store) return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  if (!(await checkAiLimit(store.id))) return NextResponse.json(AI_ERRORS.limit, { status: 429 });

  const supabase = await createClient(); // sessão do lojista (RLS de dono)
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from("products").select("id, name, description").eq("store_id", store.id),
    supabase.from("categories").select("id, name").eq("store_id", store.id),
  ]);
  if (!products?.length) return NextResponse.json({ error: "Cadastre produtos antes de traduzir." }, { status: 400 });

  try {
    const stream = anthropic().messages.stream({
      model: AI_MODEL,
      max_tokens: 32000,
      output_config: { format: { type: "json_schema", schema: SCHEMA } },
      messages: [
        {
          role: "user",
          content: `Traduza este cardápio de delivery do português para INGLÊS e ESPANHOL, mantendo nomes próprios de pratos consagrados quando fizer sentido (ex: "Feijoada" fica "Feijoada" com descrição traduzida). Não traduza os ids.

Produtos: ${JSON.stringify(products)}
Categorias: ${JSON.stringify(categories ?? [])}`,
        },
      ],
    });
    const response = await stream.finalMessage();
    const parsed = JSON.parse(textOf(response.content)) as {
      products: { id: string; en: { name: string; description: string }; es: { name: string; description: string } }[];
      categories: { id: string; en: string; es: string }[];
    };

    let updated = 0;
    for (const p of parsed.products ?? []) {
      const { error } = await supabase
        .from("products")
        .update({ translations: { en: p.en, es: p.es } })
        .eq("id", p.id)
        .eq("store_id", store.id);
      if (!error) updated++;
    }
    for (const c of parsed.categories ?? []) {
      await supabase
        .from("categories")
        .update({ translations: { en: { name: c.en }, es: { name: c.es } } })
        .eq("id", c.id)
        .eq("store_id", store.id);
    }
    return NextResponse.json({ ok: true, updated });
  } catch {
    return NextResponse.json(AI_ERRORS.unavailable, { status: 502 });
  }
}
