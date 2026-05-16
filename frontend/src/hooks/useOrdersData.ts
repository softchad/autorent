import {
  useGetAllOrdersQuery,
  useDeleteOrderMutation,
  useGetAllClientsQuery,
  useGetAllCarsQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useMeApiV1MeGetQuery,
} from "@/store/carRentalApi";
import { useState, useMemo } from "react";
import { FieldConfig } from "@/app/components/modals/EntityModal";
import type { OrderCreate, OrderOut } from "@/store/carRentalApi";

export function useOrdersData() {
  const { data: me, isLoading: loadingMe } = useMeApiV1MeGetQuery();
  const initialEmployeeId = me?.darbuotojo_id ?? null;
  const {
    data: orders = [],
    isLoading: loadingOrders,
    refetch: refetchOrders,
  } = useGetAllOrdersQuery();

  const { data: clients = [], isLoading: loadingClients } =
    useGetAllClientsQuery();
  const { data: cars = [], isLoading: loadingCars } = useGetAllCarsQuery();

  const getClientName = (id: number) =>
    clients.find((c: any) => c.kliento_id === id)
      ? `${clients.find((c: any) => c.kliento_id === id)!.vardas} ${
          clients.find((c: any) => c.kliento_id === id)!.pavarde
        }`
      : `Klientas #${id}`;

  const getCarName = (id: number) => {
    const car = cars.find((c: any) => c.automobilio_id === id);
    return car ? `${car.marke} ${car.modelis}` : `Automobilis #${id}`;
  };

  const [updateOrder, { isLoading: updating }] = useUpdateOrderMutation();
  const [deleteOrder, { isLoading: deleting }] = useDeleteOrderMutation();
  const [createOrder] = useCreateOrderMutation();

  const saveOrder = async (id: number | null, data: Partial<OrderOut>) => {
    const selectedCar = cars.find(
      (c: any) => Number(c.automobilio_id) === Number(data.automobilio_id)
    );
    const paemimo = selectedCar?.lokacija?.vietos_id;
    const toDate = (v: any) => (v && String(v).includes("-") ? String(v).slice(0, 10) : undefined);
    const processedData = {
      ...data,
      kliento_id: Number(data.kliento_id),
      automobilio_id: Number(data.automobilio_id),
      darbuotojo_id: Number(data.darbuotojo_id),
      grazinimo_vietos_id: Number(data.grazinimo_vietos_id),
      bendra_kaina: Number(data.bendra_kaina),
      nuomos_data: toDate(data.nuomos_data),
      grazinimo_data: toDate(data.grazinimo_data),
      turi_papildomas_paslaugas: data.turi_papildomas_paslaugas === true || (data.turi_papildomas_paslaugas as any) === "true",
      paemimo_vietos_id: paemimo != null ? Number(paemimo) : Number(data.grazinimo_vietos_id),
    };
    if (id === null) {
      await createOrder({ orderCreate: processedData as OrderCreate }).unwrap();
    } else {
      await updateOrder({
        uzsakymoId: id,
        orderUpdate: processedData,
      }).unwrap();
    }
    await refetchOrders();
  };

  const handleDelete = async (id: number) => {
    await deleteOrder({ uzsakymoId: id }).unwrap();
    await refetchOrders();
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("visi");

  const filtered = useMemo(() => {
    return orders.filter((o: any) => {
      const target =
        `${getClientName(o.kliento_id)} ${getCarName(o.automobilio_id)}`.toLowerCase();
      const matchSearch = target.includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "visi" || o.uzsakymo_busena === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, clients, cars, search, statusFilter]);

  const returnOptions = useMemo(() => {
    const unique = new Map<number, string>();
    cars.forEach((c: any) => {
      if (c.lokacija && !unique.has(c.lokacija.vietos_id)) {
        unique.set(c.lokacija.vietos_id, c.lokacija.adresas);
      }
    });
    return Array.from(unique.entries()).map(([id, address]) => ({
      value: id,
      label: address,
    }));
  }, [cars]);

  const orderFields: FieldConfig<OrderOut>[] = [
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
      type: "select", // ← vietoj "autocomplete"
      required: true,
      options: cars.map((c: any) => ({
        value: c.automobilio_id, // ← VALUE = ID (skaičius)
        label: `${c.marke} ${c.modelis}`,
      })),
    },
    {
      name: "darbuotojo_id",
      label: "Darbuotojo ID",
      type: "text",
      required: true,
      readonly: true,
      render: () => `${me?.vardas ?? "-"} ${me?.pavarde ?? "-"}`,
    },
    {
      name: "nuomos_data",
      label: "Nuomos data",
      type: "date",
      required: true,
    },
    {
      name: "grazinimo_data",
      label: "Grąžinimo data",
      type: "date",
      required: true,
    },
    {
      label: "Paėmimo vieta",
      type: "text",
      readonly: true,
      render: (form) => {
        // konvertuojam į number
        const carId = form.automobilio_id ? Number(form.automobilio_id) : null;
        const car = cars.find((c: any) => c.automobilio_id === carId);
        return car?.lokacija?.adresas || "—";
      },
    },
    {
      name: "grazinimo_vietos_id",
      label: "Grąžinimo vieta",
      type: "select",
      required: true,
      options: returnOptions,
    },
    {
      name: "bendra_kaina",
      label: "Bendra kaina (€)",
      type: "number",
      required: true,
    },
    {
      name: "uzsakymo_busena",
      label: "Būsena",
      type: "select",
      required: true,
      options: [
        { value: "laukiama", label: "Laukiama" },
        { value: "vykdoma", label: "Vykdoma" },
        { value: "užbaigta", label: "Užbaigta" },
        { value: "atšaukta", label: "Atšaukta" },
      ],
    },
    {
      name: "turi_papildomas_paslaugas",
      label: "Papildomos paslaugos?",
      type: "select",
      required: true,
      options: [
        { value: true, label: "Taip" },
        { value: false, label: "Ne" },
      ],
    },
  ];

  return {
    filtered,
    isLoading:
      loadingOrders || loadingClients || loadingCars || updating || deleting,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    getClientName,
    getCarName,
    saveOrder,
    handleDelete,
    orderFields,
    refetchOrders,
    cars,
    initialEmployeeId,
  };
}
