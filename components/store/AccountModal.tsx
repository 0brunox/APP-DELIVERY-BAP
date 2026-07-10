"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { brl } from "@/lib/format";
import { getLocalOrders, type LocalOrder } from "@/lib/localOrders";
import { orderStatusLabel, orderStatusIcon, ORDER_STATUS_COLOR } from "@/lib/orders";
import type { OrderStatus, OrderType } from "@/lib/types";

interface HistoryOrder extends LocalOrder {
  status?: OrderStatus;
}

type Mode = "login" | "signup";
type Method = "password" | "magic";

export default function AccountModal({
  storeId,
  slug,
  onClose,
}: {
  storeId: string;
  slug: string;
  onClose: () => void;
}) {
  const supabase = useMemo(() => createClient(), []);
  const [email, setEmail] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState<HistoryOrder[]>([]);

  // Carrega sessão + histórico (servidor, se logado) mesclado com o local.
  useEffect(() => {
    let active = true;
    (async () => {
      const { data } = await supabase.auth.getUser();
      const local = getLocalOrders(slug);
      let merged: HistoryOrder[] = local;

      if (data.user) {
        const { data: srv } = await supabase.rpc("my_orders", { p_store: storeId });
        const serverOrders = (srv ?? []) as {
          code: string;
          number: number;
          total: number;
          order_type: string;
          status: OrderStatus;
          created_at: string;
        }[];
        const byCode = new Map<string, HistoryOrder>();
        for (const o of local) byCode.set(o.code, o);
        for (const o of serverOrders) {
          byCode.set(o.code, {
            code: o.code,
            number: o.number,
            total: Number(o.total),
            orderType: o.order_type,
            createdAt: o.created_at,
            status: o.status,
          });
        }
        merged = [...byCode.values()].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
      }

      if (!active) return;
      setEmail(data.user?.email ?? null);
      setOrders(merged);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [supabase, storeId, slug]);

  async function signOut() {
    await supabase.auth.signOut();
    setEmail(null);
    setOrders(getLocalOrders(slug));
  }

  return (
    <Overlay onClose={onClose}>
      <div className="flex items-center justify-between border-b border-[var(--border)] p-4">
        <h2 className="text-xl font-bold">{email ? "Minha conta" : "Meus pedidos"}</h2>
        <button onClick={onClose} aria-label="Fechar" className="text-2xl text-muted hover:text-[var(--text)]">
          ✕
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4">
        {loading ? (
          <p className="py-8 text-center text-muted">Carregando...</p>
        ) : (
          <>
            {email ? (
              <div className="mb-4 flex items-center justify-between rounded-xl bg-[var(--surface-2)] p-3 text-sm">
                <span>👤 {email}</span>
                <button onClick={signOut} className="font-semibold text-primary hover:underline">
                  Sair
                </button>
              </div>
            ) : (
              <AuthPanel
                onAuthed={(mail) => {
                  setEmail(mail);
                }}
              />
            )}

            <OrderHistory slug={slug} orders={orders} />
          </>
        )}
      </div>
    </Overlay>
  );
}

/** Painel de login/cadastro (e-mail+senha ou magic link). */
function AuthPanel({ onAuthed }: { onAuthed: (email: string) => void }) {
  const supabase = useMemo(() => createClient(), []);
  const [mode, setMode] = useState<Mode>("login");
  const [method, setMethod] = useState<Method>("password");
  const [mail, setMail] = useState("");
  const [pass, setPass] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  async function submit() {
    setErr("");
    setMsg("");
    const e = mail.trim();
    if (!e) return setErr("Informe seu e-mail.");

    setBusy(true);
    try {
      if (method === "magic") {
        const { error } = await supabase.auth.signInWithOtp({
          email: e,
          options: { emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        setMsg("📧 Enviamos um link de acesso para o seu e-mail. Abra-o para entrar.");
      } else if (mode === "signup") {
        if (pass.length < 6) return setErr("A senha precisa de ao menos 6 caracteres.");
        const { data, error } = await supabase.auth.signUp({ email: e, password: pass });
        if (error) throw error;
        if (data.session) onAuthed(e);
        else setMsg("📧 Conta criada! Confirme pelo link enviado ao seu e-mail e depois entre.");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email: e, password: pass });
        if (error) throw error;
        onAuthed(e);
      }
    } catch {
      setErr("Não foi possível concluir. Confira os dados e tente de novo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mb-5 rounded-xl border border-[var(--border)] p-4">
      <p className="mb-3 text-sm text-muted">
        Entre para acompanhar seus pedidos em qualquer aparelho. <strong>Pedir sem conta também funciona</strong> —
        é só fechar isto e adicionar itens ao carrinho.
      </p>

      <div className="mb-3 flex gap-1 rounded-lg bg-[var(--surface-2)] p-1 text-sm font-semibold">
        <button
          onClick={() => setMode("login")}
          className={`flex-1 rounded-md py-1.5 ${mode === "login" ? "bg-[var(--surface)] text-primary shadow" : "text-muted"}`}
        >
          Entrar
        </button>
        <button
          onClick={() => setMode("signup")}
          className={`flex-1 rounded-md py-1.5 ${mode === "signup" ? "bg-[var(--surface)] text-primary shadow" : "text-muted"}`}
        >
          Criar conta
        </button>
      </div>

      <input
        type="email"
        value={mail}
        onChange={(e) => setMail(e.target.value)}
        placeholder="seu@email.com"
        className="surface mb-2 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
      />
      {method === "password" && (
        <input
          type="password"
          value={pass}
          onChange={(e) => setPass(e.target.value)}
          placeholder={mode === "signup" ? "Crie uma senha (mín. 6)" : "Sua senha"}
          className="surface mb-2 w-full rounded-lg border-2 border-[var(--border)] p-2.5 text-sm outline-none focus:border-primary"
        />
      )}

      {err && <p className="mb-2 text-sm font-semibold text-red-600">{err}</p>}
      {msg && <p className="mb-2 rounded-lg bg-green-50 p-2.5 text-sm font-semibold text-green-700">{msg}</p>}

      <button
        onClick={submit}
        disabled={busy}
        className="w-full rounded-xl bg-primary py-2.5 font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
      >
        {busy ? "..." : method === "magic" ? "Enviar link de acesso" : mode === "signup" ? "Criar conta" : "Entrar"}
      </button>

      <button
        onClick={() => {
          setMethod((m) => (m === "password" ? "magic" : "password"));
          setErr("");
          setMsg("");
        }}
        className="mt-2 w-full text-center text-xs font-semibold text-muted hover:text-primary"
      >
        {method === "password" ? "Prefiro entrar por link no e-mail (sem senha)" : "Prefiro usar e-mail e senha"}
      </button>
    </div>
  );
}

function OrderHistory({ slug, orders }: { slug: string; orders: HistoryOrder[] }) {
  if (orders.length === 0) {
    return (
      <div className="py-8 text-center text-muted">
        <div className="mb-2 text-4xl opacity-40">🧾</div>
        <p>Você ainda não fez pedidos por aqui.</p>
      </div>
    );
  }
  return (
    <div>
      <div className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">Seus pedidos</div>
      <div className="space-y-2">
        {orders.map((o) => (
          <Link
            key={o.code}
            href={`/${slug}/pedido/${o.code}`}
            className="surface-2 flex items-center justify-between gap-2 rounded-xl p-3 transition hover:ring-2 hover:ring-primary"
          >
            <div>
              <div className="font-bold">Pedido #{o.number}</div>
              <div className="text-xs text-muted">
                {new Date(o.createdAt).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" })}
              </div>
            </div>
            <div className="text-right">
              {o.status && (
                <span
                  className="mb-1 inline-block rounded-full px-2 py-0.5 text-[11px] font-bold text-white"
                  style={{ background: ORDER_STATUS_COLOR[o.status] }}
                >
                  {orderStatusIcon(o.status, o.orderType as OrderType)} {orderStatusLabel(o.status, o.orderType as OrderType)}
                </span>
              )}
              <div className="text-sm font-semibold">{brl(o.total)}</div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function Overlay({ children, onClose }: { children: React.ReactNode; onClose: () => void }) {
  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/80 p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="surface flex max-h-[90vh] w-full max-w-md flex-col overflow-hidden rounded-2xl">{children}</div>
    </div>
  );
}
