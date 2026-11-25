import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as supportApi from '@/api/support';
import * as reservationsApi from '@/api/reservations';
import * as carsApi from '@/api/cars';
import * as bookingApi from '@/api/booking';
import { useAuth } from '@/auth/AuthContext';
import { deviceToday, monthOf, shiftMonthRef } from '@/features/catalogue/dateRange';
import { makeCar, makeReservation } from '@/testUtils/fixtures';
import { toIsoDate } from '@/utils/isoDate';
import AccountTab from '../app/(tabs)/paskyra';
import CarsTab from '../app/(tabs)/index';
import ReservationsTab from '../app/(tabs)/rezervacijos';
import MessagesTab from '../app/(tabs)/zinutes';
import DesignPreviewScreen from '../app/perziura';

// Expo Router kiekvieną failą aplanke paverčia ekranu, todėl čia tikrinamas išdėstymas diske
// ir pačių ekranų elgesys. Tai nėra telefono ar tikros navigacijos bandymas.

// Projekte nėra Node tipų, todėl aprašomos tik naudojamos funkcijos (bibliotekų nepridedame).
declare const __dirname: string;
type FsModule = {
  readdirSync(dir: string): string[];
  existsSync(target: string): boolean;
  readFileSync(target: string, encoding: 'utf8'): string;
};
type PathModule = { join(...parts: string[]): string; resolve(...parts: string[]): string };
const fs = jest.requireActual<FsModule>('fs');
const path = jest.requireActual<PathModule>('path');

const mockRouter = { push: jest.fn(), navigate: jest.fn() };

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  const { useEffect } = jest.requireActual('react');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
    Stack: { Screen: () => null },
    useRouter: () => mockRouter,
    // Fokusas imituojamas vieną kartą sumontavus ekraną.
    useFocusEffect: (effect: () => void) => useEffect(effect, [effect]),
  };
});
// Katalogo ir pagalbos užklausos imituojamos: testai tinklo neliečia.
jest.mock('@/api/cars');
jest.mock('@/api/booking');
jest.mock('@/api/support');
jest.mock('@/api/reservations');
jest.mock('@/auth/AuthContext');

const CUSTOMER = {
  kliento_id: 7,
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  registracijos_data: null,
};

beforeEach(() => {
  jest.mocked(reservationsApi.fetchReservations).mockReset().mockResolvedValue([]);
  jest.mocked(supportApi.fetchConversations).mockReset().mockResolvedValue([]);
  mockRouter.push.mockReset();
  mockRouter.navigate.mockReset();
  jest.mocked(carsApi.fetchCars).mockReset().mockResolvedValue([]);
  jest.mocked(carsApi.fetchLocations).mockReset().mockResolvedValue([]);
  jest.mocked(bookingApi.fetchBookingRules).mockReset().mockResolvedValue({ siandien: deviceToday(), min_paru: 1, max_paru: 30, grazinimas_iki_val: 10, paemimas_nuo_val: 12, paemimas_iki_val: 18 });
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    notice: null,
    customer: CUSTOMER,
    signOut: jest.fn(),
    refreshCustomer: jest.fn(),
  } as unknown as ReturnType<typeof useAuth>);
});

const APP_DIR = path.resolve(__dirname, '..', 'app');
const TABS_DIR = path.join(APP_DIR, '(tabs)');

const devFlag = globalThis as unknown as { __DEV__: boolean };
const originalDev = devFlag.__DEV__;

afterEach(() => {
  devFlag.__DEV__ = originalDev;
});

function routeFiles(dir: string): string[] {
  return fs
    .readdirSync(dir)
    .filter((name) => /\.tsx?$/.test(name) && !name.startsWith('_') && !/\.test\./.test(name))
    .map((name) => name.replace(/\.tsx?$/, ''))
    .sort();
}

describe('skirtukų aplankas (tabs)', () => {
  it('rezervacijų kortelė atidaro jos detalę', async () => {
    jest.mocked(reservationsApi.fetchReservations).mockResolvedValue([makeReservation()]);
    await render(<ReservationsTab />);
    await fireEvent.press(await screen.findByTestId('reservation-card-501'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/rezervacija/[id]', params: { id: '501' } });
  });

  it('paskyros rezervacijų kortelė taip pat atidaro detalę', async () => {
    jest.mocked(reservationsApi.fetchReservations).mockResolvedValue([makeReservation()]);
    await render(<AccountTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rezervacijos' }));
    await fireEvent.press(await screen.findByTestId('reservation-card-501'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/rezervacija/[id]', params: { id: '501' } });
  });
  it('neprisijungus rezervacijų antraštė nerodoma, rodomas bendras prisijungimo vaizdas', async () => {
    jest.mocked(useAuth).mockReturnValue({ status: 'signedOut', notice: null } as ReturnType<typeof useAuth>);
    await render(<ReservationsTab />);
    expect(screen.queryByText('Mano rezervacijos')).toBeNull();
    expect(screen.getByTestId('require-auth')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Prisijungti' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Registruotis' })).toBeTruthy();
  });

  it('atkuriant sesiją rezervacijų antraštė ir prisijungimo kvietimas nerodomi', async () => {
    jest.mocked(useAuth).mockReturnValue({ status: 'loading', notice: null } as ReturnType<typeof useAuth>);
    await render(<ReservationsTab />);
    expect(screen.queryByText('Mano rezervacijos')).toBeNull();
    expect(screen.queryByTestId('require-auth')).toBeNull();
    expect(screen.getByTestId('loading-view')).toBeTruthy();
  });

  it('turi keturis skirtukų ekranus: automobiliai, rezervacijos, žinutės, paskyra', () => {
    expect(routeFiles(TABS_DIR)).toEqual(['index', 'paskyra', 'rezervacijos', 'zinutes']);
  });

  it('kiekvienas to aplanko failas yra deklaruotas skirtukų išdėstyme', () => {
    const layout = fs.readFileSync(path.join(TABS_DIR, '_layout.tsx'), 'utf8');
    const declared = [...layout.matchAll(/<Tabs\.Screen\s+name="([^"]+)"/g)].map((match) => match[1]).sort();

    // Nedeklaruotas failas tyliai taptų papildomu skirtuku.
    expect(declared).toEqual(routeFiles(TABS_DIR));
  });

  it('dizaino peržiūra yra šakniniame aplanke, o ne tarp skirtukų', () => {
    expect(fs.existsSync(path.join(APP_DIR, 'perziura.tsx'))).toBe(true);
    expect(fs.existsSync(path.join(TABS_DIR, 'perziura.tsx'))).toBe(false);
  });

  it('senas pradinis ekranas nebesikerta su skirtukų pradžia', () => {
    expect(fs.existsSync(path.join(APP_DIR, 'index.tsx'))).toBe(false);
    expect(fs.existsSync(path.join(TABS_DIR, 'index.tsx'))).toBe(true);
  });
});

describe('dizaino peržiūra', () => {
  it('kūrimo režime rodo peržiūros turinį', async () => {
    devFlag.__DEV__ = true;
    await render(<DesignPreviewScreen />);

    expect(screen.getByTestId('screen-preview')).toBeTruthy();
    expect(screen.getByTestId('preview-note')).toBeTruthy();
    expect(screen.queryByTestId('redirect')).toBeNull();
  });

  it('išleidimo režime turinys nerodomas, o naudotojas nukreipiamas į pradžią', async () => {
    devFlag.__DEV__ = false;
    await render(<DesignPreviewScreen />);

    expect(screen.getByTestId('redirect')).toHaveTextContent('/');
    expect(screen.queryByTestId('screen-preview')).toBeNull();
    expect(screen.queryByTestId('preview-note')).toBeNull();
    expect(screen.queryByTestId('preview-sheet')).toBeNull();
  });
});

// Dizaino peržiūros nuoroda perkelta iš automobilių skirtuko į paskyros ekraną.
describe('nuoroda į dizaino peržiūrą', () => {
  it('kūrimo režime ji yra paskyros ekrane ir atidaro /perziura', async () => {
    devFlag.__DEV__ = true;
    await render(<AccountTab />);

    await fireEvent.press(screen.getByTestId('account-preview'));
    expect(mockRouter.push).toHaveBeenCalledWith('/perziura');
  });

  it('išleidimo režime jos nėra nei paskyros, nei automobilių ekrane', async () => {
    devFlag.__DEV__ = false;
    await render(<AccountTab />);
    expect(screen.getByTestId('screen-account')).toBeTruthy();
    expect(screen.queryByTestId('account-preview')).toBeNull();
  });

  it('automobilių skirtuke jos nebėra ir kūrimo režime', async () => {
    devFlag.__DEV__ = true;
    await render(<CarsTab />);

    expect(screen.getByTestId('screen-cars')).toBeTruthy();
    expect(screen.queryByTestId('open-preview')).toBeNull();
  });
});

describe('automobilių skirtukas', () => {
  it('katalogo duomenis gauna per imituotą API, ne per tinklą', async () => {
    const originalFetch = globalThis.fetch;
    const networkFetch = jest.fn();
    globalThis.fetch = networkFetch as unknown as typeof fetch;
    try {
      await render(<CarsTab />);
      await waitFor(() => expect(carsApi.fetchLocations).toHaveBeenCalled());
      expect(carsApi.fetchCars).toHaveBeenCalled();
      expect(networkFetch).not.toHaveBeenCalled();
    } finally {
      globalThis.fetch = originalFetch;
    }
  });

  it('paspaudus kortelę atidaromas esamas automobilio ekranas su jo numeriu, pranešimas nebekviečiamas', async () => {
    jest.mocked(carsApi.fetchCars).mockResolvedValue([makeCar({ automobilio_id: 12 })]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<CarsTab />);
    await waitFor(() => expect(screen.getByTestId('car-card-12')).toBeTruthy());

    expect(screen.getByTestId('car-card-12').props.accessibilityHint).toBe('Atidaryti automobilio informaciją');
    await fireEvent.press(screen.getByTestId('car-card-12'));

    expect(mockRouter.push).toHaveBeenCalledTimes(1);
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/automobilis/[id]', params: { id: '12' } });
    expect(alert).not.toHaveBeenCalled();
    // Maršrutas, į kurį naviguojama, egzistuoja.
    expect(fs.existsSync(path.join(APP_DIR, 'automobilis', '[id].tsx'))).toBe(true);
    alert.mockRestore();
  });

  it('pasirinktas laikotarpis perduodamas automobilio ekranui', async () => {
    jest.mocked(carsApi.fetchCars).mockResolvedValue([makeCar({ automobilio_id: 12 })]);
    await render(<CarsTab />);
    await waitFor(() => expect(screen.getByTestId('car-card-12')).toBeTruthy());

    // Laikotarpis pasirenkamas kalendoriuje ir pritaikomas „Ieškoti“, kaip tikrame ekrane.
    const next = shiftMonthRef(monthOf(deviceToday()), 1);
    const from = toIsoDate(next.year, next.month, 3);
    const to = toIsoDate(next.year, next.month, 6);
    await fireEvent.press(screen.getByTestId('search-from'));
    await fireEvent.press(screen.getByTestId('dates-next'));
    await fireEvent.press(screen.getByTestId(`date-${from}`));
    await fireEvent.press(screen.getByTestId(`date-${to}`));
    await fireEvent.press(screen.getByTestId('dates-confirm'));
    await fireEvent.press(screen.getByTestId('search-submit'));
    await waitFor(() => expect(carsApi.fetchCars).toHaveBeenCalledWith(expect.objectContaining({ date_from: from, date_to: to }), expect.anything()));
    await waitFor(() => expect(screen.getByTestId('car-card-12')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('car-card-12'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/automobilis/[id]', params: { id: '12', nuo: from, iki: to } });
  });

  it('filtrų langas: atidaromas, pasirinkimas pritaikomas, langas užsidaro ir siunčiama nauja užklausa', async () => {
    jest.mocked(carsApi.fetchCars).mockResolvedValue([makeCar({ automobilio_id: 12 })]);
    await render(<CarsTab />);
    await waitFor(() => expect(screen.getByTestId('car-card-12')).toBeTruthy());
    const catalogueCalls = () => jest.mocked(carsApi.fetchCars).mock.calls.filter(([query]) => query.only_available !== false);
    expect(catalogueCalls()).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('open-filters'));
    expect(screen.getByTestId('filter-sheet')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('filter-kuro_tipas-elektra'));
    await fireEvent.press(screen.getByTestId('filter-max_kaina-60'));
    expect(catalogueCalls()).toHaveLength(1);

    await fireEvent.press(screen.getByTestId('filters-apply'));

    expect(screen.queryByTestId('filter-sheet')).toBeNull();
    await waitFor(() => expect(catalogueCalls()).toHaveLength(2));
    expect(catalogueCalls()[1][0]).toMatchObject({ kuro_tipas: 'elektra', max_kaina: 60, marke: null, vietos_id: null });
    expect(screen.getByRole('button', { name: 'Filtrai (2)' })).toBeTruthy();
  });

  it('filtrų langas gauna padalinių ir katalogo pasirinkimų klaidas su pakartojimu', async () => {
    jest.mocked(carsApi.fetchLocations).mockRejectedValueOnce(new Error('ryšys')).mockResolvedValue([]);
    jest.mocked(carsApi.fetchCars).mockImplementation((query) =>
      query.only_available === false ? Promise.reject(new Error('ryšys')) : Promise.resolve([]),
    );
    await render(<CarsTab />);
    await waitFor(() => expect(screen.getByTestId('brands-error')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('open-filters'));
    expect(screen.getByTestId('filter-locations-error')).toBeTruthy();
    expect(screen.getByTestId('filter-brands-error')).toBeTruthy();
    expect(screen.getByTestId('filter-bodies-error')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('filter-locations-retry'));
    await waitFor(() => expect(screen.getByTestId('filter-locations-empty')).toBeTruthy());
    expect(carsApi.fetchLocations).toHaveBeenCalledTimes(2);
  });

  it('padalinių ir markių užkrovimo klaida nerodoma kaip tuščias sąrašas', async () => {
    jest.mocked(carsApi.fetchLocations).mockRejectedValue(new Error('ryšys'));
    jest.mocked(carsApi.fetchCars).mockImplementation((query) =>
      query.only_available === false ? Promise.reject(new Error('ryšys')) : Promise.resolve([]),
    );
    await render(<CarsTab />);

    await waitFor(() => expect(screen.getByTestId('brands-error')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('search-location'));
    expect(screen.getByText('Padalinių sąrašo užkrauti nepavyko.')).toBeTruthy();
  });
});


describe('žinučių skirtukas', () => {
  it.each(['signedOut', 'loading'] as const)('%s būsenoje pokalbiai nekraunami ir antraštė nerodoma', async (status) => {
    jest.mocked(useAuth).mockReturnValue({ status, notice: null } as ReturnType<typeof useAuth>);
    await render(<MessagesTab />);
    expect(screen.queryByText('Žinutės')).toBeNull();
    expect(supportApi.fetchConversations).not.toHaveBeenCalled();
    expect(screen.getByTestId(status === 'signedOut' ? 'require-auth' : 'loading-view')).toBeTruthy();
  });

  it('prisijungus leidžia pradėti naują pokalbį', async () => {
    await render(<MessagesTab />);
    expect(await screen.findByTestId('inbox-new')).toBeTruthy();
    await fireEvent.press(screen.getByTestId('inbox-new'));
    expect(mockRouter.push).toHaveBeenCalledWith('/pokalbis/naujas');
    expect(supportApi.fetchConversations).toHaveBeenCalledTimes(1);
  });

  it('atidaro pasirinktą pokalbį, o pakeitus klientą pašalina ankstesnius pokalbius', async () => {
    jest.mocked(supportApi.fetchConversations).mockResolvedValueOnce([{
      pokalbio_id: 42, tema: 'Klausimas apie nuomą', kategorija: 'kita', busena: 'atviras',
      sukurimo_data: '2026-11-25T10:00:00Z', atnaujinimo_data: '2026-11-25T10:00:00Z',
      paskutine_zinute: null, paskutine_zinute_autorius: null, neperskaityta: false,
      rezervacija: null, sprendimo_santrauka: null,
    }]);
    const view = await render(<MessagesTab />);
    await fireEvent.press(await screen.findByTestId('conversation-42'));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/pokalbis/[id]', params: { id: '42' } });
    jest.mocked(useAuth).mockReturnValue({ ...useAuth(), customer: { ...CUSTOMER, kliento_id: 8 } });
    await view.rerender(<MessagesTab />);
    await waitFor(() => expect(supportApi.fetchConversations).toHaveBeenCalledTimes(2));
    expect(screen.queryByTestId('conversation-42')).toBeNull();
  });
});
