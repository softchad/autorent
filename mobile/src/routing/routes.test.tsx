import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { Alert } from 'react-native';
import * as carsApi from '@/api/cars';
import { useAuth } from '@/auth/AuthContext';
import { makeCar } from '@/testUtils/fixtures';
import AccountTab from '../app/(tabs)/paskyra';
import CarsTab from '../app/(tabs)/index';
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
jest.mock('@/api/support');
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
  mockRouter.push.mockReset();
  mockRouter.navigate.mockReset();
  jest.mocked(carsApi.fetchCars).mockReset().mockResolvedValue([]);
  jest.mocked(carsApi.fetchLocations).mockReset().mockResolvedValue([]);
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
  it('turi tik tris skirtukų ekranus: automobiliai, rezervacijos, paskyra', () => {
    expect(routeFiles(TABS_DIR)).toEqual(['index', 'paskyra', 'rezervacijos']);
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

  it('paspaudus kortelę nenaviguoja į neegzistuojantį ekraną, o parodo pranešimą', async () => {
    jest.mocked(carsApi.fetchCars).mockResolvedValue([makeCar({ automobilio_id: 12 })]);
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => undefined);
    await render(<CarsTab />);
    await waitFor(() => expect(screen.getByTestId('car-card-12')).toBeTruthy());

    expect(screen.getByTestId('car-card-12').props.accessibilityHint).toBe(
      'Parodo pranešimą, kad automobilio informacijos ekranas dar nepasiekiamas',
    );
    await fireEvent.press(screen.getByTestId('car-card-12'));

    expect(alert).toHaveBeenCalledWith('Automobilio informacija', 'Automobilio informacijos ekranas dar nepasiekiamas.', [
      { text: 'Uždaryti' },
    ]);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(fs.existsSync(path.join(APP_DIR, 'automobilis'))).toBe(false);
    alert.mockRestore();
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
