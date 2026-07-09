"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

export interface SetupStep {
  key: string;
  label: string;
  href: string;
  done: boolean;
}

/**
 * Guia de primeiros passos: aparece enquanto a loja está incompleta.
 * Some sozinho quando tudo é concluído, ou quando o lojista dispensa
 * (persistido no navegador). Reaparece se surgir um passo novo pendente.
 */
export default function SetupChecklist({
  steps,
  storeSlug,
}: {
  steps: SetupStep[];
  storeSlug: string;
}) {
  const doneCount = steps.filter((s) => s.done).length;
  const allDone = doneCount === steps.length;
  const key = `setupDismissed:${storeSlug}`;
  const [dismissed, setDismissed] = useState(true); // esconde até checar o storage (evita flicker)

  useEffect(() => {
    setDismissed(localStorage.getItem(key) === "1");
  }, [key]);

  if (allDone || dismissed) return null;

  function dismiss() {
    try {
      localStorage.setItem(key, "1");
    } catch {
      /* ignora */
    }
    setDismissed(true);
  }

  const pct = Math.round((doneCount / steps.length) * 100);

  return (
    <div className="mb-5 rounded-2xl border-2 border-primary/40 bg-[var(--surface-2)] p-5">
      <div className="mb-1 flex items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">🚀 Termine de configurar sua loja</h2>
          <p className="text-sm text-muted">
            {doneCount} de {steps.length} passos concluídos — falta pouco para vender!
          </p>
        </div>
        <button
          onClick={dismiss}
          className="shrink-0 text-xs font-semibold text-muted underline hover:text-primary"
        >
          dispensar
        </button>
      </div>

      <div className="my-3 h-2 overflow-hidden rounded-full bg-[var(--surface)]">
        <div
          className="h-full rounded-full transition-all"
          style={{ width: `${Math.max(4, pct)}%`, background: "linear-gradient(90deg, var(--primary), var(--secondary))" }}
        />
      </div>

      <ul className="space-y-1.5">
        {steps.map((s) => (
          <li key={s.key}>
            {s.done ? (
              <div className="flex items-center gap-2 text-sm text-muted">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-green-500 text-xs text-white">✓</span>
                <span className="line-through">{s.label}</span>
              </div>
            ) : (
              <Link
                href={s.href}
                className="group flex items-center gap-2 text-sm font-semibold transition hover:text-primary"
              >
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full border-2 border-[var(--border)] text-xs group-hover:border-primary" />
                <span>{s.label}</span>
                <span className="text-primary opacity-0 transition group-hover:opacity-100">→</span>
              </Link>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
