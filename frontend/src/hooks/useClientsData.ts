import { useState, useMemo } from "react";
import {
  ClientOut,
  ClientCreate,
  ClientUpdate,
  useGetAllClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} from "@/store/autorentApi";
import { FieldConfig } from "@/app/components/modals/EntityModal";

export function useClientsData() {
  const { data: clients = [], isLoading, refetch } = useGetAllClientsQuery();
  const [createClientMutation, { isLoading: creating }] = useCreateClientMutation();
  const [updateClient, { isLoading: saving }] = useUpdateClientMutation();
  const [deleteClient, { isLoading: removing }] = useDeleteClientMutation();
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      clients.filter((k) =>
        `${k.vardas} ${k.pavarde} ${k.el_pastas}`
          .toLowerCase()
          .includes(search.toLowerCase())
      ),
    [clients, search]
  );

  const clientFields: FieldConfig<ClientOut>[] = [
    { name: "vardas", label: "Vardas", type: "text", required: true },
    { name: "pavarde", label: "Pavardė", type: "text", required: true },
    { name: "el_pastas", label: "El. paštas", type: "text", required: true },
    { name: "telefono_nr", label: "Telefono nr.", type: "text", required: true },
    { name: "gimimo_data", label: "Gimimo data", type: "date", required: true },
    {
      name: "registracijos_data",
      label: "Registracijos data",
      type: "date",
      required: true,
      format: (value) =>
        value ? new Date(String(value)).toLocaleDateString("lt-LT") : "—",
    },
  ];

  const createClient = async (data: Partial<ClientOut>) => {
    await createClientMutation({ clientCreate: data as ClientCreate }).unwrap();
    await refetch();
  };

  const saveClient = async (id: number, data: Partial<ClientOut>) => {
    await updateClient({ klientoId: id, clientUpdate: data as ClientUpdate }).unwrap();
    await refetch();
  };

  // Grąžina true, jei klientas buvo ANONIMIZUOTAS (ne pilnai ištrintas) - tai įvyksta, kai
  // jis susietas su užsakymu/rezervacija ir backend'as pats automatiškai pasirinko šį kelią
  // (žr. app/api/v1/endpoints/client.py delete_client) - čia tik informuojame darbuotoją.
  const removeClient = async (id: number): Promise<boolean> => {
    try {
      const result = (await deleteClient({ klientoId: id }).unwrap()) as { anonymized?: boolean };
      await refetch();
      return Boolean(result?.anonymized);
    } catch (err) {
      const detail = (err as { data?: { detail?: unknown } })?.data?.detail;
      throw new Error(
        typeof detail === "string" ? detail : "Nepavyko ištrinti kliento."
      );
    }
  };

  return {
    clients,
    filtered,
    isLoading: isLoading || creating || saving || removing,
    search,
    setSearch,
    clientFields,
    createClient,
    saveClient,
    removeClient,
  };
}
