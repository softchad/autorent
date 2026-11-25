import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as bookingApi from '@/api/booking';
import * as carsApi from '@/api/cars';
import * as holdsApi from '@/api/holds';
import * as termsApi from '@/api/terms';
import { CustomerReservation } from '@/api/types';
import { AuthStatus, useAuth } from '@/auth/AuthContext';
import { draftToParams } from '@/features/booking/bookingDraft';
import { BOOKING_DRAFT, BOOKING_RULES, makeCar, makeHold, makeQuote, makeReservation, makeTerms } from '@/testUtils/fixtures';
import ConfirmScreen from '../app/patvirtinimas';

// Patvirtinimo ekranas su tikrais ConfirmView, useHold, usePriceQuote, RequireAuth ir RequireCustomer.
// Imituojami maršruto parametrai, maršrutizatorius, prisijungimo būsena ir API moduliai.

type Params = Record<string, string | string[] | undefined>;
let mockParams: Params = {};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn() };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Circle: View };
});
jest.mock('@/api/booking');
jest.mock('@/api/cars');
jest.mock('@/api/holds');
jest.mock('@/api/terms');
jest.mock('@/auth/AuthContext');

const api = {
  fetchCar: jest.mocked(carsApi.fetchCar),
  fetchTerms: jest.mocked(termsApi.fetchTerms),
  fetchBookingRules: jest.mocked(bookingApi.fetchBookingRules),
  fetchQuote: jest.mocked(bookingApi.fetchQuote),
  createHold: jest.mocked(holdsApi.createHold),
  releaseHold: jest.mocked(holdsApi.releaseHold),
  confirmHold: jest.mocked(holdsApi.confirmHold),
};

const VALID = draftToParams(BOOKING_DRAFT);

function setAuth(status: AuthStatus, customerId: number | null = status === 'signedIn' ? 1 : null) {
  jest.mocked(useAuth).mockReturnValue({
    status,
    customer: customerId === null ? null : { kliento_id: customerId },
    notice: null,
    refreshCustomer: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useAuth>);
}

const originalFetch = globalThis.fetch;
const networkFetch = jest.fn();

beforeEach(() => {
  mockParams = { ...VALID };
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockRouter.canGoBack.mockReturnValue(true);
  setAuth('signedIn');
  api.fetchCar.mockReset().mockResolvedValue(makeCar());
  api.fetchTerms.mockReset().mockResolvedValue(makeTerms());
  api.fetchBookingRules.mockReset().mockResolvedValue(BOOKING_RULES);
  api.fetchQuote.mockReset().mockResolvedValue(makeQuote());
  api.createHold.mockReset().mockResolvedValue(makeHold());
  api.releaseHold.mockReset().mockResolvedValue(null);
  api.confirmHold.mockReset().mockResolvedValue(makeReservation());
  networkFetch.mockReset().mockRejectedValue(new Error('tinklas testuose nenaudojamas'));
  globalThis.fetch = networkFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(networkFetch).not.toHaveBeenCalled();
});

function expectNoApiCalls() {
  expect(api.fetchCar).not.toHaveBeenCalled();
  expect(api.fetchTerms).not.toHaveBeenCalled();
  expect(api.fetchBookingRules).not.toHaveBeenCalled();
  expect(api.fetchQuote).not.toHaveBeenCalled();
  expect(api.createHold).not.toHaveBeenCalled();
}

async function waitForReadyPrice() {
  await waitFor(() => expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy(), { timeout: 3000 });
}

async function confirm() {
  await waitForReadyPrice();
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByTestId('confirm-submit'));
}

describe('patvirtinimo ekranas – juodraščio patikra be API', () => {
  it.each<[string, Params]>([
    ['nėra parametrų', {}],
    ['nesaugus ID', { ...VALID, carId: '9007199254740993' }],
    ['neegzistuojanti data', { ...VALID, from: '2026-02-30' }],
    ['atvirkštinė datų tvarka', { ...VALID, from: '2026-12-05', to: '2026-12-01' }],
    ['pasikartojanti paslauga', { ...VALID, extras: 'pilna_apsauga,pilna_apsauga' }],
    ['masyvo parametras', { ...VALID, carId: ['12'] }],
  ])('%s: rodoma klaida, API ir laikymas nekviečiami', async (_name, params) => {
    mockParams = params;
    await render(<ConfirmScreen />);
    expect(screen.getByTestId('error-view')).toHaveTextContent(/Trūksta rezervacijos duomenų/);
    await act(async () => {});
    expectNoApiCalls();
  });

  it.each<[string, Params]>([
    ['valanda už serverio ribų', { ...VALID, pickupHour: '20' }],
    ['praėjusi pradžia', { ...VALID, from: '2026-11-20', to: '2026-11-25' }],
    ['per ilga trukmė', { ...VALID, to: '2027-01-15' }],
  ])('%s: po taisyklių gavimo laikymas nekuriamas', async (_name, params) => {
    mockParams = params;
    await render(<ConfirmScreen />);
    await waitFor(() => expect(screen.getByTestId('invalid-choose-again')).toBeTruthy());
    expect(api.createHold).not.toHaveBeenCalled();
    expect(api.fetchQuote).not.toHaveBeenCalled();
  });

  it('neprisijungusiam rodomas prisijungimas, duomenys ir laikymas nekraunami', async () => {
    setAuth('signedOut');
    await render(<ConfirmScreen />);
    expect(screen.getByTestId('require-auth')).toBeTruthy();
    await act(async () => {});
    expectNoApiCalls();
  });
});

describe('patvirtinimo ekranas – grįžimas', () => {
  it('be navigacijos istorijos atidaromas to automobilio rezervavimo ekranas', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    mockParams = { ...VALID, pickupHour: '20' };
    await render(<ConfirmScreen />);
    await waitFor(() => expect(screen.getByTestId('invalid-choose-again')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('invalid-choose-again'));
    expect(mockRouter.back).not.toHaveBeenCalled();
    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/rezervuoti/[id]', params: { id: '12' } });
  });

  it('su istorija grįžtama atgal', async () => {
    mockParams = { ...VALID, pickupHour: '20' };
    await render(<ConfirmScreen />);
    await waitFor(() => expect(screen.getByTestId('invalid-choose-again')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('invalid-choose-again'));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('patvirtinimo ekranas – sėkmė ir kliento ar juodraščio kaita', () => {
  it('patvirtinus rodoma sėkmė, o nuoroda veda į tikrą rezervacijų maršrutą', async () => {
    await render(<ConfirmScreen />);
    await confirm();
    await waitFor(() => expect(screen.getByTestId('booking-success')).toBeTruthy());
    expect(api.createHold).toHaveBeenCalledWith(
      expect.objectContaining({ carId: 12, from: '2026-12-01', to: '2026-12-05' }),
      expect.any(AbortSignal),
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Mano rezervacijos' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/rezervacijos');
    await fireEvent.press(screen.getByTestId('success-open'));
    expect(mockRouter.replace).toHaveBeenLastCalledWith({ pathname: '/rezervacija/[id]', params: { id: '501' } });
  });

  it('atsijungus ir prisijungus kitu klientu ankstesnė sėkmė nerodoma', async () => {
    const view = await render(<ConfirmScreen />);
    await confirm();
    await waitFor(() => expect(screen.getByTestId('booking-success')).toBeTruthy());

    setAuth('signedOut');
    await view.rerender(<ConfirmScreen />);
    expect(screen.queryByTestId('booking-success')).toBeNull();
    expect(screen.getByTestId('require-auth')).toBeTruthy();

    setAuth('signedIn', 2);
    await view.rerender(<ConfirmScreen />);
    expect(screen.queryByTestId('booking-success')).toBeNull();
    await waitFor(() => expect(api.createHold).toHaveBeenCalledTimes(2));
  });

  it('pasikeitus klientui A → B be atsijungimo ankstesnė sėkmė nerodoma', async () => {
    const view = await render(<ConfirmScreen />);
    await confirm();
    await waitFor(() => expect(screen.getByTestId('booking-success')).toBeTruthy());

    setAuth('signedIn', 2);
    await view.rerender(<ConfirmScreen />);
    expect(screen.queryByTestId('booking-success')).toBeNull();
  });

  it('pasikeitus juodraščiui ankstesnė sėkmė ir sutikimas nelieka', async () => {
    const view = await render(<ConfirmScreen />);
    await confirm();
    await waitFor(() => expect(screen.getByTestId('booking-success')).toBeTruthy());

    mockParams = { ...VALID, pickupHour: '15' };
    await view.rerender(<ConfirmScreen />);
    expect(screen.queryByTestId('booking-success')).toBeNull();
    await waitForReadyPrice();
    expect(screen.getByRole('checkbox').props.accessibilityState.checked).toBe(false);
  });

  it('pavėluotas kliento A patvirtinimas nerodomas klientui B', async () => {
    let resolveConfirm!: (value: CustomerReservation) => void;
    api.confirmHold.mockReturnValue(new Promise((resolve) => (resolveConfirm = resolve)));
    const view = await render(<ConfirmScreen />);
    await confirm();
    expect(api.confirmHold).toHaveBeenCalledTimes(1);

    setAuth('signedIn', 2);
    await view.rerender(<ConfirmScreen />);
    await act(async () => resolveConfirm(makeReservation()));
    expect(screen.queryByTestId('booking-success')).toBeNull();
  });
});
