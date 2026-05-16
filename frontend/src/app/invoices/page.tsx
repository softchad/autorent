"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useInvoicesData } from "@/hooks/useInvoicesData";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import StatusBadge from "@/app/components/StatusBadge";
import type { InvoiceOut } from "@/store/carRentalApi";
import { useCreateInvoiceMutation, useDeleteInvoiceMutation } from "@/store/carRentalApi";
import { FiRefreshCw } from "react-icons/fi";

// PDF biblioteka neveikia SSR — kraunama tik kliente
const InvoicePdfModal = dynamic(
  () => import("@/app/components/InvoicePdfModal"),
  { ssr: false }
);

type Saskaita = NonNullable<
  ReturnType<typeof useInvoicesData>["invoices"]
>[number];

export default function InvoicesPage() {
  const {
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    filtered,
    isLoading,
    refetch,
  } = useInvoicesData();

  const [createInvoice] = useCreateInvoiceMutation();
  const [deleteInvoice] = useDeleteInvoiceMutation();

  const [pdfInvoice, setPdfInvoice] = useState<InvoiceOut | null>(null);

  const columns = [
    { label: "Sąskaitos nr.", accessor: "invoice_id" },
    {
      label: "Klientas",
      accessor: (s: Saskaita) => `${s.client_first_name} ${s.client_last_name}`,
    },
    {
      label: "Suma",
      accessor: (s: Saskaita) => `${s.total} €`,
    },
    {
      label: "Data",
      accessor: (s: Saskaita) =>
        new Date(s.invoice_date).toLocaleDateString("lt-LT"),
    },
    {
      label: "Būsena",
      accessor: (s: Saskaita) => <StatusBadge status={s.status} />,
    },
    {
      label: "Veiksmai",
      accessor: (s: Saskaita) => (
        <div className="flex items-center gap-1">
          <button
            title="Pergeneruoti sąskaitą"
            onClick={async () => {
              if (!window.confirm(`Pergeneruoti sąskaitą nr. ${s.invoice_id}? Esama sąskaita bus ištrinta ir sukurta nauja.`)) return;
              try {
                await deleteInvoice({ invoiceId: s.invoice_id }).unwrap();
                await createInvoice({
                  invoiceCreate: {
                    order_id: s.order_id,
                    total: s.total,
                    invoice_date: new Date().toISOString().slice(0, 10),
                  },
                }).unwrap();
                await refetch();
                alert("Sąskaita sėkmingai pergeneruota!");
              } catch {
                alert("Klaida pergeneruojant sąskaitą.");
              }
            }}
            className="text-lg text-gray-600 hover:text-teal-500 transition-colors px-1"
            aria-label="Pergeneruoti"
          >
            <FiRefreshCw />
          </button>
          <ActionButtons
            onView={() => setPdfInvoice(s as InvoiceOut)}
            onExtra={() =>
              window.open(
                `mailto:buhaltere@autorent.lt?subject=Sąskaita%20nr.%20${s.invoice_id}&body=Gerbiama buhaltere,%0A%0APrašome peržiūrėti sąskaitą nr. ${s.invoice_id}.`,
                "_blank"
              )
            }
            show={{ view: true, edit: false, delete: false, extra: true }}
            extraLabel="Rašyti buhalterei"
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Sąskaitos</h1>
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[#707070]">
        <input
          type="text"
          placeholder="Ieškoti pagal klientą ar sąskaitos nr."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="border p-2 rounded w-64"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="border p-2 rounded"
        >
          <option value="visi">Visos</option>
          <option value="išrašyta">Išrašytos</option>
          <option value="apmokėta">Apmokėtos</option>
          <option value="vėluojanti">Vėluojančios</option>
        </select>
      </div>

      {isLoading ? (
        <p>Įkeliama...</p>
      ) : (
        <DataTable
          columns={columns}
          data={filtered}
          rowKey={(s) => s.invoice_id}
        />
      )}

      {pdfInvoice && (
        <InvoicePdfModal
          invoice={pdfInvoice}
          onClose={() => setPdfInvoice(null)}
        />
      )}
    </div>
  );
}
