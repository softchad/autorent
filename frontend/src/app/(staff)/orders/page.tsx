"use client";

import { localISO } from "@/utils/formatLt";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/staff/EntityModal";
import StatusBadge from "@/app/components/StatusBadge";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useOrdersData } from "@/hooks/useOrdersData";
import type { OrderOut } from "@/store/autorentApi";
import CreateEntityButton from "@/app/components/staff/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";
import {
  useCreateInvoiceMutation,
  useGetAllInvoicesQuery,
} from "@/store/autorentApi";
import { FiFile } from "react-icons/fi";

// Užsakymų administravimas (sąrašas/paieška/statuso filtras/sąskaitos išrašymas/CRUD per modalą).
export default function OrdersPage() {
  const [selected, setSelected] = useState<OrderOut | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const [createInvoice] = useCreateInvoiceMutation();
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
    orderEditFields,
    createOrderFields,
    cars,
    initialEmployeeId,
  } = useOrdersData();

  const columns = [
    {
      label: "Klientas",
      accessor: (o: OrderOut) => getClientName(o.kliento_id),
      sortValue: (o: OrderOut) => getClientName(o.kliento_id),
    },
    {
      label: "Automobilis",
      accessor: (o: OrderOut) => getCarName(o.automobilio_id),
      sortValue: (o: OrderOut) => getCarName(o.automobilio_id),
    },
    { label: "Pradžia", accessor: "nuomos_data" },
    { label: "Pabaiga", accessor: "grazinimo_data" },
    {
      label: "Būsena",
      accessor: (o: OrderOut) => (
        <StatusBadge status={o.uzsakymo_busena || ""} />
      ),
      sortValue: (o: OrderOut) => o.uzsakymo_busena || null,
    },
    {
      label: "Veiksmai",
      // "o" čia yra TOS KONKREČIOS eilutės užsakymas, uždarytas (closure) šiai vienai stulpelio funkcijai.
      accessor: (o: OrderOut) => {
        const existing = allInvoices.find((inv) => inv.order_id === o.uzsakymo_id);
        return (
        <div className="flex items-center gap-1">
        {!existing && (
        <button
          title={existing ? "Pergeneruoti sąskaitą" : "Išrašyti sąskaitą"}
          onClick={async () => {
            try {
              await createInvoice({
                invoiceCreate: {
                  order_id: o.uzsakymo_id,
                  total: o.bendra_kaina,
                  invoice_date: localISO(new Date()),
                },
              }).unwrap();
              await refetchInvoices();
              alert(`Sąskaita užsakymui #${o.uzsakymo_id} sėkmingai ${existing ? "pergeneruota" : "išrašyta"}!`);
            } catch (err) {
              alert(formatApiError(err, "Klaida išrašant sąskaitą."));
            }
          }}
          className="p-1.5 rounded-lg transition-all text-base text-[#3D4F63] hover:bg-amber-900/30 hover:text-amber-400"
          aria-label={existing ? "Pergeneruoti sąskaitą" : "Išrašyti sąskaitą"}
        >
          <FiFile />
        </button>
        )}
        <ActionButtons
          onView={() => {
            setSelected(o);
            setEditMode(false);
            setModalOpen(true);
          }}
          onEdit={() => {
            setSelected(o);
            setEditMode(true);
            setModalOpen(true);
          }}
          onDelete={async () => {
            const confirmed = window.confirm(
              `Ar tikrai norite ištrinti užsakymą #${o.uzsakymo_id}?`
            );
            if (!confirmed) return;
            try {
              await handleDelete(o.uzsakymo_id);
            } catch (err) {
              alert(
                formatApiError(
                  err,
                  "Nepavyko ištrinti užsakymo. Jis gali būti susietas su kitais įrašais (pvz., sąskaitomis ar mokėjimais)."
                )
              );
            }
          }}
        />
        </div>
        );
      },
    },
  ];

  // 409 reiškia konkretų, žinomą konfliktą (automobilis užimtas) - IR saveOrder (redagavimas), IR CreateEntityButton'o onCreate žemiau gali jį gauti, tad ta pati patikra NEgali būti parašyta vieną kartą kaip bendra funkcija be dviejų atskirų "catch" blokų, bet ŽINUTĖ parenkama ta pati.
  const conflictAwareErrorMessage = (err: unknown, fallback: string): string => {
    const e = err as { status?: number; response?: { status?: number } };
    const status = e.status ?? e.response?.status;
    return status === 409 ? "Automobilis šiuo laikotarpiu jau užimtas." : formatApiError(err, fallback);
  };

  // Backend (OrderUpdate schemas/order.py) TIKRAI pritaiko TIK šiuos 3 laukus - žr. išsamų komentarą useOrdersData.ts faile prie orderEditFields. Kiti "updated" laukai (klientas/automobilis/kaina ir t.t.) ČIA sąmoningai NEsiunčiami, nes jie backend'e visada būtų ignoruojami.
  const onSave = async (updated: OrderOut) => {
    try {
      await saveOrder(selected!.uzsakymo_id, {
        uzsakymo_busena: updated.uzsakymo_busena,
        grazinimo_data: updated.grazinimo_data,
        turi_papildomas_paslaugas: updated.turi_papildomas_paslaugas,
      });
      alert("Užsakymas sėkmingai išsaugotas!");
    } catch (err) {
      // META (ne alert) - EntityModal.commit() (žr. EntityModal.tsx) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
      throw new Error(conflictAwareErrorMessage(err, "Nepavyko išsaugoti užsakymo. Patikrinkite įvestus duomenis."));
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
          fields={createOrderFields}
          onCreate={async (data) => {
            try {
              await saveOrder(null, data);
              alert("Užsakymas sėkmingai sukurtas!");
            } catch (err) {
              // META (ne alert) - EntityModal.commit() (CreateEntityButton.tsx apgaubia tą pačią logiką) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(conflictAwareErrorMessage(err, "Nepavyko sukurti užsakymo. Patikrinkite įvestus duomenis."));
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
          {/* Reikšmės TIKSLIAI sutampa su backend'o VALID_BUSENA (schemas/order.py) - jei kuri trūktų, tos būsenos užsakymų filtras niekada nerastų, nes jų reikšmė nesutaptų su niekuo galimame sąraše. */}
          <option value="visi">Visi</option>
          <option value="laukiama">Laukiama</option>
          <option value="patvirtinta">Patvirtinta</option>
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
          key={`${selected.uzsakymo_id}-${editMode}`}
          title={`#${selected.uzsakymo_id} - ${getClientName(selected.kliento_id)} (${getCarName(selected.automobilio_id)})`}
          entity={selected}
          fields={orderEditFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={onSave}
          startInEdit={editMode}
          extraData={{ cars }}
        />
      )}
    </div>
  );
}
