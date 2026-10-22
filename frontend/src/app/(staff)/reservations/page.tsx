"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/staff/EntityModal";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useReservationData } from "@/hooks/useReservationData";
import StatusBadge from "@/app/components/StatusBadge";
import CreateEntityButton from "@/app/components/staff/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";
import type { ReservationUpdate, OrderCreate } from "@/store/autorentApi";
import { useGetCurrentUserQuery, useCreateOrderMutation } from "@/store/autorentApi";
import { FiCheck, FiMapPin } from "react-icons/fi";
import Image from "next/image";
import { getCarPhoto } from "@/utils/carPhoto";

// Tipas IŠVEDAMAS iš paties hook'o grąžinamos reikšmės (ne importuojamas iš atskiro schemos failo) - jei useReservationData.ts pakeistų "reservations" lauko formą, šis tipas AUTOMATIŠKAI atsinaujintų.
type Rezervacija = NonNullable<
  ReturnType<typeof useReservationData>["reservations"]
>[number];

// Rezervacijų administravimas (sąrašas/paieška/statuso filtras/greitas patvirtinimas/CRUD per modalą).
export default function ReservationsPage() {
  const { data: currentUser } = useGetCurrentUserQuery();
  const [createOrder, { isLoading: converting }] = useCreateOrderMutation();
  // Trynimas backend'e reikalauja Perm.ADMIN (žr. reservation.py delete_reservation - "negrįžtamas veiksmas"), ne vien Perm.EDIT kaip redagavimas - be šios patikros bet kuris EDIT teisę turintis darbuotojas matytų trynimo mygtuką, kurį paspaudus serveris atmestų su 403.
  const isAdmin = currentUser?.pareigos === "Administratorius";

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
      sortValue: (r: Rezervacija) => getClientName(r.kliento_id),
    },
    {
      label: "Automobilis",
      accessor: (r: Rezervacija) => getCarName(r.automobilio_id),
      sortValue: (r: Rezervacija) => getCarName(r.automobilio_id),
    },
    { label: "Pradžia", accessor: "rezervacijos_pradzia" },
    { label: "Pabaiga", accessor: "rezervacijos_pabaiga" },
    {
      label: "Būsena",
      accessor: (r: Rezervacija) => <StatusBadge status={r.busena} />,
      sortValue: (r: Rezervacija) => r.busena,
    },
    {
      label: "Veiksmai",
      // "r" čia yra TOS KONKREČIOS eilutės rezervacija, uždaryta (closure) šiai vienai stulpelio funkcijai.
      accessor: (r: Rezervacija) => (
        <ActionButtons
          show={{ view: true, edit: true, delete: isAdmin, extra: !converting && (r.busena === "laukia" || r.busena === "patvirtinta") }}
          extraLabel={r.busena === "patvirtinta" ? "Išnuomoti" : "Patvirtinti"}
          extraIcon={<FiCheck className="text-base" />}
          onExtra={async () => {
            if (r.busena === "patvirtinta") {
              const car = cars.find((c) => c.automobilio_id === r.automobilio_id);
              if (!currentUser || !car?.lokacija || converting) return;
              if (!window.confirm("Sukurti nuomos užsakymą iš šios rezervacijos?")) return;
              const days = Math.max(1, Math.round((Date.parse(r.rezervacijos_pabaiga) - Date.parse(r.rezervacijos_pradzia)) / 86400000));
              const orderCreate: OrderCreate & { rezervacijos_id: number } = {
                rezervacijos_id: r.rezervacijos_id,
                kliento_id: r.kliento_id, automobilio_id: r.automobilio_id,
                darbuotojo_id: currentUser.darbuotojo_id,
                nuomos_data: r.rezervacijos_pradzia, grazinimo_data: r.rezervacijos_pabaiga,
                paemimo_vietos_id: car.lokacija.vietos_id, grazinimo_vietos_id: car.lokacija.vietos_id,
                bendra_kaina: days * car.kaina_parai,
                uzsakymo_busena: "patvirtinta", turi_papildomas_paslaugas: false,
              };
              try {
                const created = await createOrder({ orderCreate }).unwrap();
                alert(`Sukurtas užsakymas #${created.uzsakymo_id}. Tęskite skiltyje „Užsakymai“.`);
              } catch (err) {
                alert(formatApiError(err, "Nepavyko sukurti užsakymo."));
              }
              return;
            }
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
            if (!window.confirm("Ar tikrai norite negrįžtamai ištrinti rezervaciją?")) return;
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

  // 409 reiškia konkretų, žinomą konfliktą (automobilis užimtas) - IR čia, IR onCreate žemiau gali jį gauti, tad žinutė parenkama ta pati, nekartojant patikros kodo du kartus.
  const conflictAwareErrorMessage = (err: unknown, fallback: string): string => {
    const e = err as { status?: number; response?: { status?: number } };
    const status = e.status ?? e.response?.status;
    return status === 409 ? "Automobilis šiuo laikotarpiu jau rezervuotas." : formatApiError(err, fallback);
  };

  // META (ne alert) - EntityModal.commit() (žr. EntityModal.tsx) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
  const onSave = async (updated: ReservationUpdate) => {
    try {
      await saveReservation(selected!.rezervacijos_id, updated);
    } catch (err) {
      throw new Error(conflictAwareErrorMessage(err, "Nepavyko išsaugoti rezervacijos. Patikrinkite įvestus duomenis."));
    }
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
              // META (ne alert) - EntityModal.commit() (CreateEntityButton.tsx apgaubia tą pačią logiką) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(conflictAwareErrorMessage(err, "Nepavyko sukurti rezervacijos. Patikrinkite įvestus duomenis."));
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
