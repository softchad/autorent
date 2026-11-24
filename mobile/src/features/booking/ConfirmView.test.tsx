import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ComponentProps } from 'react';
import { Quote } from '@/api/booking';
import { ApiError } from '@/api/errors';
import * as holdsApi from '@/api/holds';
import { CustomerReservation } from '@/api/types';
import { BOOKING_DRAFT, makeCar, makeHold, makeQuote, makeReservation, makeTerms } from '@/testUtils/fixtures';
import { ConfirmView } from './ConfirmView';
import { generateIdempotencyKey, isValidIdempotencyKey } from './idempotency';
import { PriceState } from './priceRequest';
import { useHold } from './useHold';
import { usePriceQuote } from './usePriceQuote';

// Komponento testai: laikymas, kaina ir API imituojami. Viso srauto su tikrais hook'ais įrodymas – routing/confirmFlow.test.tsx.

// Paskutinio atvaizdavimo „Patvirtinti“ paspaudimo funkcija – dvigubam paspaudimui iki kito atvaizdavimo imituoti.
let mockSubmitPress: (() => void) | null = null;

jest.mock('@/api/holds');
jest.mock('./useHold');
jest.mock('./usePriceQuote');
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Circle: View };
});
jest.mock('@/components/Button', () => {
  const actual = jest.requireActual('@/components/Button');
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (props.testID === 'confirm-submit') {
        mockSubmitPress = props.onPress;
      }
      return <actual.Button {...props} />;
    },
  };
});

const confirmHold = jest.mocked(holdsApi.confirmHold);
const markUsed = jest.fn();
const retry = jest.fn();

const TERMS = makeTerms();
const RESERVATION = makeReservation();
const EXPECTED_BODY = { holdId: 77, extras: ['pilna_apsauga'], pickupHour: 14, termsVersion: '2026-11-24', expectedTotal: 228 };

function readyPrice(quote: Quote = makeQuote()): PriceState<Quote> {
  return { status: 'ready', key: 'k', quote, error: null, previousTotal: null, changed: false };
}

let currentPrice: PriceState<Quote> = readyPrice();

function mockHold(status: 'creating' | 'active' | 'expired' | 'error', error: unknown = null) {
  jest.mocked(useHold).mockReturnValue({
    status,
    hold: status === 'active' || status === 'expired' ? makeHold() : null,
    remainingMs: status === 'active' ? 570_000 : 0,
    totalMs: 600_000,
    error,
    retry,
    markUsed,
  });
}

type ViewProps = ComponentProps<typeof ConfirmView>;

function setup(overrides: Partial<ViewProps> = {}) {
  const props: ViewProps = {
    draft: BOOKING_DRAFT,
    car: makeCar(),
    terms: TERMS,
    termsRefreshing: false,
    termsError: null,
    onReloadTerms: jest.fn(),
    returnByHour: 10,
    onConfirmed: jest.fn(),
    onChooseAgain: jest.fn(),
    ...overrides,
  };
  const view = render(<ConfirmView {...props} />);
  const rerender = (next: Partial<ViewProps>) => view.then((rendered) => rendered.rerender(<ConfirmView {...props} {...next} />));
  return { props, view, rerender };
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const submit = () => screen.getByTestId('confirm-submit');
const checkbox = () => screen.getByRole('checkbox');

async function acceptAndSubmit() {
  await fireEvent.press(checkbox());
  await fireEvent.press(submit());
}

beforeEach(() => {
  confirmHold.mockReset();
  markUsed.mockReset();
  retry.mockReset();
  mockSubmitPress = null;
  currentPrice = readyPrice();
  jest.mocked(usePriceQuote).mockReset().mockImplementation(() => currentPrice);
  mockHold('active');
});

describe('ConfirmView – rodymas ir sutikimas', () => {
  it('prieš patvirtinant rodo laikmatį, santrauką, kainą ir sąlygas', async () => {
    await setup().view;
    expect(screen.getByTestId('countdown-text')).toHaveTextContent('09:30');
    expect(screen.getByLabelText('Laikotarpis: gruodžio 1 d. – gruodžio 5 d.')).toBeTruthy();
    expect(screen.getByLabelText('Paėmimas: Vilnius Centras, 14:00')).toBeTruthy();
    expect(screen.getByLabelText('Grąžinimas: 2026 m. gruodžio 5 d., iki 10:00')).toBeTruthy();
    expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();
    expect(screen.getByText('Dėl rezervacijos atšaukimo kreipkitės į padalinį.')).toBeTruthy();
  });

  it('sutikimo tekstas atskirai nemini atšaukimo sąlygų', async () => {
    await setup().view;
    expect(checkbox().props.accessibilityLabel).toBe('Susipažinau su kaina ir nuomos sąlygomis ir su jomis sutinku');
  });

  it('be sutikimo su sąlygomis patvirtinti negalima', async () => {
    await setup().view;
    expect(submit().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(submit());
    expect(confirmHold).not.toHaveBeenCalled();
  });

  it('patvirtinus siunčia visą prašymą: laikymą, paslaugas, valandą, sąlygų versiją, sumą ir raktą', async () => {
    confirmHold.mockResolvedValue(RESERVATION);
    const { props, view } = setup();
    await view;
    await acceptAndSubmit();

    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledWith(RESERVATION));
    const sent = confirmHold.mock.calls[0][0];
    expect(sent).toEqual({ ...EXPECTED_BODY, idempotencyKey: expect.any(String) });
    expect(isValidIdempotencyKey(sent.idempotencyKey)).toBe(true);
    expect(markUsed).toHaveBeenCalledTimes(1);
  });

  it('savo laikymo užimtas viešas pasiūlymas (laisvas: false) patvirtinimo neblokuoja – sprendžia serveris', async () => {
    confirmHold.mockResolvedValue(RESERVATION);
    await setup().view;
    expect(makeQuote().laisvas).toBe(false);
    await acceptAndSubmit();
    await waitFor(() => expect(confirmHold).toHaveBeenCalledTimes(1));
  });
});

describe('ConfirmView – pateikimo apsaugos', () => {
  it('du paspaudimai iki kito atvaizdavimo siunčia vieną prašymą', async () => {
    const pending = deferred<CustomerReservation>();
    confirmHold.mockReturnValue(pending.promise);
    await setup().view;
    await fireEvent.press(checkbox());
    const press = mockSubmitPress!;
    await act(async () => {
      press();
      press();
    });
    expect(confirmHold).toHaveBeenCalledTimes(1);
    await act(async () => pending.resolve(RESERVATION));
  });

  it('atsakymas po išmontavimo nebekeičia būsenos ir nepraneša apie sėkmę', async () => {
    const pending = deferred<CustomerReservation>();
    confirmHold.mockReturnValue(pending.promise);
    const { props, view } = setup();
    const rendered = await view;
    await acceptAndSubmit();
    await rendered.unmount();
    await act(async () => pending.resolve(RESERVATION));
    expect(props.onConfirmed).not.toHaveBeenCalled();
    expect(markUsed).not.toHaveBeenCalled();
  });

  it.each([
    ['timeout', new ApiError('timeout')],
    ['ryšio klaida', new ApiError('network')],
    ['serverio klaida', new ApiError('server', 500)],
  ])('%s: rezultatas neaiškus, tikrinama tuo pačiu prašymu net pasibaigus vietiniam laikui', async (_name, error) => {
    confirmHold.mockRejectedValueOnce(error).mockResolvedValueOnce(RESERVATION);
    const { props, view, rerender } = setup();
    await view;
    await acceptAndSubmit();
    await waitFor(() => expect(screen.getByTestId('confirm-unknown')).toBeTruthy());
    expect(screen.getByTestId('confirm-error')).toHaveTextContent(/Nepavyko sužinoti, ar rezervacija sukurta/);
    expect(markUsed).not.toHaveBeenCalled();

    mockHold('expired');
    await rerender({});
    expect(screen.queryByTestId('hold-expired')).toBeNull();
    expect(screen.queryByText(/Rezervacija nesukurta/)).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Tikrinti rezultatą' }));
    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledWith(RESERVATION));
    expect(confirmHold).toHaveBeenCalledTimes(2);
    expect(confirmHold.mock.calls[1][0]).toEqual(confirmHold.mock.calls[0][0]);
  });

  it('410: naujas patvirtinimas užblokuojamas', async () => {
    confirmHold.mockRejectedValueOnce(new ApiError('unknown', 410, 'Laikymo laikas baigėsi.'));
    const { props, view } = setup();
    await view;
    await acceptAndSubmit();
    await waitFor(() => expect(screen.getByTestId('hold-expired')).toBeTruthy());
    expect(screen.queryByTestId('confirm-submit')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rinktis datas iš naujo' }));
    expect(props.onChooseAgain).toHaveBeenCalledTimes(1);
    expect(confirmHold).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmView – 409 konfliktai', () => {
  const conflict = () => new ApiError('conflict', 409, 'Serverio pranešimas');

  it('po 409 atnaujinamos sąlygos ir kaina; tas pats konfliktas – siūloma rinktis datas iš naujo', async () => {
    confirmHold.mockRejectedValueOnce(conflict());
    const { props, view } = setup();
    await view;
    await acceptAndSubmit();
    await waitFor(() => expect(screen.getByTestId('confirm-error')).toHaveTextContent('Serverio pranešimas'));
    expect(props.onReloadTerms).toHaveBeenCalledTimes(1);
    expect(jest.mocked(usePriceQuote).mock.calls.at(-1)?.[1]).toBe(1);
    expect(submit().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByRole('button', { name: 'Rinktis datas iš naujo' }));
    expect(props.onChooseAgain).toHaveBeenCalledTimes(1);
    expect(markUsed).not.toHaveBeenCalled();
  });

  it('kol sąlygos atnaujinamos, išvada nedaroma ir patvirtinti negalima', async () => {
    confirmHold.mockRejectedValueOnce(conflict());
    const { view, rerender } = setup();
    await view;
    await acceptAndSubmit();
    await waitFor(() => expect(screen.getByTestId('confirm-error')).toBeTruthy());
    await rerender({ termsRefreshing: true });
    expect(screen.queryByRole('button', { name: 'Rinktis datas iš naujo' })).toBeNull();
    expect(submit().props.accessibilityState.disabled).toBe(true);
  });

  it.each<[string, Partial<ViewProps>, Quote]>([
    ['pasikeitė suma', {}, makeQuote({ kaina_parai: 48, nuomos_suma: 192, viso: 240 })],
    ['pasikeitė sąlygų versija', { terms: makeTerms({ versija: '2026-12-01' }) }, makeQuote()],
  ])('%s: būtinas naujas sutikimas, o pakeistas prašymas gauna naują raktą', async (_name, next, quote) => {
    confirmHold.mockRejectedValueOnce(conflict()).mockResolvedValueOnce(RESERVATION);
    const { props, view, rerender } = setup();
    await view;
    await acceptAndSubmit();
    await waitFor(() => expect(props.onReloadTerms).toHaveBeenCalled());

    currentPrice = readyPrice(quote);
    await rerender(next);
    expect(screen.getByTestId('confirm-error')).toHaveTextContent(/^Kaina arba sąlygos pasikeitė/);
    expect(checkbox().props.accessibilityState.checked).toBe(false);
    expect(submit().props.accessibilityState.disabled).toBe(true);

    await acceptAndSubmit();
    await waitFor(() => expect(props.onConfirmed).toHaveBeenCalledWith(RESERVATION));
    const [first, second] = confirmHold.mock.calls.map(([input]) => input);
    expect(second.idempotencyKey).not.toBe(first.idempotencyKey);
    expect(second).toMatchObject({ termsVersion: (next.terms ?? TERMS).versija, expectedTotal: quote.viso });
  });

  it('nepavykus atnaujinti sąlygų rodomas pakartojimas', async () => {
    const onReloadTerms = jest.fn();
    await setup({ termsError: new ApiError('network'), onReloadTerms }).view;
    await fireEvent.press(screen.getByTestId('terms-retry'));
    expect(onReloadTerms).toHaveBeenCalledTimes(1);
  });
});

describe('ConfirmView – kaina ir laikymas', () => {
  it('nepavykus gauti kainos galima bandyti dar kartą su tais pačiais pasirinkimais', async () => {
    currentPrice = { status: 'error', key: 'k', quote: null, error: new ApiError('network'), previousTotal: null, changed: false };
    await setup().view;
    const firstInput = jest.mocked(usePriceQuote).mock.calls[0][0];
    await fireEvent.press(screen.getByTestId('price-retry'));
    const [input, refresh] = jest.mocked(usePriceQuote).mock.calls.at(-1)!;
    expect(refresh).toBe(1);
    expect(input).toEqual({ carId: 12, from: '2026-12-01', to: '2026-12-05', extras: ['pilna_apsauga'] });
    expect(input).toBe(firstInput);
  });

  it('pasibaigus laikui be išsiųsto prašymo paaiškina ir leidžia rinktis datas iš naujo', async () => {
    mockHold('expired');
    const { props, view } = setup();
    await view;
    expect(screen.getByRole('alert')).toHaveTextContent('Laikymo laikas baigėsi');
    expect(screen.queryByRole('button', { name: 'Patvirtinti rezervaciją' })).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Rinktis datas iš naujo' }));
    expect(props.onChooseAgain).toHaveBeenCalledTimes(1);
  });

  it('nepavykus užlaikyti rodo serverio priežastį', async () => {
    mockHold('error', new ApiError('conflict', 409, 'Šį automobilį šiuo metu rezervuoja kitas klientas.'));
    await setup().view;
    expect(screen.getByText('Šį automobilį šiuo metu rezervuoja kitas klientas.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it('kol laikymas kuriamas, rodo krovimą', async () => {
    mockHold('creating');
    await setup().view;
    expect(screen.getByLabelText('Užlaikome automobilį…')).toBeTruthy();
  });
});

describe('generateIdempotencyKey', () => {
  it('sukuria serverio priimamą raktą', () => {
    expect(isValidIdempotencyKey(generateIdempotencyKey())).toBe(true);
    expect(generateIdempotencyKey()).toHaveLength(36);
  });

  it('du raktai nesutampa', () => {
    const keys = new Set(Array.from({ length: 200 }, () => generateIdempotencyKey()));
    expect(keys.size).toBe(200);
  });

  it('raktas priklauso nuo atsitiktinių skaičių šaltinio ir laiko', () => {
    expect(generateIdempotencyKey(() => 0, 0)).toBe('00000000-0000-4000-0000-000000000000');
    expect(generateIdempotencyKey(() => 0, 255)).toBe('00000000-0000-4000-0000-0000000000ff');
  });

  it.each(['', 'trumpas', 'x'.repeat(65), 'su tarpais ir ženklais!'])('isValidIdempotencyKey atmeta %p', (key) => {
    expect(isValidIdempotencyKey(key)).toBe(false);
  });
});
