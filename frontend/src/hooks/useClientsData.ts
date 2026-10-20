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
import { FieldConfig } from "@/app/components/staff/EntityModal";
import { formatApiError } from "@/utils/formatApiError";

// Klientų sąrašo duomenys ir keitimo forma naudoja bendrą užklausų talpyklą; po sėkmės sąrašas atnaujinamas, kad iškart matytųsi išsaugotas įrašas.
export function useClientsData() {
  const { data: clients = [], isLoading, refetch } = useGetAllClientsQuery();
  const [createClientMutation] = useCreateClientMutation();
  const [updateClient] = useUpdateClientMutation();
  const [deleteClient] = useDeleteClientMutation();
  const [search, setSearch] = useState("");

  // Paieška skaičiuojama kliento pusėje - klientų sąrašas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
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
      // Readonly - tai serverio PATS užpildomas sukūrimo momentas (žr. backend Client.registracijos_data default), ne laukas, kurį darbuotojas turėtų keisti per šią bendrą redagavimo formą.
      readonly: true,
      render: (c) =>
        c.registracijos_data ? new Date(String(c.registracijos_data)).toLocaleDateString("lt-LT") : "—",
    },
  ];

  // Po sukūrimo IŠKART "refetch" - "clients" sąrašas neturi cache tag'o, tad RTK Query savaime neatnaujintų jo be šio kvietimo.
  const createClient = async (data: Partial<ClientOut>) => {
    await createClientMutation({ clientCreate: data as ClientCreate }).unwrap();
    await refetch();
  };

  // Lygiai tas pats "refetch" poreikis kaip createClient aukščiau.
  const saveClient = async (id: number, data: Partial<ClientOut>) => {
    await updateClient({ klientoId: id, clientUpdate: data as ClientUpdate }).unwrap();
    await refetch();
  };

  // Grąžina true, jei klientas buvo ANONIMIZUOTAS (ne pilnai ištrintas) - tai įvyksta, kai jis susietas su užsakymu/rezervacija ir backend'as pats automatiškai pasirinko šį kelią, o ne klaidą; čia tik informuojame darbuotoją.
  const removeClient = async (id: number): Promise<boolean> => {
    try {
      const result = (await deleteClient({ klientoId: id }).unwrap()) as { anonymized?: boolean };
      await refetch();
      return Boolean(result?.anonymized);
    } catch (err) {
      throw new Error(formatApiError(err, "Nepavyko ištrinti kliento."));
    }
  };

  return {
    clients,
    filtered,
    isLoading,
    search,
    setSearch,
    clientFields,
    createClient,
    saveClient,
    removeClient,
  };
}
