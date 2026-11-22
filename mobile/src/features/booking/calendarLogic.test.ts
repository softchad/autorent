import { addDays } from '@/utils/isoDate';
import {
  buildMonthGrid,
  CalendarDay,
  dayRole,
  DayMap,
  EMPTY_SELECTION,
  isDayPressable,
  selectDay,
  shiftMonth,
  validateRange,
  yearMonthOf,
} from './calendarLogic';

const RULES = { siandien: '2026-11-26', min_paru: 1, max_paru: 30 };

// Sukuria dienų žemėlapį nuo 2026-11-20 iki 2027-01-20 taip, kaip jį sudarytų serveris užimtiems intervalams [pradžia, pabaiga).
function makeDays(busyRanges: [string, string][]): DayMap {
  const nights = new Set<string>();
  for (const [start, end] of busyRanges) {
    for (let day = start; day < end; day = addDays(day, 1)) nights.add(day);
  }
  const map: DayMap = {};
  for (let day = '2026-11-20'; day <= '2027-01-20'; day = addDays(day, 1)) {
    const night = nights.has(day);
    const previousNight = nights.has(addDays(day, -1));
    const past = day < RULES.siandien;
    const busena: CalendarDay['busena'] = past ? 'praeitis' : night && previousNight ? 'uzimta' : night || previousNight ? 'dalinai' : 'laisva';
    map[day] = { data: day, busena, galima_pradeti: !past && !night, galima_baigti: day > RULES.siandien && !previousNight };
  }
  return map;
}

const BOOKED = makeDays([['2026-12-01', '2026-12-05']]);
const FREE = makeDays([]);

describe('buildMonthGrid', () => {
  it('2026 m. gruodis prasideda antradienį ir turi 5 savaites', () => {
    const grid = buildMonthGrid({ year: 2026, month: 12 });
    expect(grid).toHaveLength(5);
    expect(grid[0]).toEqual([null, '2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04', '2026-12-05', '2026-12-06']);
    expect(grid[4].filter(Boolean).pop()).toBe('2026-12-31');
  });

  it('kiekviena savaitė turi 7 langelius', () => {
    for (let month = 1; month <= 12; month += 1) {
      expect(buildMonthGrid({ year: 2027, month }).every((week) => week.length === 7)).toBe(true);
    }
  });

  it('keliamųjų metų vasaris turi 29 dienas', () => {
    expect(buildMonthGrid({ year: 2028, month: 2 }).flat().filter(Boolean)).toHaveLength(29);
  });
});

describe('shiftMonth / yearMonthOf', () => {
  it('pereina per metų ribą į abi puses', () => {
    expect(shiftMonth({ year: 2026, month: 12 }, 1)).toEqual({ year: 2027, month: 1 });
    expect(shiftMonth({ year: 2027, month: 1 }, -1)).toEqual({ year: 2026, month: 12 });
    expect(shiftMonth({ year: 2026, month: 11 }, 14)).toEqual({ year: 2028, month: 1 });
  });

  it('yearMonthOf išskaido datą', () => {
    expect(yearMonthOf('2026-11-26')).toEqual({ year: 2026, month: 11 });
  });
});

describe('validateRange', () => {
  it('laisvas laikotarpis tinkamas', () => {
    expect(validateRange('2026-12-10', '2026-12-14', FREE, RULES)).toBeNull();
  });

  it('pradžia praeityje', () => {
    expect(validateRange('2026-11-25', '2026-11-28', FREE, RULES)).toBe('past');
  });

  it('šiandien pradėti galima', () => {
    expect(validateRange('2026-11-26', '2026-11-27', FREE, RULES)).toBeNull();
  });

  it('per trumpas ir per ilgas laikotarpis', () => {
    expect(validateRange('2026-12-10', '2026-12-10', FREE, RULES)).toBe('too_short');
    expect(validateRange('2026-12-01', '2027-01-01', FREE, RULES)).toBe('too_long');
    expect(validateRange('2026-12-01', '2026-12-31', FREE, RULES)).toBeNull();
  });

  it('užimta diena laikotarpio viduje', () => {
    expect(validateRange('2026-11-28', '2026-12-03', BOOKED, RULES)).toBe('busy_inside');
    expect(validateRange('2026-11-28', '2026-12-08', BOOKED, RULES)).toBe('busy_inside');
  });

  it('pradžia užimtą dieną', () => {
    expect(validateRange('2026-12-02', '2026-12-08', BOOKED, RULES)).toBe('start_unavailable');
  });

  it('galima baigti tą dieną, kai prasideda kito kliento nuoma', () => {
    expect(validateRange('2026-11-28', '2026-12-01', BOOKED, RULES)).toBeNull();
  });

  it('galima pradėti tą dieną, kai baigiasi kito kliento nuoma', () => {
    expect(validateRange('2026-12-05', '2026-12-07', BOOKED, RULES)).toBeNull();
  });

  it('jei kurio nors mėnesio dienos dar neužkrautos – laikotarpis nepatvirtinamas', () => {
    expect(validateRange('2027-01-15', '2027-01-25', FREE, RULES)).toBe('not_loaded');
  });

  it('laikotarpis per vasaros laiko keitimą skaičiuojamas kalendorinėmis paromis', () => {
    const rules = { siandien: '2027-03-01', min_paru: 1, max_paru: 2 };
    const days: DayMap = {};
    for (let day = '2027-03-25'; day <= '2027-03-31'; day = addDays(day, 1)) {
      days[day] = { data: day, busena: 'laisva', galima_pradeti: true, galima_baigti: true };
    }
    // 2027-03-28 laikrodis persukamas: 27→29 vis tiek yra lygiai 2 paros.
    expect(validateRange('2027-03-27', '2027-03-29', days, rules)).toBeNull();
    expect(validateRange('2027-03-27', '2027-03-30', days, rules)).toBe('too_long');
  });
});

describe('selectDay', () => {
  it('pirmas paspaudimas nustato pradžią, antras – pabaigą', () => {
    const first = selectDay(EMPTY_SELECTION, '2026-12-10', FREE, RULES);
    expect(first).toEqual({ selection: { from: '2026-12-10', to: null }, problem: null });
    const second = selectDay(first.selection, '2026-12-14', FREE, RULES);
    expect(second).toEqual({ selection: { from: '2026-12-10', to: '2026-12-14' }, problem: null });
  });

  it('trečias paspaudimas pradeda iš naujo', () => {
    const done = { from: '2026-12-10', to: '2026-12-14' };
    expect(selectDay(done, '2026-12-20', FREE, RULES).selection).toEqual({ from: '2026-12-20', to: null });
  });

  it('paspaudus ankstesnę dieną nei pradžia – pradžia perkeliama', () => {
    const started = { from: '2026-12-10', to: null };
    expect(selectDay(started, '2026-12-08', FREE, RULES).selection).toEqual({ from: '2026-12-08', to: null });
  });

  it('netinkama pabaiga palieka pradžią ir grąžina priežastį', () => {
    const started = { from: '2026-11-28', to: null };
    expect(selectDay(started, '2026-12-03', BOOKED, RULES)).toEqual({ selection: started, problem: 'busy_inside' });
  });

  it('užimtos dienos pradžiai pasirinkti negalima', () => {
    expect(selectDay(EMPTY_SELECTION, '2026-12-02', BOOKED, RULES)).toEqual({
      selection: EMPTY_SELECTION,
      problem: 'start_unavailable',
    });
  });

  it('praėjusios dienos pasirinkti negalima', () => {
    expect(selectDay(EMPTY_SELECTION, '2026-11-24', FREE, RULES).problem).toBe('past');
  });
});

describe('dayRole / isDayPressable', () => {
  const selection = { from: '2026-12-10', to: '2026-12-14' };

  it('nustato dienos vaidmenį pasirinkime', () => {
    expect(dayRole('2026-12-10', selection)).toBe('start');
    expect(dayRole('2026-12-12', selection)).toBe('inside');
    expect(dayRole('2026-12-14', selection)).toBe('end');
    expect(dayRole('2026-12-15', selection)).toBe('none');
  });

  it('pradžiai spaudžiamos tik dienos, kuriomis galima pradėti', () => {
    expect(isDayPressable(BOOKED['2026-12-02'], EMPTY_SELECTION)).toBe(false);
    expect(isDayPressable(BOOKED['2026-12-05'], EMPTY_SELECTION)).toBe(true);
    expect(isDayPressable(BOOKED['2026-11-24'], EMPTY_SELECTION)).toBe(false);
    expect(isDayPressable(undefined, EMPTY_SELECTION)).toBe(false);
  });

  it('renkantis pabaigą spaudžiama ir kito kliento paėmimo diena', () => {
    expect(isDayPressable(BOOKED['2026-12-01'], { from: '2026-11-28', to: null })).toBe(true);
  });
});
