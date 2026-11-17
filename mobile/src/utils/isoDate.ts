// Kalendorinės datos be laiko ir be laiko juostos: 'YYYY-MM-DD'.
// Skaičiuojama per UTC, todėl vasaros/žiemos laiko keitimas dienų skaičiaus neiškreipia.
// Netinkama įvestis ar rezultatas už palaikomų ribų meta klaidą, o ne grąžina neteisingą datą.

const MS_PER_DAY = 86_400_000;

// Palaikomi metai: keturženkliai be priekinių nulių. Date.UTC metus 0–99 paverstų 1900–1999,
// todėl ši sritis tyčia nepalaikoma. Programėlės datos (gimimo, nuomos) telpa su didele atsarga.
// format.ts priima platesnį 0000–9999 intervalą, todėl kiekvieną čia tinkamą datą galima formatuoti.
export const MIN_SUPPORTED_YEAR = 1000;
export const MAX_SUPPORTED_YEAR = 9999;

export type IsoDate = string;

// Tikrina formatą, palaikomus metus ir ar tokia data egzistuoja (2026-02-30 – neegzistuoja).
export function isValidIsoDate(value: string): boolean {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) {
    return false;
  }
  const [year, month, day] = [Number(match[1]), Number(match[2]), Number(match[3])];
  if (year < MIN_SUPPORTED_YEAR || year > MAX_SUPPORTED_YEAR) {
    return false;
  }
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

function parseParts(isoDate: IsoDate): [year: number, month: number, day: number] {
  if (!isValidIsoDate(isoDate)) {
    throw new Error(`Netinkama data: ${isoDate}`);
  }
  const [year, month, day] = isoDate.split('-').map(Number);
  return [year, month, day];
}

function toUtcMs(isoDate: IsoDate): number {
  const [year, month, day] = parseParts(isoDate);
  return Date.UTC(year, month - 1, day);
}

function fromUtcMs(ms: number): IsoDate {
  const date = new Date(ms);
  const year = date.getUTCFullYear();
  // NaN palyginimai visada false, todėl netinkama Date taip pat atmetama.
  if (!(year >= MIN_SUPPORTED_YEAR && year <= MAX_SUPPORTED_YEAR)) {
    throw new RangeError(`Data už palaikomų ribų (${MIN_SUPPORTED_YEAR}–${MAX_SUPPORTED_YEAR} m.)`);
  }
  return `${year}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
}

// Sudaro datą iš dalių; neegzistuojančią datą ar metus už ribų atmeta klaida.
export function toIsoDate(year: number, month: number, day: number): IsoDate {
  const result = `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
  if (!isValidIsoDate(result)) {
    throw new Error(`Netinkama data: ${result}`);
  }
  return result;
}

// Dienų skaičius turi būti sveikasis; trupmena ar NaN nėra kalendorinis poslinkis.
export function addDays(isoDate: IsoDate, days: number): IsoDate {
  if (!Number.isSafeInteger(days)) {
    throw new Error(`Netinkamas dienų skaičius: ${days}`);
  }
  return fromUtcMs(toUtcMs(isoDate) + days * MS_PER_DAY);
}

// Kiek parų nuo 'from' iki 'to' (to − from).
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtcMs(to) - toUtcMs(from)) / MS_PER_DAY);
}

export function isBefore(first: IsoDate, second: IsoDate): boolean {
  return toUtcMs(first) < toUtcMs(second);
}

// Pilnų metų skaičius tarp gimimo datos ir nurodytos dienos; neigiamas, jei onDate ankstesnė.
// Vasario 29 d. gimusiam metai nekeliamaisiais metais sueina kovo 1 d. (kaip ir backend).
export function fullYearsBetween(birthDate: IsoDate, onDate: IsoDate): number {
  const [birthYear, birthMonth, birthDay] = parseParts(birthDate);
  const [year, month, day] = parseParts(onDate);
  const birthdayPassed = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (birthdayPassed ? 0 : 1);
}

// Savaitės diena: 0 = pirmadienis … 6 = sekmadienis (lietuviška savaitė).
export function weekdayMondayFirst(isoDate: IsoDate): number {
  const sundayFirst = new Date(toUtcMs(isoDate)).getUTCDay();
  return (sundayFirst + 6) % 7;
}
