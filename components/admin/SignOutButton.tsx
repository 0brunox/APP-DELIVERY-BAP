"use client";

import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function SignOutButton() {
  const router = useRouter();
  const supabase = createClient();

  async function signOut() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      onClick={signOut}
      className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-semibold text-muted transition hover:border-red-500 hover:text-red-500"
    >
      Sair
    </button>
  );
}
