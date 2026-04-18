"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/modals/EntityModal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingScreen from "@/app/components/loadingScreen";
import { useOrdersData } from "@/hooks/useOrdersData";
import type { OrderOut } from "@/store/carRentalApi";
import CreateEntityButton from "@/app/components/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";
import { useCreateInvoiceMutation, useDeleteInvoiceMutation, useGetAllInvoicesQuery } from "@/store/carRentalApi";
import { FiFileText } from "react-icons/fi";

export default function OrdersPage() {
  const [selected, setSelected] = useState<OrderOut | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const [createInvoice] = useCreateInvoiceMutation();
  const [deleteInvoice] = useDeleteInvoiceMutation();
  const { data: allInvoices = [], refetch: refetchInvoices } = useGetAllInvoicesQuery();

  const {
    filtered,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    getClientName,
    getCarName,
    saveOrder,
    handleDelete,
    orderFields,
    cars,
    initialEmployeeId,
  } = useOrdersData();

  const columns = [
    {
      label: "Klientas",
      accessor: (o: OrderOut) => getClientName(o.kliento_id),
    },
    {
      label: "Automobilis",
      accessor: (o: OrderOut) => getCarName(o.automobilio_id),
    },
    { label: "Pradžia", accessor: "nuomos_data" },
    { label: "Pabaiga", accessor: "grazinimo_data" },
    {
      label: "Būsena",
      accessor: (o: OrderOut) => (
        <StatusBadge status={o.uzsakymo_busena || ""} />
      ),
    },
    {
      label: "Veiksmai",
      accessor: (o: OrderOut) => (
        <div className="flex items-center gap-1">
        <button
          title="Išrašyti / pergeneruoti sąskaitą"
          onClick={async () => {
            try {
              const existing = allInvoices.find((inv) => inv.order_id === o.uzsakymo_id);
              if (existing) {
                await deleteInvoice({ invoiceId: existing.invoice_id }).unwrap();
              }
              await createInvoice({
                invoiceCreate: {
                  order_id: o.uzsakymo_id,
                  total: o.bendra_kaina,
                  invoice_date: new Date().toISOString().slice(0, 10),
                },
              }).unwrap();
              await refetchInvoices();
              alert(`Sąskaita užsakymui #${o.uzsakymo_id} sėkmingai ${existing ? "pergeneruota" : "išrašyta"}!`);
            } catch (err: any) {
              alert("Klaida išrašant sąskaitą.");
              console.error(err);
            }
          }}
          className="text-lg text-gray-600 hover:text-teal-500 transition-colors px-1"
          aria-label="Išrašyti sąskaitą"
        >
          <FiFileText />
        </button>
        <ActionButtons
          onEdit={() => {
            setSelected(o);
            setModalOpen(true);
          }}
          onDelete={async () => {
            const confirmed = window.confirm(
              `Ar tikrai norite ištrinti užsakymą #${o.uzsakymo_id}?`
            );
            if (!confirmed) return;
            try {
              await handleDelete(o.uzsakymo_id);
            } catch (e) {
              alert(
                "Nepavyko ištrinti užsakymo. Jis gali būti susietas su kitais įrašais (pvz., sąskaitomis ar mokėjimais)."
              );
            }
          }}
        />
        </div>
      ),
    },
  ];

  const onSave = async (updated: OrderOut) => {
    try {
      await saveOrder(selected!.uzsakymo_id, {
        kliento_id: updated.kliento_id,
        automobilio_id: updated.automobilio_id,
        darbuotojo_id: updated.darbuotojo_id,
        nuomos_data: updated.nuomos_data,
        grazinimo_data: updated.grazinimo_data,
        grazinimo_vietos_id: updated.grazinimo_vietos_id,
        uzsakymo_busena: updated.uzsakymo_busena,
        turi_papildomas_paslaugas: updated.turi_papildomas_paslaugas,
        bendra_kaina: updated.bendra_kaina,
      });

      setModalOpen(false);
      setSelected(null);
      alert("Užsakymas sėkmingai išsaugotas!");
    } catch (err: any) {
      const status = err?.status ?? err?.response?.status;
      if (status === 409) {
        alert("Automobilis šiuo laikotarpiu jau užimtas.");
      } else {
        alert(formatApiError(err, "Nepavyko išsaugoti užsakymo. Patikrinkite įvestus duomenis."));
        console.error("Klaida išsaugant užsakymą:", JSON.stringify(err));
      }
    }
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="text-[#707070]">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Užsakymai</h1>
        <CreateEntityButton
          buttonLabel="+ Naujas užsakymas"
          modalTitle="Naujas užsakymas"
          extraData={{ cars }}
          initial={{
            darbuotojo_id: initialEmployeeId ?? undefined,
          }}
          fields={orderFields}
          onCreate={async (data) => {
            try {
              await saveOrder(null, data);
              alert("Užsakymas sėkmingai sukurtas!");
            } catch (err: any) {
              const status = err?.status ?? err?.response?.status;
              if (status === 409) {
                alert("Automobilis šiuo laikotarpiu jau užimtas.");
              } else {
                alert(formatApiError(err, "Nepavyko sukurti užsakymo. Patikrinkite įvestus duomenis."));
                console.error("Klaida kuriant užsakymą:", JSON.stringify(err));
              }
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-4 mb-6">
        <input
          className="border p-2 rounded w-64"
          placeholder="Ieškoti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border p-2 rounded"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="visi">Visi</option>
          <option value="laukiama">Laukiama</option>
          <option value="vykdoma">Vykdoma</option>
          <option value="užbaigta">Užbaigta</option>
          <option value="atšaukta">Atšaukta</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.uzsakymo_id}
      />

      {selected && (
        <EntityModal
          title={`#${selected.uzsakymo_id}`}
          entity={selected}
          fields={orderFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={onSave}
          startInEdit={false}
          extraData={{ cars }}
        />
      )}
    </div>
  );
}
