import {
  useGetAllReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  ReservationCreate,
  ReservationUpdate,
  useGetAllCarsQuery,
} from "@/store/carRentalApi";

import { useClientsData } from "./useClientsData";
import { useCarsData } from "./useCarsData";
import { useState, useMemo } from "react";
import { FieldConfig } from "@/app/components/modals/EntityModal";

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
    () => new Map(clients.map((c: any) => [c.kliento_id, `${c.vardas} ${c.pavarde}`])),
    [clients]
  );

  const carMap = useMemo(
    () => new Map(automobiliai.map((a: any) => [a.automobilio_id, `${a.marke} ${a.modelis}`])),
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
    "visi" | "patvirtinta" | "laukiama" | "atšaukta"
  >("visi");

  const filtered = reservations.filter((r: any) => {
    const target =
      `${getClientName(r.kliento_id)} ${getCarName(r.automobilio_id)}`.toLowerCase();
    const matchSearch = target.includes(search.toLowerCase());
    const busena = (r.busena ?? "").toLowerCase();
    const matchStatus = statusFilter === "visi" || statusFilter === busena;
    return matchSearch && matchStatus;
  });

  const { data: cars = [], isLoading: loadingCars } = useGetAllCarsQuery();

  const reservationFields: FieldConfig<any>[] = [
    {
      name: "kliento_id",
      label: "Klientas",
      type: "select",
      required: true,
      options: clients.map((c: any) => ({
        value: c.kliento_id,
        label: `${c.vardas} ${c.pavarde}`,
      })),
    },
    {
      name: "automobilio_id",
      label: "Automobilis",
      type: "select",
      required: true,
      options: cars.map((c: any) => ({
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
    saveReservation,
    handleDelete,
    reservationFields,
  };
};
