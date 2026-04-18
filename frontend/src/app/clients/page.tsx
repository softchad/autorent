"use client";

import { useState } from "react";
import DataTable from "@/app/components/DataTable";
import { ActionButtons } from "@/app/components/ActionButtons";
import EntityModal from "@/app/components/modals/EntityModal";
import LoadingScreen from "@/app/components/loadingScreen";
import { useClientsData } from "@/hooks/useClientsData";
import CreateEntityButton from "@/app/components/CreateEntityButton";

type Klientas = NonNullable<
  ReturnType<typeof useClientsData>["clients"]
>[number];

export default function ClientsPage() {
  const {
    filtered,
    isLoading,
    search,
    setSearch,
    clientFields,
    randomizeClient,
    createClient,
    saveClient,
    removeClient,
  } = useClientsData();

  const [selected, setSelected] = useState<Klientas | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const columns = [
    {
      label: "Vardas ir Pavardė",
      accessor: (k: Klientas) => `${k.vardas} ${k.pavarde}`,
    },
    { label: "El. paštas", accessor: "el_pastas" },
    { label: "Telefonas", accessor: "telefono_nr" },
    {
      label: "Registracijos data",
      accessor: (k: Klientas) =>
        k.registracijos_data ? new Date(k.registracijos_data).toLocaleDateString("lt-LT") : "—",
    },
    { label: "Bonus taškai", accessor: "bonus_taskai" },
    {
      label: "Veiksmai",
      accessor: (k: Klientas) => (
        <ActionButtons
          onEdit={() => {
            setSelected(k);
            setModalOpen(true);
          }}
          onDelete={async () => {
            const ok = window.confirm(
              `Ar tikrai norite ištrinti klientą ${k.vardas} ${k.pavarde}?`
            );
            if (!ok) return;

            try {
              await removeClient(k.kliento_id);
            } catch (e: any) {
              console.error("Nepavyko ištrinti kliento:", e);
              alert(
                "Šio kliento ištrinti negalima, nes jis susietas su užsakymais ar kitais įrašais."
              );
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
          randomize={randomizeClient}
          onCreate={async (data) => {
            await createClient(data);
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
          title={`#${selected.kliento_id}`}
          entity={selected}
          fields={clientFields}
          isOpen={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setSelected(null);
          }}
          onSave={async (upd) => {
            await saveClient(selected.kliento_id, upd);
            setModalOpen(false);
            setSelected(null);
          }}
          startInEdit={false}
        />
      )}
    </div>
  );
}
