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
  pavarų_deze: "Pavarų dėžė",
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
};

function translateMsg(msg: string): string {
  if (msg.includes("Field required")) return "privalomas laukas";
  if (msg.includes("valid date") || msg.includes("date separator")) return "neteisinga arba tuščia data";
  if (msg.includes("valid integer") || msg.includes("valid number")) return "turi būti skaičius";
  if (msg.includes("greater than") || msg.includes("less than")) return msg;
  if (msg.includes("Negalima") || msg.includes("turi būti") || msg.includes("negali būti"))
    return msg;
  return msg;
}

export function formatApiError(err: any, fallback = "Patikrinkite įvestus duomenis."): string {
  const detail = err?.data?.detail;
  if (Array.isArray(detail)) {
    return detail
      .map((d: any) => {
        const field = d.loc?.[d.loc.length - 1];
        const label = fieldLabels[field] ?? field ?? "?";
        return `${label}: ${translateMsg(d.msg)}`;
      })
      .join("\n");
  }
  if (typeof detail === "string") return detail;
  return fallback;
}
