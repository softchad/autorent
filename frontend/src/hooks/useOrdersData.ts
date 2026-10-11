import {
  useGetAllOrdersQuery,
  useDeleteOrderMutation,
  useGetAllClientsQuery,
  useGetAllCarsQuery,
  useGetAllEmployeesQuery,
  useGetLocationsQuery,
  useCreateOrderMutation,
  useUpdateOrderMutation,
  useGetCurrentUserQuery,
} from "@/store/autorentApi";
import { useState, useMemo } from "react";
import { FieldConfig } from "@/app/components/staff/EntityModal";
import type { OrderCreate, OrderOut } from "@/store/autorentApi";

// Užsakymų sąrašo duomenys ir CRUD forma - naudoja orders/page.tsx.
export function useOrdersData() {
  // Užsakymo kūrimo formoje "Darbuotojas" lauko pradinė reikšmė - dabar prisijungęs darbuotojas, ne tuščia (jis dažniausiai ir kuria užsakymą sau).
  const { data: me } = useGetCurrentUserQuery();
  const initialEmployeeId = me?.darbuotojo_id ?? null;
  const {
    data: orders = [],
    isLoading: loadingOrders,
    refetch: refetchOrders,
  } = useGetAllOrdersQuery();

  const { data: clients = [], isLoading: loadingClients } =
    useGetAllClientsQuery();
  const { data: cars = [], isLoading: loadingCars } = useGetAllCarsQuery();
  const { data: employees = [], isLoading: loadingEmployees } =
    useGetAllEmployeesQuery();
  const { data: locations = [] } = useGetLocationsQuery();

  // Rodo vardą/pavardę sąraše vietoj vien ID - "Klientas #id" atsarginis atvejis realiai nebūtų pasiekiamas (kliento_id visada rodo į esamą klientą), bet apsaugo nuo baltos ekrano, jei sąrašai nespėjo užkrauti vienu metu.
  const getClientName = (id: number) => {
    const client = clients.find((c) => c.kliento_id === id);
    return client ? `${client.vardas} ${client.pavarde}` : `Klientas #${id}`;
  };

  // Tas pats principas kaip getClientName aukščiau, tik automobiliams.
  const getCarName = (id: number) => {
    const car = cars.find((c) => c.automobilio_id === id);
    return car ? `${car.marke} ${car.modelis}` : `Automobilis #${id}`;
  };

  const [updateOrder, { isLoading: updating }] = useUpdateOrderMutation();
  const [deleteOrder, { isLoading: deleting }] = useDeleteOrderMutation();
  const [createOrder] = useCreateOrderMutation();

  // Kuria NAUJĄ (id === null) arba atnaujina ESAMĄ užsakymą - backend'as (OrderUpdate) tyliai IGNORUOJA laukus, kurių jis nepriima redaguojant (žr. orderEditFields žemiau), tad VISADA siunčiame pilną "processedData", nesirūpindami, kuris kelias tai yra.
  const saveOrder = async (id: number | null, data: Partial<OrderOut>) => {
    const selectedCar = cars.find(
      (c) => Number(c.automobilio_id) === Number(data.automobilio_id)
    );
    const paemimo = selectedCar?.lokacija?.vietos_id;
    const toDate = (v: unknown) => (v && String(v).includes("-") ? String(v).slice(0, 10) : undefined);
    const processedData = {
      ...data,
      kliento_id: Number(data.kliento_id),
      automobilio_id: Number(data.automobilio_id),
      darbuotojo_id: Number(data.darbuotojo_id),
      grazinimo_vietos_id: Number(data.grazinimo_vietos_id),
      bendra_kaina: Number(data.bendra_kaina),
      nuomos_data: toDate(data.nuomos_data),
      grazinimo_data: toDate(data.grazinimo_data),
      turi_papildomas_paslaugas: data.turi_papildomas_paslaugas === true || String(data.turi_papildomas_paslaugas) === "true",
      // "paemimo_vietos_id" NĖRA tikras formos laukas (žr. "Paėmimo vieta" render'ą orderFields žemiau) - jis visada automobilio DABARTINĖ vieta; jei ji dėl kokios nors priežasties nerandama, PALIEKAME lauką neužpildytą (ne grazinimo_vietos_id, kuris yra VISIŠKAI KITA vieta), kad backend'o "Field required" patikra tai pagautų, o ne tyliai įrašytų neteisingą vietą.
      paemimo_vietos_id: paemimo != null ? Number(paemimo) : undefined,
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

  // Trina užsakymą ir IŠKART atnaujina sąrašą.
  const handleDelete = async (id: number) => {
    await deleteOrder({ uzsakymoId: id }).unwrap();
    await refetchOrders();
  };

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("visi");

  // Paieška IR statuso filtras skaičiuojami kliento pusėje - užsakymų sąrašas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
  const filtered = useMemo(() => {
    return orders.filter((o) => {
      const target =
        `${getClientName(o.kliento_id)} ${getCarName(o.automobilio_id)}`.toLowerCase();
      const matchSearch = target.includes(search.toLowerCase());
      const matchStatus =
        statusFilter === "visi" || o.uzsakymo_busena === statusFilter;
      return matchSearch && matchStatus;
    });
  }, [orders, clients, cars, search, statusFilter]);

  // VISŲ realių vietų sąrašas (useGetLocationsQuery), NE išvestas iš "cars" - jei kažkuri vieta šiuo metu neturi NĖ VIENO jai priskirto automobilio, ji vis tiek turi likti pasirenkama kaip grąžinimo vieta.
  const returnOptions = useMemo(
    () => locations.map((l) => ({ value: l.vietos_id, label: l.adresas })),
    [locations]
  );

  const orderFields: FieldConfig<OrderOut>[] = [
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
    // "select", NE "autocomplete" - EntityModal.handleChange autocomplete'ui atpažįsta pasirinkimą PAGAL LABEL tekstą, kas būtų nevienareikšmiška, jei du automobiliai turėtų tą pačią markę/modelį; "select" <option value> visada yra TIKRAS "automobilio_id" skaičius, be jokios dviprasmybės.
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
      name: "darbuotojo_id",
      label: "Darbuotojas",
      type: "select",
      required: true,
      options: employees.map((e) => ({
        value: e.darbuotojo_id,
        label: `${e.vardas} ${e.pavarde}`,
      })),
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
    // Ne redaguojamas laukas, vien parodo pasirinkto automobilio DABARTINĘ vietą - paėmimo vieta visada = automobilio vieta, tad atskiro "paemimo_vietos_id" pasirinkimo formoje nėra (žr. saveOrder aukščiau).
    {
      label: "Paėmimo vieta",
      type: "text",
      readonly: true,
      render: (form) => {
        // "form.automobilio_id" iš <select> ateina kaip string, o car.automobilio_id - skaičius, tad be Number() jie niekad nesutaptų.
        const carId = form.automobilio_id ? Number(form.automobilio_id) : null;
        const car = cars.find((c) => c.automobilio_id === carId);
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
      // Reikšmės TIKSLIAI sutampa su backend'o VALID_BUSENA (schemas/order.py) - visos 5 PRIVALO būti čia, kitaip ta būsena niekada negalėtų būti pasirinkta per šią formą.
      name: "uzsakymo_busena",
      label: "Būsena",
      type: "select",
      required: true,
      options: [
        { value: "laukiama", label: "Laukiama" },
        { value: "patvirtinta", label: "Patvirtinta" },
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

  // Redaguojant ESAMĄ užsakymą, backend (OrderUpdate schemas/order.py + update_order) TIKRAI pritaiko TIK šiuos 3 laukus (busena/grąžinimo data/papildomos paslaugos) - klientas/automobilis/darbuotojas/pradžios data/grąžinimo vieta/kaina SĄMONINGAI nekeičiami po sukūrimo, nes jie identifikuoja PATĮ užsakymą kaip sandorį (ir gali būti jau susieti su išrašyta sąskaita - žr. invoices/page.tsx); šių laukų pakeitimui skirtas NAUJO užsakymo sukūrimas, ne seno redagavimas. "readonly: true" šiuos laukus PALIEKA matomus peržiūros režime, bet neleidžia jų redaguoti.
  const FROZEN_AFTER_CREATE = new Set([
    "kliento_id",
    "automobilio_id",
    "darbuotojo_id",
    "nuomos_data",
    "grazinimo_vietos_id",
    "bendra_kaina",
  ]);
  const orderEditFields: FieldConfig<OrderOut>[] = orderFields.map((f) =>
    f.name && FROZEN_AFTER_CREATE.has(f.name as string) ? { ...f, readonly: true } : f
  );

  // "nuolaidos_kodas" egzistuoja TIK OrderCreate schemoje (žr. backend schemas/order.py) - NIEKADA OrderOut, tad šis laukas tyčia NEgali patekti į orderFields/orderEditFields aukščiau (kitaip jis "pasirodytų" ir redaguojant ESAMĄ užsakymą, kur backend'as jį tyliai ignoruotų - klaidinga UI, žr. onCreate/saveOrder žemiau).
  type OrderCreateFields = OrderOut & { nuolaidos_kodas?: string };
  const createOrderFields: FieldConfig<OrderCreateFields>[] = [
    ...(orderFields as FieldConfig<OrderCreateFields>[]),
    { name: "nuolaidos_kodas", label: "Nuolaidos kodas (nebūtina)", type: "text" },
  ];

  return {
    filtered,
    isLoading:
      loadingOrders ||
      loadingClients ||
      loadingCars ||
      loadingEmployees ||
      updating ||
      deleting,
    search,
    setSearch,
    statusFilter,
    setStatusFilter,
    getClientName,
    getCarName,
    saveOrder,
    handleDelete,
    orderFields,
    orderEditFields,
    createOrderFields,
    refetchOrders,
    cars,
    initialEmployeeId,
  };
}
