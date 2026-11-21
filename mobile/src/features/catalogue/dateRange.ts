import { addDays, IsoDate, isBefore, toIsoDate, weekdayMondayFirst } from '@/utils/isoDate';

// Paieškos laikotarpis: nuo – paėmimo diena, iki – grąžinimo diena.
export type DateRange = { from: IsoDate | null; to: IsoDate | null };
export const EMPTY_RANGE: DateRange = { from: null, to: null };

export type MonthRef = { year: number; month: number };

export function monthOf(isoDate: IsoDate): MonthRef {
  return { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) };
}

export function shiftMonthRef({ year, month }: MonthRef, delta: number): MonthRef {
  const index = year * 12 + (month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function isMonthBefore(first: MonthRef, second: MonthRef): boolean {
  return first.year * 12 + first.month < second.year * 12 + second.month;
}

// Mėnesio dienos savaitėmis (pirmadienis pirmas); null – langelis už mėnesio ribų.
export function monthWeeks({ year, month }: MonthRef): (IsoDate | null)[][] {
  const first = toIsoDate(year, month, 1);
  const next = shiftMonthRef({ year, month }, 1);
  const afterLast = toIsoDate(next.year, next.month, 1);
  const cells: (IsoDate | null)[] = Array.from({ length: weekdayMondayFirst(first) }, () => null);
  for (let day = first; isBefore(day, afterLast); day = addDays(day, 1)) {
    cells.push(day);
  }
  while (cells.length % 7 !== 0) {
    cells.push(null);
  }
  const weeks: (IsoDate | null)[][] = [];
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7));
  }
  return weeks;
}

// Dienos paspaudimas: pirmas nustato pradžią, antras (vėlesnė diena) – pabaigą.
// Paspaudus ankstesnę arba tą pačią dieną, arba kai laikotarpis jau pilnas, pradedama iš naujo.
export function pickDay(range: DateRange, day: IsoDate): DateRange {
  if (range.from && !range.to && isBefore(range.from, day)) {
    return { from: range.from, to: day };
  }
  return { from: day, to: null };
}

export type RangeRole = 'start' | 'end' | 'inside' | 'none';

export function rangeRole(day: IsoDate, range: DateRange): RangeRole {
  if (day === range.from) {
    return 'start';
  }
  if (day === range.to) {
    return 'end';
  }
  if (range.from && range.to && isBefore(range.from, day) && isBefore(day, range.to)) {
    return 'inside';
  }
  return 'none';
}

// Telefono šiandienos data. Čia ji tik neleidžia rinktis praėjusių dienų – tikslią ribą tikrina serveris.
export function deviceToday(now: Date = new Date()): IsoDate {
  return toIsoDate(now.getFullYear(), now.getMonth() + 1, now.getDate());
}
