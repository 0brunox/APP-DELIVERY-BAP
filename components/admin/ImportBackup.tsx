"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { parseBackup, type ParsedBackup } from "@/lib/import";
import type { Store } from "@/lib/types";

const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";

export default function ImportBackup({ store }: { store: Store }) {
  const router = useRouter();
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [parsed, setParsed] = useState<ParsedBackup | null>(null);
  const [fileName, setFileName] = useState("");
  const [paste, setPaste] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  function analyze(raw: string, name: string) {
    setMsg(null);
    setParsed(null);
    try {
      setParsed(parseBackup(raw));
      setFileName(name);
    } catch (e) {
      setFileName("");
      setMsg({ type: "err", text: e instanceof Error ? e.message : "Falha ao ler o backup." });
    }
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => analyze(String(reader.result), file.name);
    reader.onerror = () => setMsg({ type: "err", text: "Não foi possível ler o arquivo." });
    reader.readAsText(file);
  }

  function cancel() {
    setParsed(null);
    setFileName("");
    setPaste("");
    if (fileRef.current) fileRef.current.value = "";
  }

  async function runImport() {
    if (!parsed) return;
    setBusy(true);
    setMsg(null);
    const sid = store.id;
    try {
      // 1) Substituir: remove cardápio/cupons/zonas atuais da loja.
      const del = async (table: string) => {
        const { error } = await supabase.from(table).delete().eq("store_id", sid);
        if (error) throw new Error(`limpar ${table}: ${error.message}`);
      };
      await del("products");
      await del("categories");
      await del("coupons");
      await del("delivery_zones");

      // 2) Inserir o que veio do backup (store_id é injetado aqui).
      const ins = async (table: string, rows: object[]) => {
        if (!rows.length) return;
        const { error } = await supabase.from(table).insert(rows.map((r) => ({ ...r, store_id: sid })));
        if (error) throw new Error(`inserir ${table}: ${error.message}`);
      };
      await ins("categories", parsed.categories);
      await ins("products", parsed.products);
      await ins("coupons", parsed.coupons);
      await ins("delivery_zones", parsed.zones);

      // 3) Loja: nome, configurações/tema e contador de pedidos.
      const update: Record<string, unknown> = { settings: parsed.settings };
      if (parsed.storeName) update.name = parsed.storeName;
      if (parsed.orderCounter != null) update.order_counter = parsed.orderCounter;
      const { error: upErr } = await supabase.from("stores").update(update).eq("id", sid);
      if (upErr) throw new Error(`atualizar a loja: ${upErr.message}`);

      setMsg({
        type: "ok",
        text: `Importado! ${parsed.products.length} produtos, ${parsed.categories.length} categorias, ${parsed.coupons.length} cupons e ${parsed.zones.length} zonas.`,
      });
      cancel();
      router.refresh();
    } catch (e) {
      const what = e instanceof Error ? e.message : "importar";
      setMsg({ type: "err", text: `Falha ao ${what}. Reimporte o arquivo para concluir a substituição.` });
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="surface bordered rounded-2xl p-5">
      <h2 className="mb-1 text-lg font-bold">📦 Importar backup da versão anterior</h2>
      <p className="mb-4 text-sm text-muted">
        Carregue o arquivo <code>.json</code> gerado pelo botão “Exportar Backup (JSON)” do app antigo (arquivo único).
        Traz cardápio, cupons, zonas de entrega e configurações/tema.{" "}
        <strong>Os pedidos antigos não são importados.</strong>
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={fileRef}
          id="backup-file"
          type="file"
          accept="application/json,.json"
          onChange={(e) => onFile(e.target.files?.[0])}
          className="hidden"
        />
        <label
          htmlFor="backup-file"
          className="cursor-pointer rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          ⬆️ Escolher arquivo
        </label>
        {fileName && <span className="text-sm text-muted">{fileName}</span>}
      </div>

      <details className="mt-3">
        <summary className="cursor-pointer text-sm text-muted">ou colar o JSON manualmente</summary>
        <div className="mt-2 space-y-2">
          <textarea
            value={paste}
            onChange={(e) => setPaste(e.target.value)}
            rows={4}
            placeholder='{"type":"sabor-express-backup", ...}'
            className={`${inp} font-mono`}
          />
          <button
            onClick={() => analyze(paste, "JSON colado")}
            disabled={!paste.trim()}
            className="rounded-lg border-2 border-[var(--border)] px-4 py-2 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary disabled:opacity-50"
          >
            Analisar
          </button>
        </div>
      </details>

      {parsed && (
        <div className="mt-4 rounded-xl border-2 border-amber-300 bg-amber-50 p-4">
          <div className="mb-2 text-sm font-semibold text-amber-900">
            Prévia{parsed.storeName ? ` — ${parsed.storeName}` : ""}
          </div>
          <div className="mb-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Count n={parsed.products.length} label="produtos" />
            <Count n={parsed.categories.length} label="categorias" />
            <Count n={parsed.coupons.length} label="cupons" />
            <Count n={parsed.zones.length} label="zonas" />
          </div>
          <p className="mb-3 text-sm font-semibold text-red-600">
            ⚠️ Isto vai SUBSTITUIR o cardápio, cupons e zonas atuais desta loja. Não dá para desfazer.
          </p>
          <div className="flex gap-2">
            <button
              onClick={runImport}
              disabled={busy}
              className="rounded-xl bg-red-600 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-red-700 disabled:opacity-60"
            >
              {busy ? "Importando..." : "Substituir e importar"}
            </button>
            <button
              onClick={cancel}
              disabled={busy}
              className="rounded-xl border-2 border-[var(--border)] px-4 py-2.5 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {msg && (
        <p
          className={`mt-4 rounded-lg p-2.5 text-sm font-semibold ${
            msg.type === "ok" ? "bg-green-50 text-green-700" : "bg-red-50 text-red-600"
          }`}
        >
          {msg.text}
        </p>
      )}
    </section>
  );
}

function Count({ n, label }: { n: number; label: string }) {
  return (
    <div className="rounded-lg bg-white/60 px-3 py-2 text-center text-amber-900">
      <div className="text-lg font-bold">{n}</div>
      <div className="text-xs">{label}</div>
    </div>
  );
}
