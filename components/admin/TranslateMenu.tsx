"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Botão que traduz o cardápio inteiro para EN/ES via IA. */
export default function TranslateMenu() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  async function translate() {
    setBusy(true);
    setMsg("");
    try {
      const res = await fetch("/api/ai/translate", { method: "POST" });
      const data = await res.json();
      if (!res.ok) {
        setMsg(data.error ?? "Não foi possível traduzir agora.");
        return;
      }
      setMsg(`✅ Cardápio traduzido (${data.updated} produtos). O cliente já pode trocar o idioma na loja.`);
      router.refresh();
    } catch {
      setMsg("Não foi possível traduzir agora.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">🌐 Cardápio em inglês e espanhol</h2>
      <p className="mb-3 text-sm text-muted">
        A IA traduz nomes e descrições; um seletor de idioma aparece na sua loja. Rode de novo sempre que mudar o cardápio.
      </p>
      <button
        onClick={translate}
        disabled={busy}
        className="rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "Traduzindo (pode levar ~1 min)..." : "🌐 Traduzir cardápio (EN/ES)"}
      </button>
      {msg && <p className="mt-3 rounded-lg bg-[var(--surface-2)] p-2.5 text-sm font-semibold">{msg}</p>}
    </section>
  );
}
