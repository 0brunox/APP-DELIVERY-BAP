"use client";

import { useState } from "react";

export default function StoreLinkCard({ url }: { url: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      prompt("Copie o link da sua loja:", url);
    }
  }

  const waText = encodeURIComponent(
    `Olá! 😊 Faça seu pedido pela nossa loja online: ${url}`
  );

  return (
    <div className="mb-5 rounded-2xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-2">
        <span className="text-xl leading-none">🔗</span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold">Este é o link da sua loja</p>
          <p className="mt-0.5 text-xs text-muted">
            Copie e envie para seus clientes no WhatsApp, Instagram ou onde
            preferir. Por ele, qualquer pessoa faz pedidos direto na sua loja.
          </p>

          <div className="mt-3 flex flex-wrap items-center gap-2">
            <a
              href={url}
              target="_blank"
              rel="noopener noreferrer"
              className="min-w-0 flex-1 truncate rounded-lg border border-black/10 bg-white px-3 py-2 text-sm font-semibold text-primary"
              title={url}
            >
              {url}
            </a>
            <button
              onClick={copy}
              className="shrink-0 rounded-lg bg-neutral-900 px-3 py-2 text-sm font-bold text-white transition hover:bg-neutral-700"
            >
              {copied ? "✓ Copiado!" : "📋 Copiar link"}
            </button>
            <a
              href={`https://wa.me/?text=${waText}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg bg-[#25D366] px-3 py-2 text-sm font-bold text-white transition hover:brightness-95"
            >
              Compartilhar no WhatsApp
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
