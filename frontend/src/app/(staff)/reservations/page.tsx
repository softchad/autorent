"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/modals/EntityModal";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useReservationData } from "@/hooks/useReservationData";
import StatusBadge from "@/app/components/StatusBadge";
import CreateEntityButton from "@/app/components/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";
import type { ReservationUpdate } from "@/store/carRentalApi";
import { FiCheck, FiMapPin } from "react-icons/fi";
import Image from "next/image";
import { getCarPhoto } from "@/utils/carPhoto";

type Rezervacija = NonNullable<
  ReturnType<typeof useReservationData>["reservations"]
>[number];

export default function ReservationsPage() {
  const [selected, setSelected] = useState<Rezervacija | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  const {
    filtered,
    isLoading,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    getClientName,
    getCarName,
    cars,
    handleDelete,
    reservationFields,
    saveReservation,
  } = useReservationData();

  const columns = [
    {
      label: "Klientas",
      accessor: (r: Rezervacija) => getClientName(r.kliento_id),
    },
    {
      label: "Automobilis",
      accessor: (r: Rezervacija) => getCarName(r.automobilio_id),
    },
    { label: "Pradžia", accessor: "rezervacijos_pradzia" },
    { label: "Pabaiga", accessor: "rezervacijos_pabaiga" },
    {
      label: "Būsena",
      accessor: (r: Rezervacija) => <StatusBadge status={r.busena} />,
    },
    {
      label: "Veiksmai",
      accessor: (r: Rezervacija) => (
        <ActionButtons
          show={{ view: true, edit: true, delete: true, extra: r.busena === "laukia" }}
          extraLabel="Patvirtinti"
          extraIcon={<FiCheck className="text-base" />}
          onExtra={async () => {
            if (!window.confirm("Patvirtinti šią rezervaciją?")) return;
            try {
              await saveReservation(r.rezervacijos_id, { busena: "patvirtinta" });
            } catch (err) {
              alert(formatApiError(err, "Nepavyko patvirtinti rezervacijos."));
            }
          }}
          onView={() => {
            setSelected(r);
            setEditMode(false);
            setModalOpen(true);
          }}
          onEdit={() => {
            setSelected(r);
            setEditMode(true);
            setModalOpen(true);
          }}
          onDelete={async () => {
            if (!window.confirm("Ar tikrai norite atšaukti rezervaciją?")) return;
            try {
              await handleDelete(r.rezervacijos_id);
            } catch (err) {
              alert(formatApiError(err, "Nepavyko ištrinti rezervacijos."));
            }
          }}
        />
      ),
    },
  ];

  const onSave = async (updated: ReservationUpdate) => {
    const cleaned = {
      ...updated,
      rezervacijos_pradzia: updated.rezervacijos_pradzia ?? undefined,
      rezervacijos_pabaiga: updated.rezervacijos_pabaiga ?? undefined,
      busena: updated.busena ?? undefined,
      kliento_id: updated.kliento_id ?? undefined,
      automobilio_id: updated.automobilio_id ?? undefined,
    };
    await saveReservation(selected!.rezervacijos_id, cleaned);
  };

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6 text-[#707070]">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Rezervacijos</h1>
        <CreateEntityButton
          buttonLabel="+ Nauja rezervacija"
          modalTitle="Nauja rezervacija"
          fields={reservationFields}
          onCreate={async (data) => {
            try {
              await saveReservation(null, data);
              alert("Rezervacija sėkmingai išsaugota!");
            } catch (err) {
              const e = err as { status?: number; response?: { status?: number } };
              const status = e.status ?? e.response?.status;
              if (status === 409) {
                alert("Automobilis šiuo laikotarpiu jau rezervuotas.");
              } else {
                alert(formatApiError(err, "Nepavyko sukurti rezervacijos. Patikrinkite įvestus duomenis."));
                console.error("Klaida:", err);
              }
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[#707070]">
        <input
          type="text"
          className="border p-2 rounded w-64"
          placeholder="Ieškoti..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="border p-2 rounded"
          value={statusFilter}
          onChange={(e) =>
            setStatusFilter(
              e.target.value as "visi" | "patvirtinta" | "laukia" | "atšaukta"
            )
          }
        >
          <option value="visi">Visos</option>
          <option value="patvirtinta">Patvirtintos</option>
          <option value="laukia">Laukiančios</option>
          <option value="atšaukta">Atšauktos</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(r) => r.rezervacijos_id}
      />

      {selected && (
        <EntityModal
          key={`${selected.rezervacijos_id}-${editMode}`}
          title={`Rezervacija #${selected.rezervacijos_id}`}
          entity={selected}
          fields={reservationFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={onSave}
          startInEdit={editMode}
          renderExtra={(r) => {
            const car = cars.find((c) => c.automobilio_id === r.automobilio_id);
            if (!car) return null;
            return (
              <div className="flex gap-3 rounded-xl border border-[#1C2B3A] bg-[#0E0B1F] p-3">
                <div className="relative h-16 w-24 shrink-0 overflow-hidden rounded-lg bg-[#1A2238]">
                  <Image src={getCarPhoto(car)} alt={`${car.marke} ${car.modelis}`} fill sizes="96px" className="object-cover" />
                </div>
                <div className="min-w-0 text-sm">
                  <p className="font-semibold text-[#F7F7F7]">{car.marke} {car.modelis} ({car.metai})</p>
                  <p className="text-[#8899AA]">{car.kaina_parai} €/parai &bull; {car.automobilio_statusas}</p>
                  {car.lokacija && (
                    <p className="flex items-center gap-1 text-[#8899AA]">
                      <FiMapPin className="shrink-0" /> {car.lokacija.pavadinimas}, {car.lokacija.miestas}
                    </p>
                  )}
                </div>
              </div>
            );
          }}
        />
      )}
    </div>
  );
}
