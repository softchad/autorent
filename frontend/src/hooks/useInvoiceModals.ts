import { useState } from "react";
import { InvoiceOut } from "@/store/carRentalApi";

export function useInvoiceModals() {
  const [selected, setSelected] = useState<InvoiceOut | null>(null);
  const [mode, setMode] = useState<"view" | "pdf" | "delete" | null>(null);

  const openView = (invoice: InvoiceOut) => {
    setSelected(invoice);
    setMode("view");
  };

  const openPdf = (invoice: InvoiceOut) => {
    setSelected(invoice);
    setMode("pdf");
  };

  const openDelete = (invoice: InvoiceOut) => {
    setSelected(invoice);
    setMode("delete");
  };

  const close = () => {
    setSelected(null);
    setMode(null);
  };

  return { selected, mode, openView, openPdf, openDelete, close };
}
