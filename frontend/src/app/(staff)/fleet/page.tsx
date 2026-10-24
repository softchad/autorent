"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import dynamic from "next/dynamic";

// "dynamic(..., { ssr: false })" - žemėlapio biblioteka (Leaflet) tiesiogiai naudoja "window"/DOM, kurio NĖRA serverio pusės renderinimo metu; be "ssr: false" puslapis sulūžtų bandant jį atvaizduoti serveryje. "loading" rodomas, kol komponento JS pakrautas naršyklėje.
const MapComponent = dynamic(() => import("@/app/components/staff/MapComponent"), {
  ssr: false,
  loading: () => (
    <div className="flex items-center justify-center h-[500px] mt-6 rounded-lg bg-[#0f172a] text-slate-400">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
        <span className="text-sm">Žemėlapis kraunamas...</span>
      </div>
    </div>
  ),
});
import EntityModal from "@/app/components/staff/EntityModal";
import { useCarsData } from "@/hooks/useCarsData";
import LoadingScreen from "@/app/components/LoadingScreen";
import {
  useUpdateCarMutation,
  useDeleteCarMutation,
  useCreateCarMutation,
} from "@/store/enhanceEndpoints";
import type { CarCreate } from "@/store/autorentApi";
import CreateEntityButton from "@/app/components/staff/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";
import { useGetCurrentUserQuery } from "@/store/autorentApi";

// Tipas IŠVEDAMAS iš paties hook'o grąžinamos reikšmės (ne importuojamas iš atskiro schemos failo) - jei useCarsData.ts pakeistų "automobiliai" lauko formą, šis tipas AUTOMATIŠKAI atsinaujintų.
type Automobilis = NonNullable<
  ReturnType<typeof useCarsData>["automobiliai"]
>[number];

// Automobilių parko administravimas (sąrašas/paieška/statuso filtras/žemėlapis/CRUD per modalą) - skirtingai nuo VIEŠO katalogo (/automobiliai), šis puslapis rodo VISUS automobilius (ir "servise"/"remonte"), su vidiniais laukais (VIN, numeris), kurių viešas katalogas niekada nerodo.
export default function CarsPage() {
  const { data: currentUser } = useGetCurrentUserQuery();
  // Trynimas backend'e reikalauja Perm.ADMIN (žr. car.py delete_car), ne vien Perm.EDIT kaip redagavimas - be šios patikros bet kuris EDIT teisę turintis darbuotojas (Mechanikas, Klientų aptarnavimas) matytų trynimo mygtuką, kurį paspaudus serveris VISTIEK atmestų su 403.
  const isAdmin = currentUser?.pareigos === "Administratorius";

  const {
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
  } = useCarsData();

  const [editMode, setEditMode] = useState(false);
  const [updateCar] = useUpdateCarMutation();
  const [deleteCar] = useDeleteCarMutation();
  const [createCar] = useCreateCarMutation();

  // Lentelės stulpelių aprašas DataTable'ui - "accessor" gali būti PLOKŠČIAS DB lauko vardas arba FUNKCIJA (kai reikia sujungti/formatuoti keli laukus, kaip markė+modelis arba kaina su "€" žemiau).
  const columns = [
    {
      label: "Modelis",
      accessor: (a: Automobilis) => `${a.marke} ${a.modelis}`,
      sortValue: (a: Automobilis) => `${a.marke} ${a.modelis}`,
    },
    { label: "Numeris", accessor: "numeris" },
    { label: "Būsena", accessor: "automobilio_statusas" },
    { label: "Sėdimos vietos", accessor: "sedimos_vietos" },
    {
      label: "Kaina",
      // Rodoma BE ".toFixed(2)" - tas pats raštas naudojamas IR viešame AutomobiliaiClient.tsx/CarDetailClient.tsx (sąžiningumo/nuoseklumo dėlei, tas pats skaičius visur atrodo vienodai).
      accessor: (a: Automobilis) => `${a.kaina_parai} €`,
      sortValue: (a: Automobilis) => Number(a.kaina_parai),
    },
    {
      label: "Veiksmai",
      // Peržiūros/redagavimo/trynimo mygtukai KIEKVIENAI eilutei - "a" čia yra TOS KONKREČIOS eilutės automobilis, uždarytas (closure) šiai vienai stulpelio funkcijai.
      accessor: (a: Automobilis) => (
        <ActionButtons
          onView={() => {
            setSelectedCar(a);
            setEditMode(false);
            setModalOpen(true);
          }}
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
              await refetchCars();
            } catch (err) {
              alert(
                formatApiError(
                  err,
                  "Šio automobilio ištrinti negalima, nes jis susijęs su užsakymais ar kita informacija."
                )
              );
            }
          }}
          // "view"/"edit" PRIVALO būti nurodyti ČIA (ne tik "delete") - ActionButtons "show" NESUJUNGIAMAS su numatytuoju {view:true,edit:true,delete:true}, jis PILNAI PAKEIČIAMAS, tad praleistas raktas reikštų PASLĖPTĄ mygtuką, ne numatytą "true".
          show={{ view: true, edit: true, delete: isAdmin }}
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
          onCreate={async (data) => {
            try {
              // "data" tipas (CreateEntityButton.tsx) yra Partial<Automobilis> - TypeScript tad kiekvieną CarCreate lauką laiko GALIMAI nesamu, nors RUNTIME metu EntityModal.commit() jau užtikrino, kad VISI "required: true" laukai (carFields, žr. useCarsData.ts) užpildyti.
              await createCar({ carCreate: data as CarCreate }).unwrap();
              await refetchCars();
            } catch (e) {
              // META (ne alert) - EntityModal.commit() (CreateEntityButton.tsx apgaubia tą pačią EntityModal.tsx logiką) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(formatApiError(e, "Nepavyko sukurti automobilio. Patikrinkite įvestus duomenis."));
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
          <option value="remonte">Remonte</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(a) => a.automobilio_id}
        itemsPerPage={10}
      />

      <MapComponent cars={filtered} />

      {selectedCar && (
        <EntityModal
          key={`${selectedCar.automobilio_id}-${editMode}`}
          title={`${selectedCar.marke} ${selectedCar.modelis}`}
          entity={selectedCar}
          fields={carFields}
          isOpen={isModalOpen}
          onClose={() => setModalOpen(false)}
          onSave={async (updated) => {
            try {
              // EntityModal grąžintas automobilio objektas perduodamas atnaujinimui; backend CarUpdate priima savo schemos laukus ir ignoruoja atsakymui skirtus automobilio_id bei links.
              await updateCar({
                carId: selectedCar.automobilio_id,
                carUpdate: updated,
              }).unwrap();
              await refetchCars();
            } catch (e) {
              // META (ne alert) - EntityModal.commit() (žr. EntityModal.tsx) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(formatApiError(e, "Nepavyko atnaujinti automobilio. Patikrinkite įvestus duomenis."));
            }
          }}
          startInEdit={editMode}
        />
      )}
    </div>
  );
}
