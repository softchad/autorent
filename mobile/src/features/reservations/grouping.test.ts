import { ReservationStage } from '@/api/types';
import { makeReservation } from '@/testUtils/fixtures';
import { groupReservations, isCurrent, nextReservation } from './grouping';

const res = (id: number, etapas: ReservationStage, start: string) =>
  makeReservation({ rezervacijos_id: id, etapas, rezervacijos_pradzia: start });

const LIST = [
  res(1, 'pasibaigusi', '2026-09-01'),
  res(2, 'patvirtinta', '2026-12-20'),
  res(3, 'atsaukta', '2026-11-10'),
  res(4, 'laukia_patvirtinimo', '2026-12-03'),
  res(5, 'nuomos_laikas', '2026-12-01'),
  res(6, 'isnuomota', '2026-10-05'),
  res(7, 'nepatvirtinta_laiku', '2026-11-20'),
];
const ids = (list: { rezervacijos_id: number }[]) => list.map((item) => item.rezervacijos_id);

describe('isCurrent', () => {
  it.each([
    ['laukia_patvirtinimo', true],
    ['patvirtinta', true],
    ['nuomos_laikas', true],
    ['pasibaigusi', false],
    ['nepatvirtinta_laiku', false],
    ['isnuomota', false],
    ['atsaukta', false],
  ] as [ReservationStage, boolean][])('%s → %s', (etapas, expected) => {
    expect(isCurrent(makeReservation({ etapas }))).toBe(expected);
  });
});

describe('groupReservations', () => {
  it('esamos rikiuojamos nuo artimiausios, buvusios – nuo naujausios', () => {
    const { current, past } = groupReservations(LIST);
    expect(ids(current)).toEqual([5, 4, 2]);
    expect(ids(past)).toEqual([7, 3, 6, 1]);
  });

  it('kiekviena rezervacija patenka lygiai į vieną grupę', () => {
    const { current, past } = groupReservations(LIST);
    expect([...ids(current), ...ids(past)].sort()).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('nekeičia pradinio sąrašo', () => {
    groupReservations(LIST);
    expect(ids(LIST)).toEqual([1, 2, 3, 4, 5, 6, 7]);
  });

  it('tuščias sąrašas', () => {
    expect(groupReservations([])).toEqual({ current: [], past: [] });
  });
});

describe('nextReservation', () => {
  it('grąžina artimiausią esamą', () => {
    expect(nextReservation(LIST)?.rezervacijos_id).toBe(5);
  });

  it('be esamų rezervacijų – null', () => {
    expect(nextReservation([res(1, 'atsaukta', '2026-11-10')])).toBeNull();
  });
});
