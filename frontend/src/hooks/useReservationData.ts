import {
  useGetAllReservationsQuery,
  useCreateReservationMutation,
  useUpdateReservationMutation,
  useDeleteReservationMutation,
  type ReservationCreate,
  type ReservationUpdate,
  type ReservationOut,
  useGetAllCarsQuery,
  useGetAllClientsQuery,
} from "@/store/autorentApi";

import { useState, useMemo } from "react";
import { FieldConfig } from "@/app/components/staff/EntityModal";

// Rezervacijų sąrašo duomenys ir CRUD forma - naudoja reservations/page.tsx.
export const useReservationData = () => {
  const [createReservation, { isLoading: creating }] = useCreateReservationMutation();
  const [updateReservation, { isLoading: updating }] = useUpdateReservationMutation();
  const [deleteReservation, { isLoading: deleting }] = useDeleteReservationMutation();

  const {
    data: reservations = [],
    isLoading,
    refetch,
  } = useGetAllReservationsQuery();

  // Tiesiai per useGetAllClientsQuery/useGetAllCarsQuery (NE per useClientsData/useCarsData) - šiai formai reikia TIK pačių sąrašų, o tie hook'ai papildomai statytų nenaudojamus CRUD laukus/mutacijas/state.
  const { data: clients = [] } = useGetAllClientsQuery();
  const { data: cars = [] } = useGetAllCarsQuery();

  const clientMap = useMemo(
    () => new Map(clients.map((c) => [c.kliento_id, `${c.vardas} ${c.pavarde}`])),
    [clients]
  );

  const carMap = useMemo(
    () => new Map(cars.map((a) => [a.automobilio_id, `${a.marke} ${a.modelis}`])),
    [cars]
  );

  const getClientName = (id: number) => clientMap.get(id) ?? `#${id}`;
  const getCarName = (id: number) => carMap.get(id) ?? `#${id}`;

  // Kuria NAUJĄ (id === null) arba atnaujina ESAMĄ rezervaciją.
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

  // Trina rezervaciją ir IŠKART atnaujina sąrašą.
  const handleDelete = async (rezervacijos_id: number) => {
    await deleteReservation({ rezervacijosId: rezervacijos_id }).unwrap();
    await refetch();
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<
    "visi" | "patvirtinta" | "laukia" | "atšaukta"
  >("visi");

  // Paieška IR statuso filtras skaičiuojami kliento pusėje - rezervacijų sąrašas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
  const filtered = reservations
    .filter((r) => {
      const target =
        `${getClientName(r.kliento_id)} ${getCarName(r.automobilio_id)}`.toLowerCase();
      const matchSearch = target.includes(search.toLowerCase());
      const busena = (r.busena ?? "").toLowerCase();
      const matchStatus = statusFilter === "visi" || statusFilter === busena;
      return matchSearch && matchStatus;
    })
    // Naujausios viršuje - DB neturi atskiro sukūrimo laiko stulpelio, tad didžiausias "rezervacijos_id" naudojamas kaip pateikimo laiko pakaitalas; kitaip naujai pateikta rezervacija "pasimestų" tarp senų įrašų, kol pats nepaspaudi stulpelio rūšiavimo.
    .sort((a, b) => b.rezervacijos_id - a.rezervacijos_id);

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
    // Reikšmės TIKSLIAI sutampa su backend'o VALID_BUSENA (schemas/reservation.py) - visos 3 PRIVALO būti čia, kitaip ta būsena niekada negalėtų būti pasirinkta per šią formą.
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
