import {
  useGetAllReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  type ReservationCreate,
  type ReservationUpdate,
  type ReservationOut,
  useGetAllCarsQuery,
} from "@/store/autorentApi";

import { useClientsData } from "./useClientsData";
import { useCarsData } from "./useCarsData";
import { useState, useMemo } from "react";
import { FieldConfig } from "@/app/components/staff/EntityModal";

export const useReservationData = () => {
  const [createReservation, { isLoading: creating }] = useCreateReservationMutation();
  const [updateReservation, { isLoading: updating }] = useUpdateReservationMutation();
  const [deleteReservation, { isLoading: deleting }] = useDeleteReservationMutation();

  const {
    data: reservations = [],
    isLoading,
    refetch,
  } = useGetAllReservationsQuery();

  const { clients } = useClientsData();
  const { automobiliai } = useCarsData();

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.kliento_id, `${c.vardas} ${c.pavarde}`])),
    [clients]
  );

  const carMap = useMemo(
    () => new Map(automobiliai.map((a) => [a.automobilio_id, `${a.marke} ${a.modelis}`])),
    [automobiliai]
  );

  const getClientName = (id: number) => clientMap.get(id) ?? `#${id}`;
  const getCarName = (id: number) => carMap.get(id) ?? `#${id}`;

  const saveReservation = async (
    id: number | null,
    data: ReservationCreate | ReservationUpdate
  ) => {
    if (id === null) {
      await createReservation({ reservationCreate: data as ReservationCreate }).unwrap();
    } else {
      await updateReservation({ rezervacijosId: id, reservationUpdate: data }).unwrap();
    }
    await refetch();
  };

  const handleDelete = async (rezervacijos_id: number) => {
    await deleteReservation({ rezervacijosId: rezervacijos_id }).unwrap();
    await refetch();
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "visi" | "patvirtinta" | "laukia" | "atšaukta"
  >("visi");

  const filtered = reservations
    .filter((r) => {
      const target =
        `${getClientName(r.kliento_id)} ${getCarName(r.automobilio_id)}`.toLowerCase();
      const matchSearch = target.includes(search.toLowerCase());
      const busena = (r.busena ?? "").toLowerCase();
      const matchStatus = statusFilter === "visi" || statusFilter === busena;
      return matchSearch && matchStatus;
    })
    // Naujausios (didžiausias ID = vėliausiai pateikta, nėra atskiro sukurimo
    // laiko stulpelio DB) viršuje - kitaip naujai pateikta rezervacija "pasimeta"
    // tarp senų įrašų, kol nepaspaudi stulpelio rūšiavimo pačiam.
    .sort((a, b) => b.rezervacijos_id - a.rezervacijos_id);

  const { data: cars = [] } = useGetAllCarsQuery();

  const reservationFields: FieldConfig<ReservationOut>[] = [
    {
      name: "kliento_id",
      label: "Klientas",
      type: "select",
      required: true,
      options: clients.map((c) => ({
        value: c.kliento_id,
        label: `${c.vardas} ${c.pavarde}`,
      })),
    },
    {
      name: "automobilio_id",
      label: "Automobilis",
      type: "select",
      required: true,
      options: cars.map((c) => ({
        value: c.automobilio_id,
        label: `${c.marke} ${c.modelis}`,
      })),
    },
    {
      name: "rezervacijos_pradzia",
      label: "Pradžia",
      type: "date",
      required: true,
    },
    {
      name: "rezervacijos_pabaiga",
      label: "Pabaiga",
      type: "date",
      required: true,
    },
    {
      name: "busena",
      label: "Būsena",
      type: "select",
      options: [
        { value: "patvirtinta", label: "Patvirtinta" },
        { value: "laukia", label: "Laukiama" },
        { value: "atšaukta", label: "Atšaukta" },
      ],
      required: true,
    },
  ];

  return {
    reservations,
    filtered,
    isLoading: isLoading || creating || updating || deleting,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    getClientName,
    getCarName,
    cars,
    saveReservation,
    handleDelete,
    reservationFields,
  };
};
