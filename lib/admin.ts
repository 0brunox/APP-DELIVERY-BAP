import { createClient } from "@/lib/supabase/server";
import type { Store } from "@/lib/types";

/** Retorna a primeira loja do usuário autenticado (multi-loja fica para a Etapa 12). */
export async function getOwnerStore(): Promise<Store | null> {
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
}
