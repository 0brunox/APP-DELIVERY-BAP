"use client";

import { useRef, useState } from "react";
import { createClient } from "@/lib/supabase/client";

const MAX_MB = 5;
const inp = "surface w-full rounded-lg border-2 border-[var(--border)] p-2 text-sm outline-none focus:border-primary";

/**
 * Campo de imagem controlado: faz upload para o bucket `product-images` do
 * Supabase Storage e devolve a URL pública via onChange. Mantém um input de
 * URL como alternativa (cole um link, ou edite o que veio do upload).
 */
export default function ImageUpload({
  value,
  onChange,
  storeId,
}: {
  value: string;
  onChange: (url: string) => void;
  storeId: string;
}) {
  const supabase = createClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setErr("");
    if (!file.type.startsWith("image/")) {
      setErr("Selecione um arquivo de imagem.");
      return;
    }
    if (file.size > MAX_MB * 1024 * 1024) {
      setErr(`Imagem muito grande (máximo ${MAX_MB} MB).`);
      return;
    }
    setBusy(true);
    const ext = (file.name.split(".").pop() ?? "jpg").toLowerCase().replace(/[^a-z0-9]/g, "") || "jpg";
    const path = `${storeId}/${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage
      .from("product-images")
      .upload(path, file, { cacheControl: "3600", upsert: false });
    if (error) {
      setBusy(false);
      setErr(`Falha no upload: ${error.message}`);
      return;
    }
    const { data } = supabase.storage.from("product-images").getPublicUrl(path);
    setBusy(false);
    onChange(data.publicUrl);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-3">
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt="Prévia da imagem" className="h-16 w-16 shrink-0 rounded-lg object-cover" />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-lg bg-[var(--surface-2)] text-2xl text-muted">
            🖼️
          </div>
        )}
        <div className="flex flex-wrap gap-2">
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark disabled:opacity-60"
          >
            {busy ? "Enviando..." : "⬆️ Enviar imagem"}
          </button>
          {value && (
            <button
              type="button"
              onClick={() => onChange("")}
              disabled={busy}
              className="rounded-lg border-2 border-[var(--border)] px-3 py-2 text-sm font-semibold text-muted transition hover:border-primary hover:text-primary disabled:opacity-60"
            >
              Remover
            </button>
          )}
        </div>
      </div>
      <input
        className={inp}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="ou cole uma URL (https://...)"
      />
      {err && <p className="text-sm font-semibold text-red-600">{err}</p>}
    </div>
  );
}
