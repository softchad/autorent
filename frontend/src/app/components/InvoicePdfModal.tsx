"use client";

import { useEffect, useState } from "react";
import { pdf } from "@react-pdf/renderer";
import InvoicePdfDocument from "./InvoicePdfDocument";
import type { InvoiceOut } from "@/store/carRentalApi";

interface Props {
  invoice: InvoiceOut;
  onClose: () => void;
}

export default function InvoicePdfModal({ invoice, onClose }: Props) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    let url: string;
    pdf(<InvoicePdfDocument invoice={invoice} />)
      .toBlob()
      .then((blob) => {
        url = URL.createObjectURL(blob);
        setBlobUrl(url);
      });
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [invoice]);

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div
        className="bg-[#0E1525] rounded-xl shadow-2xl flex flex-col w-full max-w-3xl"
        style={{ height: "88vh" }}
      >
        {/* Modal header */}
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

        {/* PDF preview */}
        <div className="flex-1 p-4">
          {blobUrl ? (
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
