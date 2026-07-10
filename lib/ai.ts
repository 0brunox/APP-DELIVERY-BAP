// Utilidades de IA (somente servidor — a chave nunca vai ao cliente).
import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { createClient as createSupabase } from "@supabase/supabase-js";
import type { Product } from "./types";

/**
 * Modelo padrão: Claude Opus 4.8 (o mais capaz).
 * Para reduzir custo, defina AI_MODEL=claude-haiku-4-5 no ambiente.
 */
export const AI_MODEL = process.env.AI_MODEL || "claude-opus-4-8";

/** Limite diário de chamadas de IA por loja (todas as features somadas). */
export const AI_DAILY_LIMIT = Number(process.env.AI_DAILY_LIMIT || 300);

/**
 * "adaptive thinking" só existe na família 4.6+ (Opus 4.6/4.7/4.8, Sonnet 5/4.6,
 * Fable/Mythos 5). Modelos mais baratos como o Haiku 4.5 não aceitam — enviar o
 * parâmetro dá erro 400. Este helper devolve `{ thinking }` só quando é seguro,
 * para poder espalhar (`...aiThinking()`) na chamada sem quebrar no Haiku.
 */
export function aiThinking(): { thinking?: { type: "adaptive" } } {
  const supports = /(opus-4-(6|7|8)|sonnet-(5|4-6)|fable-5|mythos-5)/.test(AI_MODEL);
  return supports ? { thinking: { type: "adaptive" } } : {};
}

export function aiConfigured(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export function anthropic(): Anthropic {
  return new Anthropic();
}

/** Cliente Supabase anônimo para RPCs públicas em route handlers. */
export function supabaseAnon() {
  return createSupabase(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );
}

/**
 * Registra 1 uso de IA da loja e diz se ainda está dentro do limite diário.
 * Em caso de erro do banco, nega (fail-closed) para não virar porta aberta.
 */
export async function checkAiLimit(storeId: string): Promise<boolean> {
  const { data, error } = await supabaseAnon().rpc("ai_use", {
    p_store: storeId,
    p_limit: AI_DAILY_LIMIT,
  });
  if (error) return false;
  return data === true;
}

/** Cardápio compacto para o prompt (só produtos disponíveis). */
export function menuForPrompt(products: Product[], categories: { id: string; name: string }[]) {
  const catName = new Map(categories.map((c) => [c.id, c.name]));
  return products
    .filter((p) => p.available)
    .map((p) => ({
      id: p.id,
      name: p.name,
      description: p.description || undefined,
      price: Number(p.price),
      promo_price: p.promo_price != null && p.variations.length === 0 ? Number(p.promo_price) : undefined,
      category: (p.category_id && catName.get(p.category_id)) || undefined,
      variations: p.variations.length ? p.variations : undefined,
      addon_groups: p.addon_groups.length ? p.addon_groups : undefined,
    }));
}

/** Extrai o texto concatenado de uma resposta. */
export function textOf(content: Anthropic.ContentBlock[]): string {
  return content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();
}

export const AI_ERRORS = {
  notConfigured: { error: "A IA não está configurada nesta plataforma." },
  limit: { error: "Limite diário de IA desta loja atingido. Tente novamente amanhã." },
  unavailable: { error: "O assistente está indisponível agora. Tente de novo em instantes." },
} as const;
