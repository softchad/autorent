"use client";

import { useState } from "react";
import DataTable from "../components/DataTable";
import { ActionButtons } from "../components/ActionButtons";
import MapComponent from "../components/MapComponent";
import EntityModal from "../components/modals/EntityModal";
import { useCarsData } from "@/hooks/useCarsData";
import LoadingScreen from "@/app/components/loadingScreen";
import {
  useUpdateCarMutation,
  useDeleteCarMutation,
  useCreateCarMutation,
} from "@/store/enhanceEndpoints";
import CreateEntityButton from "@/app/components/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";

type Automobilis = NonNullable<
  ReturnType<typeof useCarsData>["automobiliai"]
>[number];

export default function CarsPage() {
  const {
    automobiliai,
    isLoading,
    filtered,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    selectedCar,
    setSelectedCar,
    isModalOpen,
    setModalOpen,
    carFields,
    refetchCars,
    randomizeCar,
  } = useCarsData();

  const [editMode, setEditMode] = useState(false);
  const [updateCar] = useUpdateCarMutation();
  const [deleteCar] = useDeleteCarMutation();
  const [createCar] = useCreateCarMutation();

  const columns = [
    {
      label: "Modelis",
      accessor: (a: Automobilis) => `${a.marke} ${a.modelis}`,
    },
    { label: "Numeris", accessor: "numeris" },
    { label: "Būsena", accessor: "automobilio_statusas" },
    { label: "Sėdimos vietos", accessor: "sedimos_vietos" },
    {
      label: "Kaina",
      accessor: (a: Automobilis) => `${a.kaina_parai} €`,
    },
    {
      label: "Veiksmai",
      accessor: (a: Automobilis) => (
        <ActionButtons
          onEdit={() => {
            setSelectedCar(a);
            setEditMode(true);
            setModalOpen(true);
          }}
          onDelete={async () => {
            const confirmed = window.confirm(
              `Ar tikrai norite ištrinti automobilį „${a.marke} ${a.modelis}"?`
            );
            if (!confirmed) return;

            try {
              await deleteCar({ carId: a.automobilio_id }).unwrap();
              setSelectedCar(null);
            } catch (e: any) {
              console.error("Klaida trinant automobilį:", e);
              alert(
                "Šio automobilio ištrinti negalima, nes jis susijęs su užsakymais ar kita informacija."
              );
            }
          }}
        />
      ),
    },
  ];

  if (isLoading) return <LoadingScreen />;

  return (
    <div>
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-[#F7F7F7]">Automobiliai</h1>
        <CreateEntityButton
          buttonLabel="+ Pridėti automobilį"
          modalTitle="Naujas automobilis"
          fields={carFields}
          randomize={randomizeCar}
          onCreate={async (data) => {
            try {
              await createCar({ carCreate: data as any }).unwrap();
              await refetchCars();
            } catch (e: any) {
              alert(formatApiError(e, "Nepavyko sukurti automobilio. Patikrinkite įvestus duomenis."));
            }
          }}
        />
      </div>

      <div className="flex flex-wrap gap-4 mb-6 text-[#707070]">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Ieškoti..."
          className="border p-2 rounded w-64"
        />
        <select
          className="border p-2 rounded"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="visi">Visi</option>
          <option value="laisvas">Laisvas</option>
          <option value="isnuomotas">Išnuomotas</option>
          <option value="servise">Servise</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(a) => a.automobilio_id}
        itemsPerPage={5}
      />

      <MapComponent cars={filtered} />

      {selectedCar && (
        <EntityModal
          title={`${selectedCar.marke} ${selectedCar.modelis}`}
          entity={selectedCar}
          fields={carFields}
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSave={async (updated) => {
            try {
              await updateCar({
                carId: selectedCar.automobilio_id,
                carUpdate: {
                  marke: updated.marke,
                  modelis: updated.modelis,
                  metai: updated.metai,
                  numeris: updated.numeris,
                  vin_kodas: updated.vin_kodas,
                  spalva: updated.spalva,
                  kebulo_tipas: updated.kebulo_tipas,
                  pavarų_deze: updated.pavarų_deze,
                  variklio_turis: updated.variklio_turis,
                  galia_kw: updated.galia_kw,
                  kuro_tipas: updated.kuro_tipas,
                  rida: updated.rida,
                  sedimos_vietos: updated.sedimos_vietos,
                  klimato_kontrole: updated.klimato_kontrole,
                  navigacija: updated.navigacija,
                  kaina_parai: updated.kaina_parai,
                  automobilio_statusas: updated.automobilio_statusas,
                  technikines_galiojimas: updated.technikines_galiojimas,
                  dabartine_vieta_id: updated.dabartine_vieta_id,
                  pastabos: updated.pastabos,
                },
              }).unwrap();
              await refetchCars();
              setModalOpen(false);
            } catch (e) {
              console.error("Nepavyko atnaujinti automobilio:", e);
            }
          }}
          startInEdit={false}
        />
      )}
    </div>
  );
}
