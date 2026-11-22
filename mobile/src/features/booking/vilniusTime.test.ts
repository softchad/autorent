import { hoursUntilVilnius, lastSundayOneAmUtc, vilniusDateOf, vilniusLocalToUtcMs, vilniusOffsetHours } from './vilniusTime';

const utc = (y: number, m: number, d: number, h = 0, min = 0) => Date.UTC(y, m - 1, d, h, min);

describe('lastSundayOneAmUtc', () => {
  it.each([
    [2026, 2, utc(2026, 3, 29, 1)],
    [2026, 9, utc(2026, 10, 25, 1)],
    [2027, 2, utc(2027, 3, 28, 1)],
    [2027, 9, utc(2027, 10, 31, 1)],
    // 2030-03-31 pats yra sekmadienis – paskutinė mėnesio diena.
    [2030, 2, utc(2030, 3, 31, 1)],
  ])('%i m., mėnuo %i', (year, monthIndex, expected) => {
    expect(lastSundayOneAmUtc(year, monthIndex)).toBe(expected);
  });
});

describe('vilniusOffsetHours', () => {
  it('žiemą UTC+2, vasarą UTC+3', () => {
    expect(vilniusOffsetHours(utc(2026, 1, 15, 12))).toBe(2);
    expect(vilniusOffsetHours(utc(2026, 7, 15, 12))).toBe(3);
    expect(vilniusOffsetHours(utc(2026, 11, 26, 12))).toBe(2);
  });

  it('pavasarį persijungia tiksliai 01:00 UTC', () => {
    expect(vilniusOffsetHours(utc(2026, 3, 29, 0, 59))).toBe(2);
    expect(vilniusOffsetHours(utc(2026, 3, 29, 1, 0))).toBe(3);
  });

  it('rudenį persijungia tiksliai 01:00 UTC', () => {
    expect(vilniusOffsetHours(utc(2026, 10, 25, 0, 59))).toBe(3);
    expect(vilniusOffsetHours(utc(2026, 10, 25, 1, 0))).toBe(2);
  });
});

describe('vilniusDateOf', () => {
  it('žiemą po 22:00 UTC Vilniuje jau kita diena', () => {
    expect(vilniusDateOf(utc(2026, 11, 26, 21, 59))).toBe('2026-11-26');
    expect(vilniusDateOf(utc(2026, 11, 26, 22, 0))).toBe('2026-11-27');
  });

  it('vasarą kita diena prasideda jau 21:00 UTC', () => {
    expect(vilniusDateOf(utc(2026, 7, 10, 20, 59))).toBe('2026-07-10');
    expect(vilniusDateOf(utc(2026, 7, 10, 21, 0))).toBe('2026-07-11');
  });

  it('pereina per metų ribą', () => {
    expect(vilniusDateOf(utc(2026, 12, 31, 22, 30))).toBe('2027-01-01');
  });

  it('nepriklauso nuo telefono laiko juostos (skaičiuojama tik iš UTC)', () => {
    const moment = utc(2026, 11, 26, 23, 30);
    expect(vilniusDateOf(moment)).toBe('2026-11-27');
  });
});

describe('vilniusLocalToUtcMs', () => {
  it('12:00 Vilniuje žiemą = 10:00 UTC, vasarą = 09:00 UTC', () => {
    expect(vilniusLocalToUtcMs('2026-12-01', 12)).toBe(utc(2026, 12, 1, 10));
    expect(vilniusLocalToUtcMs('2026-07-01', 12)).toBe(utc(2026, 7, 1, 9));
  });

  it('laiko keitimo dieną vidurdienis jau skaičiuojamas nauju laiku', () => {
    expect(vilniusLocalToUtcMs('2026-03-29', 12)).toBe(utc(2026, 3, 29, 9));
    expect(vilniusLocalToUtcMs('2026-10-25', 12)).toBe(utc(2026, 10, 25, 10));
  });

  it('pirmyn ir atgal duoda tą pačią datą', () => {
    for (const date of ['2026-03-28', '2026-03-29', '2026-03-30', '2026-10-24', '2026-10-25', '2026-10-26']) {
      expect(vilniusDateOf(vilniusLocalToUtcMs(date, 12))).toBe(date);
    }
  });
});

describe('hoursUntilVilnius', () => {
  it('skaičiuoja valandas iki paėmimo', () => {
    const now = utc(2026, 11, 29, 10, 0); // 12:00 Vilniuje
    expect(hoursUntilVilnius('2026-12-01', 12, now)).toBe(48);
    expect(hoursUntilVilnius('2026-11-29', 10, now)).toBe(-2);
  });

  it('per pavasario laiko keitimą para trunka 23 valandas', () => {
    const now = vilniusLocalToUtcMs('2026-03-28', 12);
    expect(hoursUntilVilnius('2026-03-29', 12, now)).toBe(23);
  });
});
