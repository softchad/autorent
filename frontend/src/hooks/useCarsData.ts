// "useGetAllCarsQuery" imamas iš enhanceEndpoints.ts (TIK jis pažymėtas "Cars" tag'u kuriam/atnaujinant/trinant), o "useGetLocationsQuery" - tiesiai iš autorentApi.ts, nes vietos niekada nekeičiamos iš šios sąsajos.
import { useGetAllCarsQuery } from "@/store/enhanceEndpoints";
import { useGetLocationsQuery } from "@/store/autorentApi";
import { useMemo, useState } from "react";
import { FieldConfig } from "@/app/components/staff/EntityModal";

// Tipas IŠVEDAMAS iš paties hook'o grąžinamos reikšmės, ne importuojamas atskirai - jei sugeneruotas API kontraktas pasikeistų, šis tipas automatiškai atsinaujintų.
type Automobilis = NonNullable<
  ReturnType<typeof useGetAllCarsQuery>["data"]
>[number];

// Automobilių parko duomenys ir CRUD formos konfigūracija - naudoja fleet/page.tsx (pilnas administravimas) IR useReservationData.ts (tik automobilių sąrašas pavadinimams).
export function useCarsData() {
  const { data: locations = [] } = useGetLocationsQuery();

  const locationOptions = locations.map((l) => ({
    value: l.vietos_id,
    label: `${l.pavadinimas} (${l.adresas})`,
  }));

  // Select'ų "options" reikšmės TURI tiksliai atitikti backend VALID_PAVARU_DEZE/VALID_KURO_TIPAS/VALID_STATUSAS (schemas/car.py) - jei backend leidžia naują reikšmę, bet ji nepridėta čia, darbuotojas jos tiesiog negalės pasirinkti formoje.
  const carFields: FieldConfig<Automobilis>[] = [
    { name: "marke", label: "Markė", required: true },
    { name: "modelis", label: "Modelis", required: true },
    { name: "metai", label: "Metai", type: "number", required: true },
    { name: "numeris", label: "Valst. numeris", required: true },
    { name: "vin_kodas", label: "VIN kodas", required: true },
    { name: "spalva", label: "Spalva", required: true },
    { name: "kebulo_tipas", label: "Kėbulo tipas", required: true },
    {
      name: "pavaru_deze",
      label: "Pavarų dėžė",
      type: "select",
      required: true,
      options: [
        { value: "mechaninė", label: "Mechaninė" },
        { value: "automatinė", label: "Automatinė" },
        { value: "pusiau automatinė", label: "Pusiau automatinė" },
      ],
    },
    { name: "variklio_turis", label: "Variklio tūris (l)", type: "number", required: true },
    { name: "galia_kw", label: "Galia (kW)", type: "number", required: true },
    {
      name: "kuro_tipas",
      label: "Kuro tipas",
      type: "select",
      required: true,
      options: [
        { value: "benzinas", label: "Benzinas" },
        { value: "dyzelinas", label: "Dyzelinas" },
        { value: "elektra", label: "Elektra" },
        { value: "hibridas", label: "Hibridas" },
        { value: "dujos", label: "Dujos" },
      ],
    },
    { name: "rida", label: "Rida (km)", type: "number", required: true },
    { name: "sedimos_vietos", label: "Sėdimos vietos", type: "number", required: true },
    {
      name: "klimato_kontrole",
      label: "Klimato kontrolė",
      type: "select",
      required: true,
      options: [
        { value: true, label: "Taip" },
        { value: false, label: "Ne" },
      ],
    },
    {
      name: "navigacija",
      label: "Navigacija",
      type: "select",
      required: true,
      options: [
        { value: true, label: "Taip" },
        { value: false, label: "Ne" },
      ],
    },
    {
      name: "kaina_parai",
      label: "Kaina parai (€)",
      type: "number",
      required: true,
    },
    {
      name: "automobilio_statusas",
      label: "Būsena",
      type: "select",
      options: [
        { value: "laisvas", label: "Laisvas" },
        { value: "isnuomotas", label: "Išnuomotas" },
        { value: "servise", label: "Servise" },
        { value: "remonte", label: "Remonte" },
      ],
      required: true,
    },
    {
      name: "technikines_galiojimas",
      label: "Tech. apžiūros galiojimas",
      type: "date",
      required: true,
    },
    {
      name: "dabartine_vieta_id",
      label: "Dabartinė vieta",
      type: "select",
      required: true,
      options: locationOptions,
    },
    {
      name: "pastabos",
      label: "Pastabos",
      type: "textarea",
    },
  ];

  const {
    data: automobiliai = [],
    isLoading,
    refetch: refetchCars,
  } = useGetAllCarsQuery();

  const [statusFilter, setStatusFilter] = useState("visi");
  const [search, setSearch] = useState("");
  const [selectedCar, setSelectedCar] = useState<Automobilis | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  // Statuso ir teksto paieškos filtrai skaičiuojami kliento pusėje (visas sąrašas jau gautas) - automobilių parkas per mažas, kad reikėtų atskiro backend endpoint'o su query parametrais.
  const filtered = useMemo(
    () =>
      automobiliai.filter((a) => {
        const matchesStatus =
          statusFilter === "visi" || a.automobilio_statusas === statusFilter;
        const matchesSearch = `${a.marke} ${a.modelis} ${a.numeris}`
          .toLowerCase()
          .includes(search.toLowerCase());
        return matchesStatus && matchesSearch;
      }),
    [automobiliai, statusFilter, search]
  );

  return {
    automobiliai,
    isLoading,
    filtered,
    statusFilter,
    setStatusFilter,
    search,
    setSearch,
    selectedCar,
    setSelectedCar,
    isModalOpen,
    setModalOpen,
    carFields,
    refetchCars,
  };
}
