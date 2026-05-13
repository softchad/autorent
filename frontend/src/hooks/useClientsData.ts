import { useState, useMemo } from "react";
import {
  ClientOut,
  ClientUpdate,
  useGetAllClientsQuery,
  useCreateClientMutation,
  useUpdateClientMutation,
  useDeleteClientMutation,
} from "@/store/carRentalApi";
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
    { name: "registracijos_data", label: "Registracijos data", type: "date", required: true },
    { name: "bonus_taskai", label: "Bonus taškai", type: "number", required: true },
  ];

  function randomizeClient(): Partial<ClientOut> {
    const vardai = ["Jonas", "Petras", "Tomas", "Lukas", "Mantas", "Dovydas", "Laurynas", "Rokas",
                    "Laura", "Eglė", "Rūta", "Ingrida", "Viktorija", "Monika", "Simona", "Greta"];
    const pavardes = ["Kazlauskas", "Petraitis", "Jonaitis", "Stankevičius", "Butkus",
                      "Paulauskas", "Jankauskas", "Girdzijauskas", "Černiauskas", "Mickus"];
    const domainai = ["gmail.com", "yahoo.com", "outlook.com", "inbox.lt", "one.lt"];
    const pick = <T,>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const vardas = pick(vardai);
    const pavarde = pick(pavardes);
    const el_pastas = `${vardas.toLowerCase()}.${pavarde.toLowerCase()}${randInt(1, 99)}@${pick(domainai)}`;

    const phonePrefix = pick(["+37060", "+37061", "+37062", "+37065", "+37069"]);
    const telefono_nr = `${phonePrefix}${randInt(100000, 999999)}`;

    const now = new Date();
    const birthYear = now.getFullYear() - randInt(18, 65);
    const gimimo_data = `${birthYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;
    const regYear = now.getFullYear() - randInt(0, 3);
    const registracijos_data = `${regYear}-${String(randInt(1, 12)).padStart(2, "0")}-${String(randInt(1, 28)).padStart(2, "0")}`;

    return {
      vardas,
      pavarde,
      el_pastas,
      telefono_nr,
      gimimo_data: gimimo_data as any,
      registracijos_data: registracijos_data as any,
      bonus_taskai: randInt(0, 500),
    };
  }

  const createClient = async (data: Partial<ClientOut>) => {
    await createClientMutation({ clientCreate: data as ClientUpdate }).unwrap();
    await refetch();
  };

  const saveClient = async (id: number, data: Partial<ClientOut>) => {
    await updateClient({ klientoId: id, clientUpdate: data as ClientUpdate }).unwrap();
    await refetch();
  };

  const removeClient = async (id: number) => {
    await deleteClient({ klientoId: id }).unwrap();
    await refetch();
  };

  return {
    clients,
    filtered,
    isLoading: isLoading || creating || saving || removing,
    search,
    setSearch,
    clientFields,
    randomizeClient,
    createClient,
    saveClient,
    removeClient,
  };
}
