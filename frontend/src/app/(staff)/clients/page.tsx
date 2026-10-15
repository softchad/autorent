"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/staff/EntityModal";
import LoadingScreen from "@/app/components/LoadingScreen";
import { useClientsData } from "@/hooks/useClientsData";
import CreateEntityButton from "@/app/components/staff/CreateEntityButton";
import { formatApiError } from "@/utils/formatApiError";

// Tipas IŠVEDAMAS iš paties hook'o grąžinamos reikšmės (ne importuojamas iš atskiro schemos failo) - jei useClientsData.ts pakeistų "clients" lauko formą, šis tipas AUTOMATIŠKAI atsinaujintų, nereikėtų taisyti dviejose vietose.
type Klientas = NonNullable<
  ReturnType<typeof useClientsData>["clients"]
>[number];

// Klientų administravimo lentelė (sąrašas/paieška/CRUD per modalą) - visa duomenų/API logika laikoma useClientsData.ts hook'e, šis komponentas tik renderina.
export default function ClientsPage() {
  const {
    filtered,
    isLoading,
    search,
    setSearch,
    clientFields,
    createClient,
    saveClient,
    removeClient,
  } = useClientsData();

  const [selected, setSelected] = useState<Klientas | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editMode, setEditMode] = useState(false);

  // Lentelės stulpelių aprašas DataTable'ui - "accessor" gali būti PLOKŠČIAS DB lauko vardas (DataTable pats jį skaito iš eilutės) arba FUNKCIJA (kai reikia sujungti/formatuoti keli laukus, kaip vardas+pavardė žemiau).
  const columns = [
    {
      label: "Vardas ir Pavardė",
      accessor: (k: Klientas) => `${k.vardas} ${k.pavarde}`,
    },
    { label: "El. paštas", accessor: "el_pastas" },
    { label: "Telefonas", accessor: "telefono_nr" },
    {
      label: "Registracijos data",
      // "—" (brūkšnys), ne tuščia eilutė ar "null" - DB stulpelis neturi NOT NULL apribojimo (žr. schema.sql), tad reikšmė gali realiai būti null.
      accessor: (k: Klientas) =>
        k.registracijos_data ? new Date(k.registracijos_data).toLocaleDateString("lt-LT") : "—",
    },
    {
      label: "Veiksmai",
      // Peržiūros/redagavimo/trynimo mygtukai KIEKVIENAI eilutei - "k" čia yra TOS KONKREČIOS eilutės klientas, uždarytas (closure) šiai vienai stulpelio funkcijai.
      accessor: (k: Klientas) => (
        <ActionButtons
          onView={() => {
            setSelected(k);
            setEditMode(false);
            setModalOpen(true);
          }}
          onEdit={() => {
            setSelected(k);
            setEditMode(true);
            setModalOpen(true);
          }}
          onDelete={async () => {
            const ok = window.confirm(
              `Ar tikrai norite ištrinti klientą ${k.vardas} ${k.pavarde}?`
            );
            if (!ok) return;

            try {
              // Backend (žr. client.py delete_client) baigtą/atšauktą užsakymą turintį klientą NE ištrina, bet ANONIMIZUOJA (vardas/el.paštas/telefonas pašalinami, įrašas lieka) - "anonymized: true" atsakyme sako, kuris atvejis realiai įvyko.
              const anonymized = await removeClient(k.kliento_id);
              if (anonymized) {
                alert(
                  "Klientas susietas su užsakymu/rezervacija, tad pilnai ištrinti negalima - jo asmeniniai duomenys pašalinti/anonimizuoti, o susiję įrašai palikti istorijai."
                );
              }
            } catch (e) {
              alert(e instanceof Error ? e.message : "Nepavyko ištrinti kliento.");
            }
          }}
        />
      ),
    },
  ];

  if (isLoading) return <LoadingScreen />;

  return (
    <div className="text-[#707070]">
      <div className="flex justify-between items-center mb-6 text-[#F7F7F7]">
        <h1 className="text-2xl font-bold">Klientai</h1>
        <CreateEntityButton
          buttonLabel="+ Naujas klientas"
          modalTitle="Naujas klientas"
          fields={clientFields}
          onCreate={async (data) => {
            try {
              await createClient(data);
            } catch (e) {
              // META (ne alert) - EntityModal.commit() (žr. EntityModal.tsx, CreateEntityButton.tsx apgaubia tą pačią logiką) sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(formatApiError(e, "Nepavyko sukurti kliento. Patikrinkite įvestus duomenis."));
            }
          }}
        />
      </div>

      <input
        className="border p-2 rounded mb-6 w-full max-w-md"
        placeholder="Ieškoti pagal vardą ar el. paštą"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <DataTable
        columns={columns}
        data={filtered}
        rowKey={(k) => k.kliento_id}
      />

      {selected && (
        <EntityModal
          // "key" pasikeitimas PRIVERČIA React'ą sukurti NAUJĄ EntityModal egzempliorių (ne tik atnaujinti props) - be to, persijungus iš peržiūros į redagavimą TAM PAČIAM klientui, modalo vidinė forma neatsistatytų iš senų reikšmių.
          key={`${selected.kliento_id}-${editMode}`}
          title={`#${selected.kliento_id}`}
          entity={selected}
          fields={clientFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (upd) => {
            try {
              await saveClient(selected.kliento_id, upd);
            } catch (e) {
              // META (ne alert) - EntityModal.commit() sugauna šią klaidą, parodo PRIE formos ir PALIEKA modalą atvirą, kad vartotojas neprarastų įvestų duomenų.
              throw new Error(formatApiError(e, "Nepavyko atnaujinti kliento. Patikrinkite įvestus duomenis."));
            }
          }}
          startInEdit={editMode}
        />
      )}
    </div>
  );
}
