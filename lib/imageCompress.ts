/**
 * Redimensiona e recomprime uma imagem no navegador antes do upload, para
 * economizar espaço no Storage e acelerar o carregamento da loja.
 *
 * - Reduz o maior lado para no máximo `maxDim` px (fotos de celular são enormes;
 *   nas telas da loja a imagem nunca passa disso).
 * - Recodifica em WebP (ótima compressão e preserva transparência do logo).
 * - GIF e SVG são enviados sem alteração (animação/vetor não passam pelo canvas).
 * - Se algo falhar ou o resultado ficar maior que o original, mantém o arquivo original.
 */
export async function compressImage(
  file: File,
  { maxDim = 1280, quality = 0.85 }: { maxDim?: number; quality?: number } = {}
): Promise<File> {
  // Formatos que não devem passar pelo canvas.
  if (file.type === "image/gif" || file.type === "image/svg+xml") return file;
  if (!file.type.startsWith("image/")) return file;

  try {
    const bitmap = await loadBitmap(file);
    const { width, height } = bitmap;
    const scale = Math.min(1, maxDim / Math.max(width, height));
    const w = Math.max(1, Math.round(width * scale));
    const h = Math.max(1, Math.round(height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext("2d");
    if (!ctx) return file;
    ctx.drawImage(bitmap, 0, 0, w, h);
    if ("close" in bitmap && typeof bitmap.close === "function") bitmap.close();

    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob(resolve, "image/webp", quality)
    );
    // WebP não suportado ou resultado pior: mantém o original.
    if (!blob || blob.size >= file.size) return file;

    const name = file.name.replace(/\.[^.]+$/, "") + ".webp";
    return new File([blob], name, { type: "image/webp", lastModified: file.lastModified });
  } catch {
    return file;
  }
}

/** Carrega a imagem como bitmap, com fallback para <img> quando createImageBitmap não existe. */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(file);
    } catch {
      /* cai no fallback abaixo */
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("load error"));
      img.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
