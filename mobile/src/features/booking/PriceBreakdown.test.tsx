import { act, render, renderHook, screen } from '@testing-library/react-native';
import { Animated, StyleSheet } from 'react-native';
import * as bookingApi from '@/api/booking';
import { Quote } from '@/api/booking';
import { ApiError } from '@/api/errors';
import { changeText, PriceBreakdown } from './PriceBreakdown';
import { initialPriceState, PriceState, QuoteInput } from './priceRequest';
import { QUOTE_DEBOUNCE_MS, usePriceQuote } from './usePriceQuote';

jest.mock('@/api/booking');
const fetchQuote = jest.mocked(bookingApi.fetchQuote);

// Sumažinto judesio nustatymas imituojamas; numatyta – įjungtas (kaip kol nustatymas dar nenuskaitytas).
let mockReduced = true;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

beforeEach(() => {
  mockReduced = true;
});

function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    automobilio_id: 1,
    date_from: '2026-12-01',
    date_to: '2026-12-05',
    paru_skaicius: 4,
    kaina_parai: 45,
    nuomos_suma: 180,
    paslaugos: [{ kodas: 'pilna_apsauga', pavadinimas: 'Pilna apsauga', kaina_parai: 12, suma: 48 }],
    paslaugu_suma: 48,
    viso: 228,
    laisvas: true,
    ...overrides,
  };
}

const ready = (quote: Quote, previousTotal: number | null = null): PriceState<Quote> => ({
  status: 'ready',
  key: 'k',
  quote,
  error: null,
  previousTotal,
  changed: previousTotal !== null && previousTotal !== quote.viso,
});

describe('PriceBreakdown', () => {
  it('rodo nuomos, paslaugų ir bendrą sumą', async () => {
    await render(<PriceBreakdown state={ready(makeQuote())} />);
    expect(screen.getByLabelText('Nuoma: 4 paros × 45,00 €: 180,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Pilna apsauga: 4 paros × 12,00 €: 48,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();
  });

  it('kol laikotarpis nepasirinktas – paaiškina', async () => {
    await render(<PriceBreakdown state={initialPriceState<Quote>()} />);
    expect(screen.getByText('Pasirinkite laikotarpį, kad pamatytumėte kainą.')).toBeTruthy();
  });

  it('skaičiuojant senos sumos nerodo', async () => {
    const loading: PriceState<Quote> = { ...initialPriceState<Quote>(), status: 'loading', key: 'k', previousTotal: 228 };
    await render(<PriceBreakdown state={loading} />);
    expect(screen.getByTestId('price-loading')).toBeTruthy();
    expect(screen.queryByText('228,00 €')).toBeNull();
  });

  it('praneša apie kainos pokytį', async () => {
    await render(<PriceBreakdown state={ready(makeQuote(), 180)} />);
    expect(screen.getByTestId('price-change')).toHaveTextContent('Kaina padidėjo 48,00 €');
  });

  it('klaidos atveju rodo pranešimą, o ne kainą', async () => {
    const failed: PriceState<Quote> = { ...initialPriceState<Quote>(), status: 'error', key: 'k', error: new ApiError('network') };
    await render(<PriceBreakdown state={failed} />);
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.queryByText('Iš viso')).toBeNull();
  });

  it('changeText', () => {
    expect(changeText(null)).toBeNull();
    expect(changeText(0)).toBeNull();
    expect(changeText(-12)).toBe('Kaina sumažėjo 12,00 €');
  });
});

describe('PriceBreakdown – judesys', () => {
  // Animuojamas sumų blokas – bendros sumos eilutės tėvas.
  const pulseStyle = () => StyleSheet.flatten(screen.getByLabelText('Iš viso: 228,00 €').parent?.props.style);
  const stoppableTiming = () => {
    const stop = jest.fn();
    const timing = jest.spyOn(Animated, 'timing').mockReturnValue({ start: jest.fn(), stop, reset: jest.fn() });
    return { timing, stop };
  };

  it('sumažinus judesį nuo pradžios suma neanimuojama ir visiškai matoma', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    await render(<PriceBreakdown state={ready(makeQuote())} />);
    expect(timing).not.toHaveBeenCalled();
    expect(pulseStyle()).toMatchObject({ opacity: 1 });
    timing.mockRestore();
  });

  it('įjungus sumažintą judesį vykstanti animacija sustabdoma ir suma visiškai matoma', async () => {
    mockReduced = false;
    const { timing, stop } = stoppableTiming();
    const view = await render(<PriceBreakdown state={ready(makeQuote())} />);
    expect(timing).toHaveBeenCalledTimes(1);

    mockReduced = true;
    await view.rerender(<PriceBreakdown state={ready(makeQuote())} />);

    expect(stop).toHaveBeenCalled();
    expect(timing).toHaveBeenCalledTimes(1);
    expect(pulseStyle()).toMatchObject({ opacity: 1 });
    timing.mockRestore();
  });

  it('išmontavus animacija sustabdoma', async () => {
    mockReduced = false;
    const { timing, stop } = stoppableTiming();
    const view = await render(<PriceBreakdown state={ready(makeQuote())} />);
    expect(stop).not.toHaveBeenCalled();
    await view.unmount();
    expect(stop).toHaveBeenCalled();
    timing.mockRestore();
  });
});

describe('usePriceQuote', () => {
  const input = (to: string, extras: string[] = []): QuoteInput => ({ carId: 1, from: '2026-12-01', to, extras });

  beforeEach(() => {
    jest.useFakeTimers();
    fetchQuote.mockReset();
  });
  afterEach(() => jest.useRealTimers());

  it('be pasirinkimų užklausos nesiunčia', async () => {
    const { result } = await renderHook(() => usePriceQuote(null));
    await act(async () => jest.advanceTimersByTime(1000));
    expect(fetchQuote).not.toHaveBeenCalled();
    expect(result.current.status).toBe('idle');
  });

  it('greitai keičiant pasirinkimus siunčia tik paskutinę užklausą', async () => {
    fetchQuote.mockResolvedValue(makeQuote());
    const { rerender } = await renderHook(({ value }: { value: QuoteInput }) => usePriceQuote(value), {
      initialProps: { value: input('2026-12-03') },
    });
    await rerender({ value: input('2026-12-04') });
    await rerender({ value: input('2026-12-05') });
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(fetchQuote).toHaveBeenCalledTimes(1);
    expect(fetchQuote.mock.calls[0][0]).toMatchObject({ to: '2026-12-05' });
  });

  it('pasikeitus pasirinkimams jau išsiųstą užklausą nutraukia ir jos atsakymo nerodo', async () => {
    let resolveFirst: (quote: Quote) => void = () => {};
    fetchQuote
      .mockImplementationOnce(() => new Promise<Quote>((resolve) => (resolveFirst = resolve)))
      .mockResolvedValueOnce(makeQuote({ viso: 300 }));
    const { result, rerender } = await renderHook(({ value }: { value: QuoteInput }) => usePriceQuote(value), {
      initialProps: { value: input('2026-12-05') },
    });
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    const firstSignal = fetchQuote.mock.calls[0][1] as AbortSignal;

    await rerender({ value: input('2026-12-07') });
    expect(firstSignal.aborted).toBe(true);
    expect(result.current.quote).toBeNull();

    await act(async () => resolveFirst(makeQuote({ viso: 180 })));
    expect(result.current.quote).toBeNull();

    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(result.current.quote?.viso).toBe(300);
  });

  // A → B → A: pirmoji A užklausa nepaiso abort ir atsako paskutinė; jos atsakymas tas pats raktas, bet pasenęs.
  async function returnToFirstSelection() {
    let settleFirst: { resolve: (quote: Quote) => void; reject: (error: unknown) => void } = {
      resolve: () => {},
      reject: () => {},
    };
    fetchQuote
      .mockImplementationOnce(() => new Promise<Quote>((resolve, reject) => (settleFirst = { resolve, reject })))
      .mockResolvedValueOnce(makeQuote({ viso: 300 }));
    const hook = await renderHook(({ value }: { value: QuoteInput }) => usePriceQuote(value), {
      initialProps: { value: input('2026-12-05') },
    });
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    await hook.rerender({ value: input('2026-12-07') });
    await hook.rerender({ value: input('2026-12-05') });
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(fetchQuote).toHaveBeenCalledTimes(2);
    expect(hook.result.current).toMatchObject({ status: 'ready', quote: { viso: 300 } });
    return { ...hook, settleFirst };
  }

  it('A → B → A: pavėluota pirmos A užklausos sėkmė naujesnės kainos neperrašo', async () => {
    const { result, settleFirst } = await returnToFirstSelection();
    await act(async () => settleFirst.resolve(makeQuote({ viso: 180 })));
    expect(result.current).toMatchObject({ status: 'ready', quote: { viso: 300 } });
  });

  it('A → B → A: pavėluota pirmos A užklausos klaida naujesnės kainos nepanaikina', async () => {
    const { result, settleFirst } = await returnToFirstSelection();
    await act(async () => settleFirst.reject(new ApiError('network')));
    expect(result.current).toMatchObject({ status: 'ready', quote: { viso: 300 }, error: null });
  });

  it('jau pirmame render pakeitus pasirinkimus senos kainos nėra', async () => {
    fetchQuote.mockResolvedValue(makeQuote({ viso: 180 }));
    // Būsena užrašoma pačio render metu – dar prieš įvykdant efektus.
    const rendered: PriceState<Quote>[] = [];
    const { rerender } = await renderHook(
      ({ value }: { value: QuoteInput | null }) => {
        const state = usePriceQuote(value);
        rendered.push(state);
        return state;
      },
      { initialProps: { value: input('2026-12-05') as QuoteInput | null } },
    );
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(rendered[rendered.length - 1].quote?.viso).toBe(180);

    rendered.length = 0;
    await rerender({ value: input('2026-12-07') });
    expect(rendered[0]).toMatchObject({ status: 'loading', quote: null, previousTotal: 180 });

    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    rendered.length = 0;
    await rerender({ value: null });
    expect(rendered[0]).toMatchObject({ status: 'idle', quote: null });
  });

  it('klaidą išsaugo būsenoje', async () => {
    fetchQuote.mockRejectedValue(new ApiError('network'));
    const { result } = await renderHook(() => usePriceQuote(input('2026-12-05')));
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(result.current.status).toBe('error');
  });
});
