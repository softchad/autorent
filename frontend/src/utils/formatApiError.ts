import { translateValidationMsg } from "./translateValidationMsg";

// Lauko pavadinimo -> lietuviško lablelio žodynas backend'o 422 validacijos klaidoms (žr. formatApiError žemiau) - TURI apimti VISŲ formų, kurios šią funkciją kviečia (klientai/darbuotojai/automobiliai/užsakymai/rezervacijos/sąskaitos/slaptažodžio keitimas), laukus; trūkstamas laukas vis tiek rodomas (žr. "?? field" žemiau), tik be lietuviško vardo.
const fieldLabels: Record<string, string> = {
  kliento_id: "Klientas",
  automobilio_id: "Automobilis",
  darbuotojo_id: "Darbuotojas",
  nuomos_data: "Nuomos data",
  grazinimo_data: "Grąžinimo data",
  paemimo_vietos_id: "Paėmimo vieta",
  grazinimo_vietos_id: "Grąžinimo vieta",
  bendra_kaina: "Bendra kaina",
  uzsakymo_busena: "Būsena",
  turi_papildomas_paslaugas: "Papildomos paslaugos",
  rezervacijos_pradzia: "Pradžios data",
  rezervacijos_pabaiga: "Pabaigos data",
  busena: "Būsena",
  marke: "Markė",
  modelis: "Modelis",
  metai: "Metai",
  numeris: "Valst. numeris",
  vin_kodas: "VIN kodas",
  spalva: "Spalva",
  kebulo_tipas: "Kėbulo tipas",
  pavaru_deze: "Pavarų dėžė",
  variklio_turis: "Variklio tūris",
  galia_kw: "Galia (kW)",
  kuro_tipas: "Kuro tipas",
  rida: "Rida",
  sedimos_vietos: "Sėdimos vietos",
  klimato_kontrole: "Klimato kontrolė",
  navigacija: "Navigacija",
  kaina_parai: "Kaina parai",
  automobilio_statusas: "Automobilio statusas",
  technikines_galiojimas: "Tech. apžiūros galiojimas",
  dabartine_vieta_id: "Vieta",
  pastabos: "Pastabos",
  vardas: "Vardas",
  pavarde: "Pavardė",
  el_pastas: "El. paštas",
  telefono_nr: "Telefono nr.",
  gimimo_data: "Gimimo data",
  registracijos_data: "Registracijos data",
  pareigos: "Pareigos",
  atlyginimas: "Atlyginimas",
  isidarbinimo_data: "Įsidarbinimo data",
  slaptazodis: "Slaptažodis",
  senas_slaptazodis: "Senas slaptažodis",
  naujas_slaptazodis: "Naujas slaptažodis",
  order_id: "Užsakymas",
  total: "Suma",
  invoice_date: "Sąskaitos data",
};

type ValidationError = { loc?: (string | number)[]; msg: string };

// Grąžina VISAS 422 validacijos klaidas (ne vien pirmą), kad vartotojas pataisytų iškart visus neteisingus laukus, ne atrastų antrą klaidą tik po pirmo pakartotinio bandymo.
export function formatApiError(err: unknown, fallback = "Patikrinkite įvestus duomenis."): string {
  const detail = (err as { data?: { detail?: unknown } })?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: ValidationError) => {
        const field = d.loc?.[d.loc.length - 1];
        const label = fieldLabels[String(field)] ?? field ?? "?";
        return `${label}: ${translateValidationMsg(d.msg)}`;
      })
      .join("\n");
  }
  if (typeof detail === "string") return detail;
  return fallback;
}
