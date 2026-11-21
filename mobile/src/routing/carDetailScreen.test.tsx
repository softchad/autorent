import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as carsApi from '@/api/cars';
import { PublicCar } from '@/api/types';
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

const fetchCar = jest.mocked(carsApi.fetchCar);

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
});

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

  it('rezervavimo ekrano dar nėra, todėl rezervavimo juostos nėra ir niekur nenaviguojama', async () => {
    await renderWith({ id: '12', nuo: '2026-11-28', iki: '2026-12-02' });
    await waitFor(() => expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy());
    expect(screen.queryByTestId('choose-dates')).toBeNull();
    expect(screen.queryByRole('button', { name: /Rezervuoti dabar/ })).toBeNull();
    expect(mockRouter.push).not.toHaveBeenCalled();
  });
});
