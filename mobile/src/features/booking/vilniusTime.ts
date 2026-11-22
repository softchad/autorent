// Lietuvos laikas (Europe/Vilnius) skaičiuojamas ranka pagal ES taisyklę, kad rezultatas nepriklausytų
// nuo telefono laiko juostos ir nuo to, ar JavaScript variklis turi laiko juostų duomenis.
//   žiemos laikas: UTC+2
//   vasaros laikas: UTC+3, nuo paskutinio kovo sekmadienio 01:00 UTC iki paskutinio spalio sekmadienio 01:00 UTC
import { IsoDate, toIsoDate } from '@/utils/isoDate';

const MS_PER_HOUR = 3_600_000;
const WINTER_OFFSET_HOURS = 2;
const SUMMER_OFFSET_HOURS = 3;

// Paskutinio nurodyto mėnesio sekmadienio 01:00 UTC momentas. monthIndex: 2 = kovas, 9 = spalis.
export function lastSundayOneAmUtc(year: number, monthIndex: number): number {
  const lastDayOfMonth = new Date(Date.UTC(year, monthIndex + 1, 0));
  const daysBackToSunday = lastDayOfMonth.getUTCDay();
  return Date.UTC(year, monthIndex, lastDayOfMonth.getUTCDate() - daysBackToSunday, 1, 0, 0);
}

export function vilniusOffsetHours(utcMs: number): number {
  const year = new Date(utcMs).getUTCFullYear();
  const summerStart = lastSundayOneAmUtc(year, 2);
  const summerEnd = lastSundayOneAmUtc(year, 9);
  return utcMs >= summerStart && utcMs < summerEnd ? SUMMER_OFFSET_HOURS : WINTER_OFFSET_HOURS;
}

// Kokia kalendorinė diena Vilniuje nurodytu momentu.
export function vilniusDateOf(utcMs: number): IsoDate {
  const shifted = new Date(utcMs + vilniusOffsetHours(utcMs) * MS_PER_HOUR);
  return toIsoDate(shifted.getUTCFullYear(), shifted.getUTCMonth() + 1, shifted.getUTCDate());
}

// Vilniaus vietinio laiko (data + valanda) momentas UTC milisekundėmis.
export function vilniusLocalToUtcMs(isoDate: IsoDate, hour: number): number {
  const [year, month, day] = isoDate.split('-').map(Number);
  const asIfUtc = Date.UTC(year, month - 1, day, hour, 0, 0);
  // Pirmas spėjimas – žiemos poslinkis; jei tuo momentu galioja vasaros laikas, perskaičiuojame.
  const winterGuess = asIfUtc - WINTER_OFFSET_HOURS * MS_PER_HOUR;
  return asIfUtc - vilniusOffsetHours(winterGuess) * MS_PER_HOUR;
}

// Kiek valandų liko iki nurodyto Vilniaus laiko (neigiama – jau praėjo).
export function hoursUntilVilnius(isoDate: IsoDate, hour: number, nowMs: number): number {
  return (vilniusLocalToUtcMs(isoDate, hour) - nowMs) / MS_PER_HOUR;
}
