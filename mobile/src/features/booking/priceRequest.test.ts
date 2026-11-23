import { initialPriceState, inputKey, priceDifference, priceReducer, PriceState } from './priceRequest';

type Quote = { viso: number };
const start = (): PriceState<Quote> => initialPriceState<Quote>();

const A = inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-05', extras: [] });
const B = inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-06', extras: [] });

describe('inputKey', () => {
  it('paslaugų tvarka rakto nekeičia', () => {
    const first = inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-05', extras: ['a', 'b'] });
    const second = inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-05', extras: ['b', 'a'] });
    expect(first).toBe(second);
  });

  it('skirtingi pasirinkimai duoda skirtingus raktus', () => {
    expect(A).not.toBe(B);
    expect(inputKey({ carId: 2, from: '2026-12-01', to: '2026-12-05', extras: [] })).not.toBe(A);
    expect(inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-05', extras: ['a'] })).not.toBe(A);
  });

  it('nekeičia perduoto paslaugų sąrašo', () => {
    const extras = ['b', 'a'];
    inputKey({ carId: 1, from: '2026-12-01', to: '2026-12-05', extras });
    expect(extras).toEqual(['b', 'a']);
  });
});

describe('priceReducer', () => {
  it('nauji pasirinkimai → krovimas be kainos', () => {
    const state = priceReducer(start(), { type: 'input', key: A });
    expect(state).toMatchObject({ status: 'loading', key: A, quote: null });
  });

  it('atsakymas tiems patiems pasirinkimams parodomas', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    expect(state).toMatchObject({ status: 'ready', quote: { viso: 180 }, changed: false });
  });

  it('pavėlavęs atsakymas seniems pasirinkimams ignoruojamas', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'input', key: B });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    expect(state).toMatchObject({ status: 'loading', key: B, quote: null });
    state = priceReducer(state, { type: 'resolved', key: B, quote: { viso: 225 } });
    expect(state.quote).toEqual({ viso: 225 });
  });

  it('pasikeitus pasirinkimams sena kaina nebelieka ekrane', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    state = priceReducer(state, { type: 'input', key: B });
    expect(state.quote).toBeNull();
    expect(state.previousTotal).toBe(180);
  });

  it('pažymi, kad kaina pasikeitė, ir pasako kiek', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    state = priceReducer(state, { type: 'input', key: B });
    state = priceReducer(state, { type: 'resolved', key: B, quote: { viso: 225 } });
    expect(state.changed).toBe(true);
    expect(priceDifference(state)).toBe(45);
  });

  it('ta pati suma kitiems pasirinkimams nelaikoma pokyčiu', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    state = priceReducer(state, { type: 'input', key: B });
    state = priceReducer(state, { type: 'resolved', key: B, quote: { viso: 180 } });
    expect(state.changed).toBe(false);
  });

  it('pasenusios užklausos klaida ignoruojama, dabartinės – parodoma', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'input', key: B });
    expect(priceReducer(state, { type: 'failed', key: A, error: 'x' }).status).toBe('loading');
    expect(priceReducer(state, { type: 'failed', key: B, error: 'x' })).toMatchObject({ status: 'error', quote: null });
  });

  it('išvalius pasirinkimus grįžta į pradinę būseną', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    state = priceReducer(state, { type: 'input', key: null });
    expect(state).toMatchObject({ status: 'idle', key: null, quote: null, previousTotal: 180 });
  });

  it('tas pats raktas būsenos nekeičia (nepradedama nauja užklausa)', () => {
    const state = priceReducer(start(), { type: 'input', key: A });
    expect(priceReducer(state, { type: 'input', key: A })).toBe(state);
  });

  it('priceDifference be ankstesnės kainos grąžina null', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 180 } });
    expect(priceDifference(state)).toBeNull();
  });

  it('skirtumas suapvalinamas iki centų', () => {
    let state = priceReducer(start(), { type: 'input', key: A });
    state = priceReducer(state, { type: 'resolved', key: A, quote: { viso: 0.1 } });
    state = priceReducer(state, { type: 'input', key: B });
    state = priceReducer(state, { type: 'resolved', key: B, quote: { viso: 0.3 } });
    expect(priceDifference(state)).toBe(0.2);
  });
});
