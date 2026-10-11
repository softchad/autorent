"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import { useInvoicesData } from "@/hooks/useInvoicesData";
import { useOrdersData } from "@/hooks/useOrdersData";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import StatusBadge from "@/app/components/StatusBadge";
import EntityModal from "@/app/components/modals/EntityModal";
import CreateInvoiceButton from "@/app/components/CreateInvoiceButton";
import type { InvoiceOut, OrderOut } from "@/store/autorentApi";
import { useCreateInvoiceMutation, useDeleteInvoiceMutation, useGetAllOrdersQuery } from "@/store/autorentApi";
import { FiRefreshCw, FiClipboard } from "react-icons/fi";
import { formatApiError } from "@/utils/formatApiError";

// PDF biblioteka neveikia SSR — kraunama tik kliente
const InvoicePdfModal = dynamic(
  () => import("@/app/components/InvoicePdfModal"),
  { ssr: false }
);
const InvoiceDownloadButton = dynamic(
  () => import("@/app/components/InvoiceDownloadButton"),
  { ssr: false }
);

type Saskaita = NonNullable<
  ReturnType<typeof useInvoicesData>["invoices"]
>[number];

export default function InvoicesPage() {
  const {
    invoices,
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
  const { data: orders = [] } = useGetAllOrdersQuery();
  const { orderFields, getClientName, getCarName } = useOrdersData();

  const [pdfInvoice, setPdfInvoice] = useState<InvoiceOut | null>(null);
  const [orderModalOrder, setOrderModalOrder] = useState<OrderOut | null>(null);

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
            title="Užsakymo informacija"
            onClick={() => {
              const order = orders.find((o) => o.uzsakymo_id === s.order_id);
              if (order) setOrderModalOrder(order);
            }}
            className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-purple-900/30 hover:text-purple-400"
            aria-label="Užsakymo informacija"
          >
            <FiClipboard />
          </button>
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
              } catch (err) {
                alert(formatApiError(err, "Klaida pergeneruojant sąskaitą."));
              }
            }}
            className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-amber-900/30 hover:text-amber-400"
            aria-label="Pergeneruoti"
          >
            <FiRefreshCw />
          </button>
          <ActionButtons
            onView={() => setPdfInvoice(s as InvoiceOut)}
            show={{ view: true, edit: false, delete: false }}
          />
          <InvoiceDownloadButton
            invoice={s as InvoiceOut}
            orderInfo={(() => {
              const o = orders.find((ord) => ord.uzsakymo_id === s.order_id);
              return o ? { carName: getCarName(o.automobilio_id), nuomos_data: String(o.nuomos_data), grazinimo_data: String(o.grazinimo_data) } : undefined;
            })()}
          />
        </div>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Sąskaitos</h1>
        <CreateInvoiceButton
          orders={orders}
          invoices={invoices}
          getClientName={getClientName}
          getCarName={getCarName}
          onCreated={() => {
            refetch();
          }}
        />
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
          orderInfo={(() => {
            const o = orders.find((ord) => ord.uzsakymo_id === pdfInvoice.order_id);
            return o ? { carName: getCarName(o.automobilio_id), nuomos_data: String(o.nuomos_data), grazinimo_data: String(o.grazinimo_data) } : undefined;
          })()}
          onClose={() => setPdfInvoice(null)}
        />
      )}

      {orderModalOrder && (
        <EntityModal
          title={`Užsakymas #${orderModalOrder.uzsakymo_id}`}
          entity={orderModalOrder}
          fields={orderFields}
          isOpen={!!orderModalOrder}
          onClose={() => setOrderModalOrder(null)}
        />
      )}
    </div>
  );
}
