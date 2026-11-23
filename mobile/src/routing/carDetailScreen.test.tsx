import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as ExpoLocation from 'expo-location';
import * as carsApi from '@/api/cars';
import { ApiError } from '@/api/errors';
import * as geocodeApi from '@/api/geocode';
import * as routingApi from '@/api/routing';
import * as termsApi from '@/api/terms';
import { PublicCar, RentalInfo } from '@/api/types';
import { makeCar } from '@/testUtils/fixtures';
import CarDetailScreen from '../app/automobilis/[id]';

// Automobilio ekranas su imituotais maršruto parametrais, maršrutizatoriumi ir API.
// Tai nėra telefono ar tikros navigacijos bandymas.

type Params = Record<string, string | string[] | undefined>;
let mockParams: Params = {};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), navigate: jest.fn(), canGoBack: jest.fn() };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('@/api/cars');
jest.mock('@/api/terms');
jest.mock('@/api/geocode');
jest.mock('@/api/routing');
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { WebView: (props: object) => <View {...props} /> };
});

const fetchCar = jest.mocked(carsApi.fetchCar);
const fetchRentalInfo = jest.mocked(termsApi.fetchRentalInfo);
const geocodeAddress = jest.mocked(geocodeApi.geocodeAddress);
const fetchRoute = jest.mocked(routingApi.fetchRoute);
const PICKUP_POINT = { lat: 54.6862, lng: 25.2859 };

const RENTAL_INFO: RentalInfo = {
  draudimo_isskaita_eur: 500,
  skyriai: [
    { kodas: 'draudimas', pavadinimas: 'Draudimas', punktai: ['KASKO išskaita – 500 €.'] },
    { kodas: 'uzsienis', pavadinimas: 'Kelionės į užsienį', punktai: ['Reikia išankstinio sutikimo.'] },
  ],
};

// Visos užklausos imituojamos; tikras fetch kvietimas būtų testo klaida.
const originalFetch = globalThis.fetch;
const networkFetch = jest.fn();

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

beforeEach(() => {
  mockParams = {};
  Object.values(mockRouter).forEach((fn) => fn.mockReset());
  mockRouter.canGoBack.mockReturnValue(true);
  fetchCar.mockReset().mockResolvedValue(makeCar());
  fetchRentalInfo.mockReset().mockResolvedValue(RENTAL_INFO);
  geocodeAddress.mockReset().mockResolvedValue(PICKUP_POINT);
  fetchRoute.mockReset().mockResolvedValue(null);
  jest.mocked(ExpoLocation.getForegroundPermissionsAsync).mockReset().mockResolvedValue({ granted: true } as ExpoLocation.LocationPermissionResponse);
  jest.mocked(ExpoLocation.requestForegroundPermissionsAsync).mockReset().mockResolvedValue({ granted: true } as ExpoLocation.LocationPermissionResponse);
  jest.mocked(ExpoLocation.getCurrentPositionAsync).mockReset();
  networkFetch.mockReset().mockRejectedValue(new Error('tinklas testuose nenaudojamas'));
  globalThis.fetch = networkFetch as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  expect(networkFetch).not.toHaveBeenCalled();
});

async function expandSheet() {
  await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti automobilio informaciją' }));
}

async function renderWith(params: Params) {
  mockParams = params;
  return render(<CarDetailScreen />);
}

describe('automobilio ekranas – automobilio numeris', () => {
  it.each<[string, string | string[] | undefined]>([
    ['raidės', 'abc'],
    ['nulis', '0'],
    ['neigiamas', '-1'],
    ['trupmena', '1.5'],
    ['eksponentė', '1e3'],
    ['šešioliktainis', '0x1F'],
    ['tarpai', ' 12'],
    ['priekinis nulis', '012'],
    ['nesaugus dydis', '9007199254740993'],
    ['masyvas', ['12', '13']],
    ['nėra', undefined],
  ])('netinkamas (%s): API nekviečiama, rodoma klaida su grįžimu', async (_name, id) => {
    await renderWith({ id });

    expect(screen.getByTestId('error-view')).toHaveTextContent(/Automobilis nerastas: netinkamas automobilio numeris nuorodoje\./);
    expect(screen.queryByTestId('retry-button')).toBeNull();
    expect(fetchCar).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Atgal' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
  });

  it('tinkamas numeris perduodamas API kaip skaičius', async () => {
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    expect(fetchCar).toHaveBeenCalledWith(12, undefined, expect.any(AbortSignal));
  });
});

describe('automobilio ekranas – laikotarpis', () => {
  it('tinkamas laikotarpis perduodamas serveriui', async () => {
    await renderWith({ id: '12', nuo: '2026-11-28', iki: '2026-12-02' });
    await waitFor(() => expect(fetchCar).toHaveBeenCalled());
    expect(fetchCar).toHaveBeenCalledWith(12, { date_from: '2026-11-28', date_to: '2026-12-02' }, expect.any(AbortSignal));
  });

  it.each<[string, Params]>([
    ['sukeistos datos', { nuo: '2026-12-02', iki: '2026-11-28' }],
    ['ta pati diena', { nuo: '2026-11-28', iki: '2026-11-28' }],
    ['tik pradžia', { nuo: '2026-11-28' }],
    ['tik pabaiga', { iki: '2026-12-02' }],
    ['neegzistuojanti data', { nuo: '2026-02-30', iki: '2026-03-02' }],
    ['ne datos formatas', { nuo: '28.11.2026', iki: '2026-12-02' }],
    ['masyvas', { nuo: ['2026-11-28', '2026-11-29'], iki: '2026-12-02' }],
  ])('netinkamas laikotarpis (%s): automobilis užkraunamas be jo', async (_name, dates) => {
    await renderWith({ id: '12', ...dates });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    expect(fetchCar).toHaveBeenCalledTimes(1);
    expect(fetchCar).toHaveBeenCalledWith(12, undefined, expect.any(AbortSignal));
  });
});

describe('automobilio ekranas – užkrovimas', () => {
  it('kraunant rodomas krovimas, nepavykus – klaida, o pakartojus – automobilis', async () => {
    const first = deferred<PublicCar>();
    fetchCar.mockReturnValueOnce(first.promise).mockResolvedValueOnce(makeCar({ modelis: 'Yaris' }));
    await renderWith({ id: '12' });
    expect(screen.getByTestId('loading-view')).toBeTruthy();

    first.reject(new Error('ryšys'));
    await waitFor(() => expect(screen.getByTestId('error-view')).toBeTruthy());
    expect(screen.queryByTestId('loading-view')).toBeNull();

    await fireEvent.press(screen.getByTestId('retry-button'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Yaris' })).toBeTruthy());
    expect(fetchCar).toHaveBeenCalledTimes(2);
  });

  it('pakeitus automobilį vėluojantis ankstesnio atsakymas nerodomas', async () => {
    const old = deferred<PublicCar>();
    const next = deferred<PublicCar>();
    fetchCar.mockImplementation((carId) => (carId === 12 ? old.promise : next.promise));
    const view = await renderWith({ id: '12' });

    mockParams = { id: '13' };
    await view.rerender(<CarDetailScreen />);
    expect(fetchCar).toHaveBeenLastCalledWith(13, undefined, expect.any(AbortSignal));
    expect((fetchCar.mock.calls[0][2] as AbortSignal).aborted).toBe(true);

    next.resolve(makeCar({ automobilio_id: 13, marke: 'Audi', modelis: 'A4' }));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Audi A4' })).toBeTruthy());
    old.resolve(makeCar({ automobilio_id: 12 }));
    await old.promise;

    expect(screen.getByRole('header', { name: 'Audi A4' })).toBeTruthy();
    expect(screen.queryByText('Toyota Corolla')).toBeNull();
  });
});

describe('automobilio ekranas – grįžimas ir rezervavimas', () => {
  it('su navigacijos istorija „Atgal“ grįžta atgal', async () => {
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Atgal' }));
    expect(mockRouter.back).toHaveBeenCalledTimes(1);
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('atidarius tiesiogiai, be istorijos, „Atgal“ veda į katalogą', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Atgal' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('be istorijos ir klaidos ar krovimo būsenoje „Atgal“ veda į katalogą', async () => {
    mockRouter.canGoBack.mockReturnValue(false);
    fetchCar.mockReturnValue(new Promise(() => undefined));
    await renderWith({ id: '12' });
    await fireEvent.press(screen.getByRole('button', { name: 'Atgal' }));
    expect(mockRouter.replace).toHaveBeenCalledWith('/');
  });

  it('rezervavimo juosta atidaro rezervavimo ekraną su automobiliu ir katalogo datomis', async () => {
    await renderWith({ id: '12', nuo: '2026-11-28', iki: '2026-12-02' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await fireEvent.press(screen.getByTestId('choose-dates'));
    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({
      pathname: '/rezervuoti/[id]',
      params: { id: '12', nuo: '2026-11-28', iki: '2026-12-02' },
    });
  });

  it('be tinkamo katalogo laikotarpio rezervavimo ekranui perduodamas tik automobilis', async () => {
    await renderWith({ id: '12', nuo: ['2026-11-28', '2026-11-29'], iki: '2026-12-02' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await fireEvent.press(screen.getByTestId('choose-dates'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/rezervuoti/[id]', params: { id: '12' } });
  });
});

describe('automobilio ekranas – draudimo ir kelionių sąlygos', () => {
  it('kraunant sąlygas rodomas krovimas, o užkrovus – visi skyriai išskleistame lape', async () => {
    const terms = deferred<RentalInfo>();
    fetchRentalInfo.mockReturnValueOnce(terms.promise);
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await expandSheet();
    expect(screen.getByTestId('terms-loading')).toHaveTextContent('Kraunamos draudimo ir kelionių į užsienį sąlygos…');

    terms.resolve(RENTAL_INFO);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Draudimas' })).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Kelionės į užsienį' })).toBeTruthy();
    expect(screen.getByText('KASKO išskaita – 500 €.')).toBeTruthy();
    expect(screen.getByText('Reikia išankstinio sutikimo.')).toBeTruthy();
    expect(screen.queryByTestId('terms-loading')).toBeNull();
    expect(fetchRentalInfo).toHaveBeenCalledWith(expect.any(AbortSignal));
  });

  it('sąlygų klaida rodoma su pakartojimu, o automobilio informacija lieka', async () => {
    fetchRentalInfo.mockRejectedValueOnce(new Error('ryšys')).mockResolvedValueOnce(RENTAL_INFO);
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    await expandSheet();
    await waitFor(() => expect(screen.getByTestId('terms-error')).toBeTruthy());

    expect(screen.getByRole('alert')).toHaveTextContent('Draudimo ir kelionių į užsienį sąlygų užkrauti nepavyko.');
    // Automobilis neužblokuotas: antraštė, techniniai duomenys ir paėmimo vieta matomi.
    expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy();
    expect(screen.getByTestId('car-specs')).toBeTruthy();
    expect(screen.getByText('Vilnius Centras')).toBeTruthy();
    expect(screen.queryByTestId('error-view')).toBeNull();

    await fireEvent.press(screen.getByTestId('terms-retry'));
    await waitFor(() => expect(screen.getByRole('header', { name: 'Draudimas' })).toBeTruthy());
    expect(screen.queryByTestId('terms-error')).toBeNull();
    expect(fetchRentalInfo).toHaveBeenCalledTimes(2);
    expect(fetchCar).toHaveBeenCalledTimes(1);
  });

  it('pakeitus automobilio numerį sąlygos neperkraunamos', async () => {
    const view = await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());

    fetchCar.mockResolvedValue(makeCar({ automobilio_id: 13, marke: 'Audi', modelis: 'A4' }));
    mockParams = { id: '13' };
    await view.rerender(<CarDetailScreen />);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Audi A4' })).toBeTruthy());
    await expandSheet();

    expect(screen.getByRole('header', { name: 'Draudimas' })).toBeTruthy();
    expect(fetchCar).toHaveBeenCalledTimes(2);
    expect(fetchRentalInfo).toHaveBeenCalledTimes(1);
  });
});

describe('automobilio ekranas – paėmimo vietos žemėlapis', () => {
  const USER = { lat: 54.7, lng: 25.3 };
  const ROUTE = { points: [USER, PICKUP_POINT], distanceMeters: 2400, durationSeconds: 420 };
  const KAUNAS = { vietos_id: 2, pavadinimas: 'Kaunas', adresas: 'Laisvės al. 1, Kaunas', miestas: 'Kaunas' };

  function mapData() {
    return JSON.parse(/var data = (.*);/.exec(screen.getByTestId('location-map').props.source.html)![1]);
  }

  it('rodo žemėlapį, adresą ir prieinamą autorystę, o anksčiau suteiktas leidimas GPS nepaleidžia', async () => {
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByTestId('location-map')).toBeTruthy());
    await expandSheet();

    expect(screen.getByText('Gedimino pr. 1, Vilnius')).toBeTruthy();
    expect(screen.getByRole('link', { name: 'Žemėlapio duomenys: © OpenStreetMap contributors' })).toBeTruthy();
    expect(geocodeAddress).toHaveBeenCalledWith('Gedimino pr. 1, Vilnius', expect.any(AbortSignal));
    expect(ExpoLocation.getForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(ExpoLocation.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    expect(ExpoLocation.getCurrentPositionAsync).not.toHaveBeenCalled();
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('geokodavimo klaida nepaslepia automobilio ir leidžia bandyti dar kartą', async () => {
    geocodeAddress.mockRejectedValueOnce(new ApiError('server', 503));
    await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByTestId('map-unavailable')).toBeTruthy());
    await expandSheet();

    expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy();
    expect(screen.getByTestId('car-specs')).toBeTruthy();
    expect(screen.getByText('Gedimino pr. 1, Vilnius')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('geocode-retry'));
    await waitFor(() => expect(screen.getByTestId('location-map')).toBeTruthy());
    expect(geocodeAddress).toHaveBeenCalledTimes(2);
  });

  it('pakeitus automobilį su kita paėmimo vieta ankstesnis maršrutas ir kliento vieta nerodomi', async () => {
    jest.mocked(ExpoLocation.getCurrentPositionAsync).mockResolvedValue({ coords: { latitude: USER.lat, longitude: USER.lng } } as ExpoLocation.LocationObject);
    fetchRoute.mockResolvedValue(ROUTE);
    const view = await renderWith({ id: '12' });
    await waitFor(() => expect(screen.getByTestId('location-map')).toBeTruthy());
    await expandSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Rodyti maršrutą' }));
    await waitFor(() => expect(mapData().route).toHaveLength(2));
    expect(mapData().user).toEqual(USER);

    geocodeAddress.mockResolvedValue({ lat: 54.8972, lng: 23.8861 });
    fetchCar.mockResolvedValue(makeCar({ automobilio_id: 13, marke: 'Audi', modelis: 'A4', lokacija: KAUNAS }));
    mockParams = { id: '13' };
    await view.rerender(<CarDetailScreen />);
    await waitFor(() => expect(mapData().point.title).toBe('Kaunas'));

    expect(mapData().route).toEqual([]);
    expect(mapData().user).toBeNull();
    expect(fetchRoute).toHaveBeenCalledTimes(1);
  });
});
