"use client";

import { useState } from "react";

interface TableQR {
  n: number;
  url: string;
  dataUrl: string;
}

/** Grade de QR codes de mesa com seleção de quantidade e impressão. */
export default function TableQRGrid({
  storeName,
  generic,
  tables,
}: {
  storeName: string;
  generic: { url: string; dataUrl: string };
  tables: TableQR[];
}) {
  const [count, setCount] = useState(8);
  const shown = tables.slice(0, count);

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="text-sm font-semibold">
          Quantas mesas?{" "}
          <input
            type="number"
            min={1}
            max={tables.length}
            value={count}
            onChange={(e) => setCount(Math.min(tables.length, Math.max(1, Number(e.target.value) || 1)))}
            className="surface w-20 rounded-lg border-2 border-[var(--border)] p-1.5 text-sm outline-none focus:border-primary"
          />
        </label>
        <button
          onClick={() => window.print()}
          className="rounded-xl bg-primary px-4 py-2 text-sm font-semibold text-white transition hover:bg-primary-dark"
        >
          🖨️ Imprimir QRs
        </button>
      </div>

      {/* Área imprimível */}
      <div className="qr-print grid grid-cols-2 gap-4 sm:grid-cols-3">
        <QRCard title="Cardápio (vitrine/balcão)" subtitle={storeName} dataUrl={generic.dataUrl} />
        {shown.map((t) => (
          <QRCard key={t.n} title={`Mesa ${t.n}`} subtitle={storeName} dataUrl={t.dataUrl} />
        ))}
      </div>

      <style jsx global>{`
        @media print {
          body * {
            visibility: hidden;
          }
          .qr-print,
          .qr-print * {
            visibility: visible;
          }
          .qr-print {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
          }
          .qr-print .qr-card {
            break-inside: avoid;
            border: 1px solid #ccc;
          }
        }
      `}</style>
    </div>
  );
}

function QRCard({ title, subtitle, dataUrl }: { title: string; subtitle: string; dataUrl: string }) {
  return (
    <div className="qr-card surface bordered flex flex-col items-center rounded-xl p-4 text-center">
      <div className="text-sm font-bold text-muted">{subtitle}</div>
      <div className="mb-2 text-lg font-extrabold">{title}</div>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={dataUrl} alt={`QR ${title}`} className="h-40 w-40" />
      <div className="mt-2 text-xs text-muted">Aponte a câmera para pedir</div>
    </div>
  );
}
