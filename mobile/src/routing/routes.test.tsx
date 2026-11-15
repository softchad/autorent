import { render, screen } from '@testing-library/react-native';
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

jest.mock('expo-router', () => {
  const { Text } = jest.requireActual('react-native');
  return {
    Redirect: ({ href }: { href: string }) => <Text testID="redirect">{href}</Text>,
    Stack: { Screen: () => null },
    useRouter: () => ({ push: jest.fn() }),
  };
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

describe('automobilių skirtukas', () => {
  it('kūrimo režime turi nuorodą į peržiūrą', async () => {
    devFlag.__DEV__ = true;
    await render(<CarsTab />);

    expect(screen.getByTestId('open-preview')).toBeTruthy();
  });

  it('išleidimo režime nuorodos į peržiūrą neturi', async () => {
    devFlag.__DEV__ = false;
    await render(<CarsTab />);

    expect(screen.getByTestId('screen-cars')).toBeTruthy();
    expect(screen.queryByTestId('open-preview')).toBeNull();
  });
});
