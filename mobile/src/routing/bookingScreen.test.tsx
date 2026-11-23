import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ComponentProps } from 'react';
import * as bookingApi from '@/api/booking';
import * as carsApi from '@/api/cars';
import { PublicCar } from '@/api/types';
import { AuthStatus, useAuth } from '@/auth/AuthContext';
import { CalendarDay } from '@/features/booking/calendarLogic';
import { makeCar } from '@/testUtils/fixtures';
import { addDays } from '@/utils/isoDate';
import BookingScreen from '../app/rezervuoti/[id]';

// Rezervavimo ekranas su imituotais maršruto parametrais, maršrutizatoriumi, prisijungimo būsena ir API.
// Tai nėra telefono ar tikros navigacijos bandymas.

type Params = Record<string, string | string[] | undefined>;
let mockParams: Params = {};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn() };
// Kiekvieno „Tęsti“ mygtuko atvaizdavimo metu užrašoma, ar jis buvo įjungtas – dar prieš efektus.
const mockContinueEnabled: boolean[] = [];

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/components/Button', () => {
  const actual = jest.requireActual('@/components/Button');
  return {
    ...actual,
    Button: (props: ComponentProps<typeof actual.Button>) => {
      if (props.testID === 'booking-continue') {
        mockContinueEnabled.push(!props.disabled);
      }
      return <actual.Button {...props} />;
    },
  };
});
jest.mock('@/api/booking');
jest.mock('@/api/cars');
jest.mock('@/auth/AuthContext');

const api = jest.mocked(bookingApi);
const fetchCar = jest.mocked(carsApi.fetchCar);

const RULES = { siandien: '2026-11-28', min_paru: 1, max_paru: 30, grazinimas_iki_val: 10, paemimas_nuo_val: 12, paemimas_iki_val: 18 };
const EXTRAS = [
  {
    kodas: 'pilna_apsauga',
    pavadinimas: 'Pilna apsauga',
    aprasymas: 'Papildomos apsaugos paslauga. Sąlygos nurodomos nuomos sutartyje.',
    kaina_parai: 12,
  },
];
const PERIOD = { nuo: '2026-12-01', iki: '2026-12-03' };

function freeMonth(carId: number, year: number, month: number) {
  const dienos: CalendarDay[] = [];
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  for (let day = first; day.slice(5, 7) === first.slice(5, 7); day = addDays(day, 1)) {
    const past = day < RULES.siandien;
    dienos.push({ data: day, busena: past ? 'praeitis' : 'laisva', galima_pradeti: !past, galima_baigti: day > RULES.siandien });
  }
  return Promise.resolve({ automobilio_id: carId, metai: year, menuo: month, siandien: RULES.siandien, dienos });
}

// Atsakymas atitinka užklausą: tas pats automobilis, datos, parų skaičius ir paslaugos.
function quoteFor(input: { carId: number; from: string; to: string; extras: string[] }) {
  const days = Math.round((Date.parse(input.to) - Date.parse(input.from)) / 86_400_000);
  const lines = input.extras.map((kodas) => ({ kodas, pavadinimas: 'Pilna apsauga', kaina_parai: 12, suma: 12 * days }));
  const extrasTotal = lines.reduce((sum, line) => sum + line.suma, 0);
  return Promise.resolve({
    automobilio_id: input.carId, date_from: input.from, date_to: input.to, paru_skaicius: days, kaina_parai: 45,
    nuomos_suma: 45 * days, paslaugos: lines, paslaugu_suma: extrasTotal, viso: 45 * days + extrasTotal, laisvas: true,
  });
}

function setAuth(status: AuthStatus) {
  jest.mocked(useAuth).mockReturnValue({ status } as ReturnType<typeof useAuth>);
}

// Visos užklausos imituojamos; tikras fetch kvietimas būtų testo klaida.
const originalFetch = globalThis.fetch;
const networkFetch = jest.fn();

beforeEach(() => {
  mockParams = {};
  mockContinueEnabled.length = 0;
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockRouter.canGoBack.mockReturnValue(true);
  setAuth('signedOut');
  fetchCar.mockReset().mockImplementation((carId) => Promise.resolve(makeCar({ automobilio_id: carId })));
  api.fetchBookingRules.mockReset().mockResolvedValue(RULES);
  api.fetchExtras.mockReset().mockResolvedValue(EXTRAS);
  api.fetchCalendar.mockReset().mockImplementation(freeMonth);
  api.fetchQuote.mockReset().mockImplementation((input) => quoteFor(input));
  networkFetch.mockReset().mockRejectedValue(new Error('tinklas testuose nenaudojamas'));
  globalThis.fetch = networkFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(networkFetch).not.toHaveBeenCalled();
});

async function renderWith(params: Params) {
  mockParams = params;
  return render(<BookingScreen />);
}

const continueButton = () => screen.getByTestId('booking-continue');

// „Galima tęsti“ ekranui praneša BookingView efektas, todėl laukiama, kol mygtukas įsijungs.
async function waitForContinueEnabled() {
  await waitFor(() => expect(continueButton().props.accessibilityState.disabled).toBe(false));
}

async function waitForPrice(total: string) {
  await waitFor(() => expect(screen.getByLabelText(`Iš viso: ${total}`)).toBeTruthy());
}

// Kai mygtukas turi likti išjungtas, palaukiama, kol įvyks visi efektai (ir BookingView pranešimas apie juodraštį).
async function settleEffects() {
  await act(async () => {});
}

describe('rezervavimo ekranas – maršruto parametrai', () => {
  it.each<[string, string | string[] | undefined]>([
    ['raidės', 'abc'],
    ['nulis', '0'],
    ['neigiamas', '-1'],
    ['trupmena', '1.5'],
    ['tuščias', ''],
    ['nesaugus dydis', '9007199254740993'],
    ['masyvas', ['12']],
    ['nėra', undefined],
  ])('netinkamas automobilio numeris (%s): API nekviečiama', async (_name, id) => {
    await renderWith({ id, ...PERIOD });
    expect(screen.getByTestId('error-view')).toHaveTextContent(/Automobilis nerastas/);
    expect(fetchCar).not.toHaveBeenCalled();
    expect(api.fetchBookingRules).not.toHaveBeenCalled();
    expect(api.fetchExtras).not.toHaveBeenCalled();
    expect(api.fetchQuote).not.toHaveBeenCalled();
  });

  it('katalogo laikotarpis pažymimas ir kaina prašoma būtent jam', async () => {
    await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    expect(fetchCar).toHaveBeenCalledWith(12, undefined, expect.any(AbortSignal));
    expect(screen.getByTestId('selected-period')).toHaveTextContent('Pasirinkta: gruodžio 1 d. – gruodžio 3 d. (2 paros)');
    expect(api.fetchQuote).toHaveBeenCalledWith({ carId: 12, from: '2026-12-01', to: '2026-12-03', extras: [] }, expect.any(AbortSignal));
  });

  it('pakartotas datos parametras (masyvas) data nelaikomas', async () => {
    await renderWith({ id: '12', nuo: ['2026-12-01'], iki: '2026-12-03' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    expect(screen.queryByTestId('selected-period')).toBeNull();
    expect(api.fetchQuote).not.toHaveBeenCalled();
  });
});

describe('rezervavimo ekranas – tęsimas', () => {
  it('neprisijungęs klientas su paruoštu pasirinkimu atidaro prisijungimą', async () => {
    await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    await waitForContinueEnabled();
    expect(continueButton()).toHaveTextContent(/^Prisijunkite, kad galėtumėte rezervuoti\./);
    await fireEvent.press(continueButton());
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/prisijungimas', params: { griztiAtgal: '1' } });
  });

  it('be pasirinkto laikotarpio tęsti negalima', async () => {
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await fireEvent.press(continueButton());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('kol prisijungimo būsena kraunasi, kvietimo prisijungti nėra ir paspaudimas nieko nedaro', async () => {
    setAuth('loading');
    await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    await settleEffects();
    expect(continueButton()).not.toHaveTextContent(/Prisijunkite/);
    expect(continueButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(continueButton());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('prisijungusiam klientui į neegzistuojantį patvirtinimo ekraną nenaviguojama', async () => {
    setAuth('signedIn');
    await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    await settleEffects();
    expect(continueButton().props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(continueButton());
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.navigate).not.toHaveBeenCalled();
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });
});

describe('rezervavimo ekranas – automobilio keitimas', () => {
  it('kitam automobiliui ankstesnis juodraštis ir pasirinktos paslaugos nepersikelia', async () => {
    const view = await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    await fireEvent.press(screen.getByRole('checkbox', { name: /Pilna apsauga/ }));
    await waitForPrice('114,00 €');
    await waitForContinueEnabled();

    // Naujo automobilio kaina dar neatėjo – tęsti negalima nė vieno atvaizdavimo metu.
    api.fetchQuote.mockImplementation(() => new Promise(() => undefined));
    mockContinueEnabled.length = 0;
    mockParams = { id: '13', ...PERIOD };
    await view.rerender(<BookingScreen />);
    await waitFor(() => expect(screen.getByTestId('booking-continue')).toBeTruthy());

    expect(mockContinueEnabled.length).toBeGreaterThan(0);
    expect(mockContinueEnabled).not.toContain(true);
    expect(screen.getByRole('checkbox', { name: /Pilna apsauga/ }).props.accessibilityState.checked).toBe(false);
    await fireEvent.press(continueButton());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('A → B → A: grįžus prie pirmo automobilio ankstesnis „galima tęsti“ neatgyja', async () => {
    const view = await renderWith({ id: '12', ...PERIOD });
    await waitForPrice('90,00 €');
    await waitForContinueEnabled();

    // B dar kraunasi, kai klientas grįžta prie A; naujos A kainos dar nėra.
    fetchCar.mockImplementation((carId) =>
      carId === 13 ? new Promise<PublicCar>(() => undefined) : Promise.resolve(makeCar({ automobilio_id: carId })),
    );
    api.fetchQuote.mockImplementation(() => new Promise(() => undefined));
    mockParams = { id: '13', ...PERIOD };
    await view.rerender(<BookingScreen />);
    mockContinueEnabled.length = 0;
    mockParams = { id: '12', ...PERIOD };
    await view.rerender(<BookingScreen />);
    await waitFor(() => expect(screen.getByTestId('booking-continue')).toBeTruthy());

    expect(mockContinueEnabled.length).toBeGreaterThan(0);
    expect(mockContinueEnabled).not.toContain(true);
    await fireEvent.press(continueButton());
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
