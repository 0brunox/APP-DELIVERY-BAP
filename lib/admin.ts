import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";

/** Retorna a primeira loja do usuário autenticado (multi-loja fica para a Etapa 12).
 *  Memorizada por requisição: layout e página do painel compartilham a consulta. */
export const getOwnerStore = cache(async (): Promise<Store | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  const { data } = await supabase
    .from("stores")
    .select("*")
    .eq("owner", user.id)
    .order("created_at")
    .limit(1);
  return (data?.[0] as Store | undefined) ?? null;
});
