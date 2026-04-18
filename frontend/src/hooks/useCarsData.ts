import { useUpdateCarMutation } from "@/store/carRentalApi";
import { useGetAllCarsQuery } from "@/store/enhanceEndpoints";
import { useState } from "react";
import EntityModal, { FieldConfig } from "@/app/components/modals/EntityModal";

type Automobilis = NonNullable<
  ReturnType<typeof useGetAllCarsQuery>["data"]
>[number];

export function useCarsData() {
  const carFields: FieldConfig<Automobilis>[] = [
    { name: "marke", label: "Markė", required: true },
    { name: "modelis", label: "Modelis", required: true },
    { name: "metai", label: "Metai", type: "number", required: true },
    { name: "numeris", label: "Valst. numeris", required: true },
    { name: "vin_kodas", label: "VIN kodas", required: true },
    { name: "spalva", label: "Spalva", required: true },
    { name: "kebulo_tipas", label: "Kėbulo tipas", required: true },
    {
      name: "pavarų_deze",
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
      label: "Vietos ID",
      type: "number",
      required: true,
    },
    {
      name: "pastabos",
      label: "Pastabos",
      type: "textarea",
    },
  ];

  function randomizeCar(): Partial<Automobilis> {
    const markes = ["Toyota", "BMW", "Mercedes", "Audi", "Volkswagen", "Volvo", "Ford", "Honda", "Škoda", "Hyundai"];
    const modeliai: Record<string, string[]> = {
      Toyota: ["Corolla", "Camry", "RAV4", "Yaris"],
      BMW: ["3 Series", "5 Series", "X3", "X5"],
      Mercedes: ["C-Class", "E-Class", "GLC", "A-Class"],
      Audi: ["A3", "A4", "A6", "Q5"],
      Volkswagen: ["Golf", "Passat", "Tiguan", "Polo"],
      Volvo: ["XC60", "XC90", "V60", "S60"],
      Ford: ["Focus", "Mondeo", "Kuga", "Fiesta"],
      Honda: ["Civic", "Accord", "CR-V", "Jazz"],
      Škoda: ["Octavia", "Superb", "Karoq", "Fabia"],
      Hyundai: ["i30", "Tucson", "Santa Fe", "i20"],
    };
    const spalvos = ["Balta", "Juoda", "Pilka", "Sidabrinė", "Mėlyna", "Raudona", "Žalia"];
    const kebuloTipai = ["Sedanas", "Hečbekas", "Universalas", "Visureigis", "Kupė", "Kabrioletas"];
    const pavarūDežės = ["mechaninė", "automatinė", "pusiau automatinė"] as const;
    const kuroTipai = ["benzinas", "dyzelinas", "elektra", "hibridas", "dujos"] as const;

    const pick = <T,>(arr: readonly T[]): T => arr[Math.floor(Math.random() * arr.length)];
    const randInt = (min: number, max: number) => Math.floor(Math.random() * (max - min + 1)) + min;

    const marke = pick(markes);
    const modelis = pick(modeliai[marke] ?? ["Model"]);
    const metai = randInt(2010, 2024);

    const letters = "ABCDEFGHJKLMNPRSTUVWXYZ";
    const numeris =
      pick(letters) + pick(letters) + pick(letters) +
      " " + randInt(100, 999);

    const vinChars = "ABCDEFGHJKLMNPRSTUVWXYZ0123456789";
    const vin_kodas = Array.from({ length: 17 }, () => vinChars[Math.floor(Math.random() * vinChars.length)]).join("");

    const futureDate = new Date();
    futureDate.setFullYear(futureDate.getFullYear() + randInt(1, 3));
    futureDate.setMonth(randInt(0, 11));
    const technikines_galiojimas = futureDate.toISOString().slice(0, 10);

    return {
      marke,
      modelis,
      metai,
      numeris,
      vin_kodas,
      spalva: pick(spalvos),
      kebulo_tipas: pick(kebuloTipai),
      pavarų_deze: pick(pavarūDežės),
      variklio_turis: parseFloat((randInt(10, 35) / 10).toFixed(1)),
      galia_kw: randInt(60, 220),
      kuro_tipas: pick(kuroTipai),
      rida: randInt(0, 200000),
      sedimos_vietos: pick([5, 5, 5, 7, 2, 4] as const),
      klimato_kontrole: Math.random() > 0.3,
      navigacija: Math.random() > 0.5,
      kaina_parai: randInt(30, 180),
      automobilio_statusas: "laisvas" as any,
      technikines_galiojimas: technikines_galiojimas as any,
      dabartine_vieta_id: randInt(1, 3) as any,
    };
  }

  const {
    data: automobiliai = [],
    isLoading,
    refetch: refetchCars,
  } = useGetAllCarsQuery();

  const [statusFilter, setStatusFilter] = useState("visi");
  const [search, setSearch] = useState("");
  const [selectedCar, setSelectedCar] = useState<Automobilis | null>(null);
  const [isModalOpen, setModalOpen] = useState(false);

  const filtered = automobiliai.filter((a) => {
    const matchesStatus =
      statusFilter === "visi" || a.automobilio_statusas === statusFilter;
    const matchesSearch = `${a.marke} ${a.modelis} ${a.numeris}`
      .toLowerCase()
      .includes(search.toLowerCase());
    return matchesStatus && matchesSearch;
  });

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
    randomizeCar,
  };
}
