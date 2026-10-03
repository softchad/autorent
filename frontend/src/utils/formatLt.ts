// "YYYY-MM-DD" -> "DD.MM.YYYY"
export function formatLt(isoDate: string): string {
  const [y, m, d] = isoDate.split("-");
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
