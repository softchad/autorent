"use client";

import { pdf } from "@react-pdf/renderer";
import InvoicePdfDocument from "./InvoicePdfDocument";
import type { OrderInfo } from "./InvoicePdfDocument";
import type { InvoiceOut } from "@/store/autorentApi";
import { FiDownload } from "react-icons/fi";

interface Props {
  invoice: InvoiceOut;
  orderInfo?: OrderInfo;
}

export default function InvoiceDownloadButton({ invoice, orderInfo }: Props) {
  const handleDownload = async () => {
    const blob = await pdf(<InvoicePdfDocument invoice={invoice} orderInfo={orderInfo} />).toBlob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `autorent-saskaita-${invoice.invoice_id}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <button
      title="Atsisiųsti PDF"
      onClick={handleDownload}
      className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-teal-900/30 hover:text-teal-400"
      aria-label="Atsisiųsti PDF"
    >
      <FiDownload />
    </button>
  );
}
