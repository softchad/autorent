import { formatDateLong } from './format';
import {
  addDays,
  diffDays,
  fullYearsBetween,
  isBefore,
  isValidIsoDate,
  MAX_SUPPORTED_YEAR,
  MIN_SUPPORTED_YEAR,
  toIsoDate,
  weekdayMondayFirst,
} from './isoDate';

describe('isValidIsoDate', () => {
  it.each(['2026-11-28', '2024-02-29', '2000-02-29', '1990-01-01', '1000-01-01', '9999-12-31'])('priima %p', (value) => {
    expect(isValidIsoDate(value)).toBe(true);
  });

  it.each(['2026-02-30', '2025-02-29', '1900-02-29', '2100-02-29', '2026-13-01', '2026-00-10', '2026-01-00', '2026-1-5', '28-11-2026', '', 'abc', '2026-11-18T00:00', ' 2026-11-18'])(
    'atmeta %p',
    (value) => {
      expect(isValidIsoDate(value)).toBe(false);
    },
  );

  // Date.UTC metus 0–99 paverstų 1900–1999; tokie metai ir 5 skaitmenų metai nepalaikomi.
  it.each(['0000-01-01', '0050-06-15', '0099-12-31', '0999-12-31', '10000-01-01'])('metai už palaikomų ribų: %p', (value) => {
    expect(isValidIsoDate(value)).toBe(false);
  });

  it('palaikomas intervalas yra 1000–9999 m.', () => {
    expect([MIN_SUPPORTED_YEAR, MAX_SUPPORTED_YEAR]).toEqual([1000, 9999]);
  });

  it('kiekvieną palaikomą ribinę datą galima formatuoti su format.ts', () => {
    expect(formatDateLong('1000-01-01')).toBe('1000 m. sausio 1 d.');
    expect(formatDateLong('9999-12-31')).toBe('9999 m. gruodžio 31 d.');
  });
});

describe('addDays / diffDays', () => {
  it('pereina per mėnesio ir metų ribą', () => {
    expect(addDays('2026-11-30', 1)).toBe('2026-12-01');
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
    expect(addDays('2028-02-28', 1)).toBe('2028-02-29');
  });

  it('vasaros laiko keitimo naktis vis tiek yra viena para', () => {
    // 2026-03-29 Lietuvoje laikrodis persukamas į priekį, 2026-10-25 – atgal.
    expect(diffDays('2026-03-28', '2026-03-30')).toBe(2);
    expect(diffDays('2026-10-24', '2026-10-26')).toBe(2);
    expect(addDays('2026-03-28', 1)).toBe('2026-03-29');
    expect(addDays('2026-10-25', 1)).toBe('2026-10-26');
  });

  it('diffDays yra neigiamas, kai antra data ankstesnė', () => {
    expect(diffDays('2026-11-28', '2026-11-25')).toBe(-3);
  });

  it('atmeta netinkamą datą', () => {
    expect(() => addDays('2026-02-30', 1)).toThrow('Netinkama data');
    expect(() => diffDays('2026-11-18', '2026-1-5')).toThrow('Netinkama data');
  });

  it.each([0.5, -0.5, 1.9, NaN, Infinity, -Infinity, 2 ** 53])('atmeta ne sveikąjį ar nesaugų dienų skaičių %p', (days) => {
    expect(() => addDays('2026-11-18', days)).toThrow('Netinkamas dienų skaičius');
  });

  it('neišeina už palaikomų metų ribų', () => {
    expect(addDays('9999-12-30', 1)).toBe('9999-12-31');
    expect(() => addDays('9999-12-31', 1)).toThrow('Data už palaikomų ribų');
    expect(addDays('1000-01-02', -1)).toBe('1000-01-01');
    expect(() => addDays('1000-01-01', -1)).toThrow('Data už palaikomų ribų');
    expect(() => addDays('2026-11-18', 1e12)).toThrow('Data už palaikomų ribų');
  });
});

describe('toIsoDate', () => {
  it('prideda nulius', () => {
    expect(toIsoDate(2026, 3, 5)).toBe('2026-03-05');
  });

  it.each([
    [2026, 2, 30],
    [2025, 2, 29],
    [2026, 13, 1],
    [2026, 0, 1],
    [999, 1, 1],
    [10000, 1, 1],
    [-5, 1, 1],
    [2026.5, 1, 1],
    [2026, 1.5, 1],
    [NaN, 1, 1],
  ])('atmeta neegzistuojančią datą %p-%p-%p', (year, month, day) => {
    expect(() => toIsoDate(year, month, day)).toThrow('Netinkama data');
  });
});

describe('isBefore', () => {
  it('lygina chronologiškai', () => {
    expect(isBefore('2026-11-28', '2026-12-01')).toBe(true);
    expect(isBefore('2026-11-28', '2026-11-28')).toBe(false);
    expect(isBefore('2027-01-01', '2026-12-31')).toBe(false);
  });

  it.each([
    ['2026-1-5', '2026-01-10'],
    ['2026-01-10', '10000-01-01'],
    ['2026-02-30', '2026-03-01'],
    ['', '2026-01-01'],
  ])('atmeta netinkamą įvestį %p, %p', (first, second) => {
    expect(() => isBefore(first, second)).toThrow('Netinkama data');
  });
});

describe('fullYearsBetween', () => {
  it('skaičiuoja pilnus metus', () => {
    expect(fullYearsBetween('2008-11-18', '2026-11-17')).toBe(17);
    expect(fullYearsBetween('2008-11-18', '2026-11-18')).toBe(18);
  });

  it('vasario 29 d. gimusiam metai nekeliamaisiais metais sueina kovo 1 d. (kaip backend)', () => {
    expect(fullYearsBetween('2008-02-29', '2026-02-28')).toBe(17);
    expect(fullYearsBetween('2008-02-29', '2026-03-01')).toBe(18);
    expect(fullYearsBetween('2008-02-29', '2028-02-28')).toBe(19);
    expect(fullYearsBetween('2008-02-29', '2028-02-29')).toBe(20);
  });

  it('neigiamas, kai gimimo data vėlesnė', () => {
    expect(fullYearsBetween('2027-01-01', '2026-11-18')).toBe(-1);
  });

  it.each([
    ['2010-01-01', 'abc'],
    ['2010-01-01', ''],
    ['2008-11-18', '2026-11-18T01:00'],
    ['2008-11-18', '2026-02-30'],
    ['2008-2-29', '2026-11-18'],
  ])('netinkama data (%p, %p) meta klaidą, o ne grąžina NaN', (birth, onDate) => {
    expect(() => fullYearsBetween(birth, onDate)).toThrow('Netinkama data');
  });
});

describe('weekdayMondayFirst', () => {
  it('pirmadienis = 0, sekmadienis = 6', () => {
    expect(weekdayMondayFirst('2026-11-16')).toBe(0);
    expect(weekdayMondayFirst('2026-11-22')).toBe(6);
  });
});
