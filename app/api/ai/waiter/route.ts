import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
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
export const maxDuration = 60;

/** Ação validada que o cliente aplica ao carrinho de verdade. */
export interface WaiterAction {
  product_id: string;
  variation_name: string | null;
  addons: { name: string; price: number }[];
  note: string;
  quantity: number;
}

interface ChatMsg {
  role: "user" | "assistant";
  content: string;
}

const ADD_TO_CART_TOOL: Anthropic.Tool = {
  name: "add_to_cart",
  description:
    "Adiciona itens REAIS do cardápio ao carrinho do cliente. Use somente product_id, nomes de variação e nomes de adicionais que existem no cardápio fornecido. Chame apenas quando o cliente confirmar (ou pedir claramente) o que quer.",
  strict: true,
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        description: "Itens a adicionar ao carrinho.",
        items: {
          type: "object",
          properties: {
            product_id: { type: "string", description: "id exato do produto no cardápio" },
            variation_name: {
              type: ["string", "null"],
              description: "nome exato da variação escolhida, ou null se o produto não tem variações",
            },
            addons: {
              type: "array",
              description: "nomes exatos dos adicionais escolhidos (pode ser vazio)",
              items: { type: "string" },
            },
            note: { type: "string", description: "observação do cliente para este item (ex: sem cebola); vazio se nenhuma" },
            quantity: { type: "integer", description: "quantidade (1 a 20)" },
          },
          required: ["product_id", "variation_name", "addons", "note", "quantity"],
          additionalProperties: false,
        },
      },
    },
    required: ["items"],
    additionalProperties: false,
  },
};

/** Valida os itens propostos pela IA contra o cardápio real. */
function validateItems(
  raw: unknown,
  products: Product[]
): { actions: WaiterAction[]; problems: string[] } {
  const actions: WaiterAction[] = [];
  const problems: string[] = [];
  const byId = new Map(products.map((p) => [p.id, p]));
  const items = (raw as { items?: unknown[] })?.items ?? [];

  for (const it of items as {
    product_id?: string;
    variation_name?: string | null;
    addons?: string[];
    note?: string;
    quantity?: number;
  }[]) {
    const p = it.product_id ? byId.get(it.product_id) : undefined;
    if (!p || !p.available) {
      problems.push(`Produto ${it.product_id ?? "?"} não existe ou está esgotado.`);
      continue;
    }
    const qty = Math.min(20, Math.max(1, Math.round(it.quantity ?? 1)));

    let variation: string | null = it.variation_name ?? null;
    if (p.variations.length > 0) {
      const v = p.variations.find((v) => v.name === variation);
      if (!v) {
        problems.push(`"${p.name}" exige escolher uma variação válida (${p.variations.map((v) => v.name).join(", ")}).`);
        continue;
      }
    } else {
      variation = null;
    }

    const allOptions = new Map(
      p.addon_groups.flatMap((g) => g.options.map((o) => [o.name, o] as const))
    );
    const addons: { name: string; price: number }[] = [];
    let bad = false;
    for (const name of it.addons ?? []) {
      const opt = allOptions.get(name);
      if (!opt) {
        problems.push(`Adicional "${name}" não existe em "${p.name}".`);
        bad = true;
        break;
      }
      addons.push({ name: opt.name, price: Number(opt.price) });
    }
    if (bad) continue;

    actions.push({
      product_id: p.id,
      variation_name: variation,
      addons,
      note: (it.note ?? "").slice(0, 200),
      quantity: qty,
    });
  }
  return { actions, problems };
}

export async function POST(req: Request) {
  if (!aiConfigured()) return NextResponse.json(AI_ERRORS.notConfigured, { status: 503 });

  let body: { storeId?: string; messages?: ChatMsg[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  const { storeId } = body;
  const history = (body.messages ?? []).slice(-16);
  if (!storeId || history.length === 0) {
    return NextResponse.json({ error: "Requisição inválida." }, { status: 400 });
  }
  if (history.some((m) => typeof m.content !== "string" || m.content.length > 1500)) {
    return NextResponse.json({ error: "Mensagem longa demais." }, { status: 400 });
  }

  if (!(await checkAiLimit(storeId))) {
    return NextResponse.json(AI_ERRORS.limit, { status: 429 });
  }

  const supabase = supabaseAnon();
  const [{ data: store }, { data: products }, { data: categories }] = await Promise.all([
    supabase.from("stores").select("id, name, settings").eq("id", storeId).maybeSingle(),
    supabase.from("products").select("*").eq("store_id", storeId).eq("available", true),
    supabase.from("categories").select("id, name").eq("store_id", storeId),
  ]);
  if (!store || !products?.length) {
    return NextResponse.json({ error: "Loja sem cardápio disponível." }, { status: 404 });
  }
  const menu = menuForPrompt(products as Product[], categories ?? []);

  const system: Anthropic.TextBlockParam[] = [
    {
      type: "text",
      text: `Você é o garçom virtual da loja "${store.name}", um assistente simpático que ajuda o cliente a montar o pedido pelo chat.

CARDÁPIO REAL (única fonte de verdade — nunca invente itens, preços ou adicionais):
${JSON.stringify(menu)}

Regras:
- Responda sempre em português brasileiro, de forma curta e calorosa (1-3 frases). Sem markdown.
- Sugira apenas itens do cardápio acima. Se pedirem algo que não existe, diga que não tem e ofereça o mais parecido.
- Respeite orçamento quando o cliente der um limite (some os preços; use promo_price quando existir).
- Produtos com "variations" exigem escolher uma variação; pergunte se o cliente não disse qual.
- Restrições ("sem cebola") viram "note" do item quando não houver adicional/variação que resolva.
- Quando o pedido estiver claro, chame add_to_cart com os itens exatos. Depois confirme o que foi adicionado e o total aproximado.
- Você só monta o carrinho; o cliente finaliza o pedido no botão do carrinho. Pagamento é na entrega/retirada (maquininha: crédito, débito ou PIX).`,
      cache_control: { type: "ephemeral" },
    },
  ];

  const messages: Anthropic.MessageParam[] = history.map((m) => ({
    role: m.role,
    content: m.content,
  }));

  const client = anthropic();
  const allActions: WaiterAction[] = [];
  let reply = "";

  try {
    for (let round = 0; round < 3; round++) {
      const response = await client.messages.create({
        model: AI_MODEL,
        max_tokens: 1500,
        system,
        tools: [ADD_TO_CART_TOOL],
        messages,
      });

      const toolUses = response.content.filter(
        (b): b is Anthropic.ToolUseBlock => b.type === "tool_use"
      );
      reply = textOf(response.content) || reply;

      if (response.stop_reason !== "tool_use" || toolUses.length === 0) break;

      messages.push({ role: "assistant", content: response.content });
      const results: Anthropic.ToolResultBlockParam[] = toolUses.map((tu) => {
        const { actions, problems } = validateItems(tu.input, products as Product[]);
        allActions.push(...actions);
        return {
          type: "tool_result",
          tool_use_id: tu.id,
          content:
            problems.length > 0
              ? `Alguns itens não puderam ser adicionados: ${problems.join(" ")} Itens válidos adicionados: ${actions.length}.`
              : `${actions.length} item(ns) adicionados ao carrinho com sucesso.`,
        };
      });
      messages.push({ role: "user", content: results });
    }
  } catch {
    return NextResponse.json(AI_ERRORS.unavailable, { status: 502 });
  }

  return NextResponse.json({
    reply: reply || "Prontinho! Adicionei ao seu carrinho. 😊",
    actions: allActions,
  });
}
