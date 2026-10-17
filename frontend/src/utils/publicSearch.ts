import { SearchValue } from "@/app/components/public/SearchForm";

// Vienoda paieškos URL kūrimo logika visiems viešiems puslapiams (pradinis, katalogas, automobilio detalės, kitos viešos svetainės puslapiai), kad paspaudus "Ieškoti" bet kuriame iš jų rezultatas būtų tas pats, o pasirinkta vieta/datos liktų adreso eilutėje ir po Atgal/Refresh.
export function buildAutomobiliaiHref(search: SearchValue): string {
  const params = new URLSearchParams();
  if (search.location) params.set("location", search.location);
  if (search.dateFrom) params.set("dateFrom", search.dateFrom);
  if (search.dateTo) params.set("dateTo", search.dateTo);
  const query = params.toString();
  return `/automobiliai${query ? `?${query}` : ""}`;
}
