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

// Mygtukas, kuris PDF sugeneruoja KLIENTO naršyklėje (ne serveryje) ir iš karto paleidžia atsisiuntimą - "orderInfo" pasirenkamas, nes InvoicePdfDocument.tsx jį rodo TIK kai yra (žr. ten "{orderInfo && (...)}").
export default function InvoiceDownloadButton({ invoice, orderInfo }: Props) {
  // Laikinas <a> elementas - standartinis naršyklės trikas Blob'ui "atsisiųsti" (naršyklė neturi API, kuris tiesiog paleistų failo išsaugojimą be nuorodos paspaudimo imitacijos).
  const handleDownload = async () => {
    try {
      const blob = await pdf(<InvoicePdfDocument invoice={invoice} orderInfo={orderInfo} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `autorent-saskaita-${invoice.invoice_id}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (err) {
      // Be šito - nepavykus PDF generavimui (pvz. naršyklės suderinamumo klaida), mygtukas atrodytų tiesiog "nieko nedarantis", be jokio ženklo, kad kažkas nepavyko.
      alert("Nepavyko sugeneruoti PDF. Pabandykite vėliau.");
      console.error(err);
    }
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
