"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setInfo("");
    setLoading(true);

    if (mode === "login") {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      setLoading(false);
      if (error) {
        setError("E-mail ou senha incorretos.");
        return;
      }
      router.push("/admin");
      router.refresh();
    } else {
      const { data, error } = await supabase.auth.signUp({ email, password });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      if (data.session) {
        router.push("/admin");
        router.refresh();
      } else {
        setInfo("Conta criada! Confirme seu e-mail (verifique a caixa de entrada) e depois entre.");
        setMode("login");
      }
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center px-6">
      <div className="mb-6 text-center">
        <div className="mb-2 text-5xl">🍔</div>
        <h1 className="text-2xl font-bold">Painel do Lojista</h1>
        <p className="text-sm text-muted">Entre para gerenciar sua loja e pedidos.</p>
      </div>

      <div className="surface bordered rounded-2xl p-6">
        <div className="mb-4 flex gap-1 rounded-xl bg-[var(--surface-2)] p-1">
          {(["login", "signup"] as const).map((m) => (
            <button
              key={m}
              onClick={() => {
                setMode(m);
                setError("");
                setInfo("");
              }}
              className={`flex-1 rounded-lg py-2 text-sm font-semibold transition ${
                mode === m ? "bg-primary text-white" : "text-muted"
              }`}
            >
              {m === "login" ? "Entrar" : "Criar conta"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="E-mail"
            required
            className="surface rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Senha"
            required
            minLength={6}
            className="surface rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
          />
          {error && <p className="rounded-lg bg-red-50 p-2.5 text-sm text-red-600">{error}</p>}
          {info && <p className="rounded-lg bg-green-50 p-2.5 text-sm text-green-700">{info}</p>}
          <button
            type="submit"
            disabled={loading}
            className="rounded-xl bg-primary py-3 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
          >
            {loading ? "..." : mode === "login" ? "Entrar" : "Criar conta"}
          </button>
        </form>
      </div>

      <Link href="/" className="mt-4 text-center text-sm text-muted hover:text-primary">
        ← Voltar ao início
      </Link>
    </main>
  );
}
