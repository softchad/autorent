// "YYYY-MM-DD" -> "DD.MM.YYYY" - "slice(0, 10)" nukerpa galimą laiko dalį ("YYYY-MM-DDTHH:mm:ss"), kad funkcija saugiai veiktų ir su pilnu datetime string'u, ne vien tyra data.
export function formatLt(isoDate: string): string {
  const [y, m, d] = isoDate.slice(0, 10).split("-");
  return `${d}.${m}.${y}`;
}

// Lokali data kaip "YYYY-MM-DD" (NE toISOString, kuri pakeistų datą pagal UTC
// laiko zoną prie vidurnakčio).
export function localISO(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

// Numatytasis "nuo šiandien, rytoj iki" datų intervalas - naudojamas visur, kur
// datos laukas niekada neturi likti tuščias/neaiškus (paieškos juosta, rezervacijos
// kūrimas automobilio puslapyje).
export function defaultDateRange(): { dateFrom: string; dateTo: string } {
  const today = new Date();
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);
  return { dateFrom: localISO(today), dateTo: localISO(tomorrow) };
}

// "YYYY-MM-DD" + 1 diena - "T00:00:00" priverčia LOKALŲ (ne UTC) datos skaitymą, kad data niekada "nepaslystų" į ankstesnę/kitą dieną priklausomai nuo vartotojo laiko juostos; naudojama, kai "nuo" data paslenkama į priekį ir "iki" reikia automatiškai pastumti bent viena diena vėliau.
export function nextDay(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + 1);
  return localISO(d);
}
