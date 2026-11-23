import { Quote } from '@/api/booking';
import { canContinue, draftFromParams, draftToParams, pickupHours, selectionFromSearch, toggleExtra } from './bookingDraft';
import { initialPriceState, PriceState } from './priceRequest';

const quote = (laisvas: boolean) => ({ viso: 180, laisvas }) as Quote;
const ready = (laisvas: boolean): PriceState<Quote> => ({ ...initialPriceState<Quote>(), status: 'ready', key: 'k', quote: quote(laisvas) });
const FULL = { from: '2026-12-01', to: '2026-12-05' };

describe('toggleExtra', () => {
  it('prideda ir pašalina paslaugą nekeisdama pradinio sąrašo', () => {
    const start = ['pilna_apsauga'];
    expect(toggleExtra(start, 'vaikiska_kedute')).toEqual(['pilna_apsauga', 'vaikiska_kedute']);
    expect(toggleExtra(start, 'pilna_apsauga')).toEqual([]);
    expect(start).toEqual(['pilna_apsauga']);
  });
});

describe('pickupHours', () => {
  it('sudaro valandų sąrašą imtinai', () => {
    expect(pickupHours(12, 18)).toEqual([12, 13, 14, 15, 16, 17, 18]);
  });
});

describe('canContinue', () => {
  it('reikia pilno laikotarpio, gatavos kainos ir laisvo automobilio', () => {
    expect(canContinue(FULL, ready(true))).toBe(true);
    expect(canContinue({ from: '2026-12-01', to: null }, ready(true))).toBe(false);
    expect(canContinue(FULL, ready(false))).toBe(false);
    expect(canContinue(FULL, { ...initialPriceState<Quote>(), status: 'loading', key: 'k' })).toBe(false);
    expect(canContinue(FULL, { ...initialPriceState<Quote>(), status: 'error', key: 'k' })).toBe(false);
  });
});

describe('selectionFromSearch', () => {
  const rules = { siandien: '2026-12-01', min_paru: 1, max_paru: 30 };

  it('tinkamas paieškos laikotarpis perkeliamas į rezervaciją', () => {
    expect(selectionFromSearch('2026-12-03', '2026-12-07', rules)).toEqual({ from: '2026-12-03', to: '2026-12-07' });
  });

  it.each([
    ['trūksta datos', undefined, '2026-12-07'],
    ['netinkamas formatas', '03.12.2026', '2026-12-07'],
    ['praėjusi diena', '2026-11-30', '2026-12-07'],
    ['pabaiga ne vėliau už pradžią', '2026-12-07', '2026-12-07'],
    ['per ilgas laikotarpis', '2026-12-03', '2027-02-10'],
  ])('%s – laikotarpis nepriimamas', (_name, from, to) => {
    expect(selectionFromSearch(from, to, rules)).toEqual({ from: null, to: null });
  });
});

describe('draftToParams / draftFromParams', () => {
  const draft = { carId: 12, from: '2026-12-01', to: '2026-12-05', pickupHour: 14, extras: ['pilna_apsauga', 'vaikiska_kedute'] };

  it('pirmyn ir atgal grąžina tą patį juodraštį', () => {
    expect(draftFromParams(draftToParams(draft))).toEqual(draft);
    expect(draftFromParams(draftToParams({ ...draft, extras: [] }))).toEqual({ ...draft, extras: [] });
  });

  it.each([
    [{}],
    [{ carId: 'abc', from: '2026-12-01', to: '2026-12-05', pickupHour: '12' }],
    [{ carId: '12', from: 'rytoj', to: '2026-12-05', pickupHour: '12' }],
    [{ carId: '12', from: '2026-12-01', to: '2026-12-05', pickupHour: 'x' }],
    [{ carId: '-1', from: '2026-12-01', to: '2026-12-05', pickupHour: '12' }],
  ])('sugadintus parametrus %p atmeta', (params) => {
    expect(draftFromParams(params)).toBeNull();
  });
});
