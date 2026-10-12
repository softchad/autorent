"use client";

import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import InvoicePdfDocument from "./InvoicePdfDocument";
import type { OrderInfo } from "./InvoicePdfDocument";
import type { InvoiceOut } from "@/store/autorentApi";

interface Props {
  invoice: InvoiceOut;
  orderInfo?: OrderInfo;
  onClose: () => void;
}

// PDF peržiūros langas - generuoja sąskaitą KLIENTO naršyklėje ir rodo ją <iframe> viduje (žr. InvoiceDownloadButton.tsx dėl TO PAČIO generavimo, bet be peržiūros).
export default function InvoicePdfModal({ invoice, orderInfo, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // "cancelled" apsauga - "orderInfo" (žr. invoices/page.tsx getOrderInfo) yra NAUJAS objektas KASKART kviečiantis puslapis perrenderina, tad šis efektas gali paleisti NAUJĄ PDF generavimą, kol SENAS dar nebaigtas; be "cancelled" patikros senas, PAVĖLAVĘS "then" galėtų UŽRAŠYTI naujesnį blobUrl senu PDF'u ir "atsarginė" url NIEKADA nebūtų atlaisvinta (nutekėjimas).
  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    setError(null);
    pdf(<InvoicePdfDocument invoice={invoice} orderInfo={orderInfo} />)
      .toBlob()
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      })
      .catch((err) => {
        if (cancelled) return;
        setError("Nepavyko sugeneruoti sąskaitos PDF.");
        console.error(err);
      });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice, orderInfo]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#0E1525] rounded-xl shadow-2xl flex flex-col w-full max-w-3xl"
        style={{ height: "88vh" }}
      >
        {/* Lango antraštė */}
        <div className="flex justify-between items-center px-6 py-4 border-b border-[#1C2B3A]">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-widest">Sąskaita-faktūra</p>
            <h2 className="text-[#F7F7F7] font-semibold text-lg">
              Nr. {invoice.invoice_id} &mdash;{" "}
              {invoice.client_first_name} {invoice.client_last_name}
            </h2>
          </div>
          <div className="flex items-center gap-3">
            {blobUrl && (
              <a
                href={blobUrl}
                download={`autorent-saskaita-${invoice.invoice_id}.pdf`}
                className="bg-[#0F597B] hover:bg-[#0C374D] text-[#F7F7F7] px-4 py-2 rounded text-sm transition-colors"
              >
                ↓ Atsisiųsti PDF
              </a>
            )}
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors text-xl px-2"
              aria-label="Uždaryti"
            >
              ✕
            </button>
          </div>
        </div>

        {/* PDF peržiūra */}
        <div className="flex-1 p-4">
          {error ? (
            <div className="flex items-center justify-center h-full text-red-400 text-sm">{error}</div>
          ) : blobUrl ? (
            <iframe
              src={blobUrl}
              className="w-full h-full rounded-lg border border-[#1C2B3A]"
              title={`Sąskaita nr. ${invoice.invoice_id}`}
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Generuojama sąskaita...
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
