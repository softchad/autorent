// UI pusės logika: iškart parodo klientui, ar pasirinktas laikotarpis tinkamas.
// Autoritetingas tikrinimas vyksta serveryje (booking_rules.py, availability_service.py) – čia tik patogumas.
import { addDays, diffDays, IsoDate, toIsoDate, weekdayMondayFirst } from '@/utils/isoDate';

export type DayStatus = 'praeitis' | 'laisva' | 'dalinai' | 'uzimta';

// Vienos dienos būsena iš serverio (GET /public/cars/{id}/calendar).
export type CalendarDay = {
  data: IsoDate;
  busena: DayStatus;
  galima_pradeti: boolean;
  galima_baigti: boolean;
};

export type DayMap = Record<IsoDate, CalendarDay>;

export type BookingRules = {
  siandien: IsoDate;
  min_paru: number;
  max_paru: number;
};

export type Selection = { from: IsoDate | null; to: IsoDate | null };
export const EMPTY_SELECTION: Selection = { from: null, to: null };

export type RangeProblem =
  | 'past'
  | 'too_short'
  | 'too_long'
  | 'start_unavailable'
  | 'busy_inside'
  | 'not_loaded';

export type YearMonth = { year: number; month: number };

export function shiftMonth(current: YearMonth, delta: number): YearMonth {
  const index = current.year * 12 + (current.month - 1) + delta;
  return { year: Math.floor(index / 12), month: (index % 12) + 1 };
}

export function yearMonthOf(isoDate: IsoDate): YearMonth {
  return { year: Number(isoDate.slice(0, 4)), month: Number(isoDate.slice(5, 7)) };
}

// Mėnesio tinklelis savaitėmis nuo pirmadienio; null – tuščias langelis prieš 1 d. arba po paskutinės.
export function buildMonthGrid({ year, month }: YearMonth): (IsoDate | null)[][] {
  const first = toIsoDate(year, month, 1);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells: (IsoDate | null)[] = Array(weekdayMondayFirst(first)).fill(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toIsoDate(year, month, day));
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

// Laikotarpis [from, to) tinkamas, kai kiekvienos jo nakties automobilis laisvas.
// Serveris dienai grąžina galima_pradeti = „šios dienos naktis laisva“, todėl pakanka patikrinti kiekvieną dieną nuo from iki to − 1.
export function validateRange(from: IsoDate, to: IsoDate, days: DayMap, rules: BookingRules): RangeProblem | null {
  if (from < rules.siandien) {
    return 'past';
  }
  const length = diffDays(from, to);
  if (length < rules.min_paru) {
    return 'too_short';
  }
  if (length > rules.max_paru) {
    return 'too_long';
  }
  for (let offset = 0; offset < length; offset += 1) {
    const day = days[addDays(from, offset)];
    if (!day) {
      return 'not_loaded';
    }
    if (!day.galima_pradeti) {
      return offset === 0 ? 'start_unavailable' : 'busy_inside';
    }
  }
  return null;
}

export type SelectResult = { selection: Selection; problem: RangeProblem | null };

function startAt(day: IsoDate, days: DayMap, rules: BookingRules, previous: Selection): SelectResult {
  if (day < rules.siandien) {
    return { selection: previous, problem: 'past' };
  }
  if (!days[day]?.galima_pradeti) {
    return { selection: previous, problem: 'start_unavailable' };
  }
  return { selection: { from: day, to: null }, problem: null };
}

// Dienos paspaudimas: pirmas paspaudimas – pradžia, antras (vėlesnė diena) – pabaiga, trečias – pradedama iš naujo.
export function selectDay(selection: Selection, day: IsoDate, days: DayMap, rules: BookingRules): SelectResult {
  const choosingEnd = selection.from !== null && selection.to === null && day > selection.from;
  if (!choosingEnd) {
    return startAt(day, days, rules, selection);
  }
  const from = selection.from as IsoDate;
  const problem = validateRange(from, day, days, rules);
  if (problem) {
    // Netinkama pabaiga pasirinkimo nesugadina – pradžia lieka, klientas gali rinktis kitą dieną.
    return { selection, problem };
  }
  return { selection: { from, to: day }, problem: null };
}

export type DayRole = 'start' | 'end' | 'inside' | 'none';

export function dayRole(day: IsoDate, selection: Selection): DayRole {
  if (selection.from === day) return 'start';
  if (selection.to === day) return 'end';
  if (selection.from && selection.to && day > selection.from && day < selection.to) return 'inside';
  return 'none';
}

// Ar dieną verta leisti spausti: pradžiai – galima_pradeti, pabaigai – bet kuri vėlesnė diena (tikslią priežastį parodys validateRange).
export function isDayPressable(day: CalendarDay | undefined, selection: Selection): boolean {
  if (!day || day.busena === 'praeitis') {
    return false;
  }
  const choosingEnd = selection.from !== null && selection.to === null && day.data > selection.from;
  return choosingEnd ? true : day.galima_pradeti;
}

export function toDayMap(days: CalendarDay[]): DayMap {
  const map: DayMap = {};
  for (const day of days) {
    map[day.data] = day;
  }
  return map;
}
