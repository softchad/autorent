import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/auth/AuthContext';
import AccountTab from '../../app/(tabs)/paskyra';
import LoginScreen from '../../app/prisijungimas';
import RegisterScreen from '../../app/registracija';

// Ekranų ir maršrutų elgesys su expo-router mock'u. Tai nėra tikros navigacijos ar telefono patikra.
declare const __dirname: string;
type FsModule = { existsSync(target: string): boolean };
type PathModule = { join(...parts: string[]): string; resolve(...parts: string[]): string };
const fs = jest.requireActual<FsModule>('fs');
const path = jest.requireActual<PathModule>('path');
const APP_DIR = path.resolve(__dirname, '..', '..', 'app');

const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn() };
let mockParams: Record<string, string> = {};

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
  // Fokusas imituojamas vieną kartą sumontavus ekraną.
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/auth/AuthContext');

const mockedUseAuth = jest.mocked(useAuth);
const signIn = jest.fn<Promise<void>, [string, string]>();
const signUp = jest.fn<Promise<void>, [unknown]>();
const signOut = jest.fn<Promise<void>, []>();
const refreshCustomer = jest.fn<Promise<void>, []>();

function mockAuth(status: 'loading' | 'signedOut' | 'signedIn') {
  mockedUseAuth.mockReturnValue({
    status,
    signIn,
    signUp,
    signOut,
    refreshCustomer,
    customer: null,
    notice: null,
  } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  signIn.mockResolvedValue(undefined);
  signUp.mockResolvedValue(undefined);
  signOut.mockResolvedValue(undefined);
  refreshCustomer.mockResolvedValue(undefined);
  mockAuth('signedOut');
  // Užfiksuojama tik data (registracijos amžiaus patikrai); laikmačiai lieka tikri.
  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
    now: new Date('2026-11-18T12:00:00Z'),
  });
});

afterEach(() => {
  jest.useRealTimers();
});

async function signUpThroughScreen() {
  await render(<RegisterScreen />);
  const values: [string, string][] = [
    ['Vardas', 'Jonas'],
    ['Pavardė', 'Jonaitis'],
    ['El. paštas', 'jonas@example.com'],
    ['Telefono numeris', '+37061234567'],
    ['Gimimo data', '1995-04-17'],
    ['Slaptažodis', 'Slaptas123!'],
    ['Pakartokite slaptažodį', 'Slaptas123!'],
  ];
  for (const [label, value] of values) {
    await fireEvent.changeText(screen.getByLabelText(label), value);
  }
  await fireEvent.press(screen.getByRole('button', { name: 'Sukurti paskyrą' }));
  await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
}

async function signInThroughScreen() {
  await render(<LoginScreen />);
  await fireEvent.changeText(screen.getByLabelText('El. paštas'), 'jonas@example.com');
  await fireEvent.changeText(screen.getByLabelText('Slaptažodis'), 'Slaptas123!');
  await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
  await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
}

describe('prisijungimo ekranas', () => {
  it('su griztiAtgal=1 ir galimu grįžimu – grįžta atgal', async () => {
    mockParams = { griztiAtgal: '1' };
    mockRouter.canGoBack.mockReturnValue(true);

    await signInThroughScreen();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('su griztiAtgal=1, bet negalint grįžti – nukreipia į /', async () => {
    mockParams = { griztiAtgal: '1' };
    mockRouter.canGoBack.mockReturnValue(false);

    await signInThroughScreen();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('be griztiAtgal – nukreipia į /, net jei grįžti galima', async () => {
    mockRouter.canGoBack.mockReturnValue(true);

    await signInThroughScreen();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('registracijos maršrutas egzistuoja, o „Registruotis“ jį atidaro pakeisdama ekraną (istorija neauga)', async () => {
    expect(fs.existsSync(path.join(APP_DIR, 'registracija.tsx'))).toBe(true);

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Registruotis' }));

    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/registracija', params: {} });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('„Registruotis“ perduoda tik griztiAtgal, ne kitus parametrus', async () => {
    mockParams = { griztiAtgal: '1', kita: 'x' };

    await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Registruotis' }));

    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/registracija', params: { griztiAtgal: '1' } });
  });
});

describe('registracijos ekranas', () => {
  it('su griztiAtgal=1 ir galimu grįžimu – po registracijos grįžta atgal', async () => {
    mockParams = { griztiAtgal: '1' };
    mockRouter.canGoBack.mockReturnValue(true);

    await signUpThroughScreen();

    await waitFor(() => expect(mockRouter.back).toHaveBeenCalledTimes(1));
    expect(mockRouter.replace).not.toHaveBeenCalled();
  });

  it('atidarytas tiesiogiai be istorijos (griztiAtgal=1, grįžti negalima) – nukreipia į /', async () => {
    mockParams = { griztiAtgal: '1' };
    mockRouter.canGoBack.mockReturnValue(false);

    await signUpThroughScreen();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it('be griztiAtgal – nukreipia į /, net jei grįžti galima', async () => {
    mockRouter.canGoBack.mockReturnValue(true);

    await signUpThroughScreen();

    await waitFor(() => expect(mockRouter.replace).toHaveBeenCalledWith('/'));
    expect(mockRouter.back).not.toHaveBeenCalled();
  });

  it.each([
    [{}, {}],
    [{ griztiAtgal: '1' }, { griztiAtgal: '1' }],
    [{ griztiAtgal: '1', kita: 'x' }, { griztiAtgal: '1' }],
  ])('„Prisijungti“ (parametrai %p) pakeičia ekraną į /prisijungimas su %p', async (given, expected) => {
    mockParams = given;

    await render(<RegisterScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));

    expect(mockRouter.replace).toHaveBeenCalledWith({ pathname: '/prisijungimas', params: expected });
    expect(mockRouter.push).not.toHaveBeenCalled();
  });

  it('perjungimas prisijungimas → registracija → prisijungimas naudoja tik replace ir išlaiko griztiAtgal', async () => {
    mockParams = { griztiAtgal: '1' };
    const login = await render(<LoginScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Registruotis' }));
    await login.unmount();

    mockParams = mockRouter.replace.mock.calls[0][0].params;
    const register = await render(<RegisterScreen />);
    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
    await register.unmount();

    expect(mockRouter.replace.mock.calls).toEqual([
      [{ pathname: '/registracija', params: { griztiAtgal: '1' } }],
      [{ pathname: '/prisijungimas', params: { griztiAtgal: '1' } }],
    ]);
    expect(mockRouter.push).not.toHaveBeenCalled();
    expect(mockRouter.back).not.toHaveBeenCalled();
  });
});

describe('paskyros skirtukas', () => {
  it('neprisijungusiam „Prisijungti“ atidaro /prisijungimas su griztiAtgal', async () => {
    await render(<AccountTab />);

    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/prisijungimas', params: { griztiAtgal: '1' } });
  });

  it('neprisijungusiam „Registruotis“ atidaro /registracija su griztiAtgal', async () => {
    await render(<AccountTab />);

    await fireEvent.press(screen.getByRole('button', { name: 'Registruotis' }));
    expect(mockRouter.push).toHaveBeenCalledWith({ pathname: '/registracija', params: { griztiAtgal: '1' } });
  });

  it.each(['signedIn', 'loading'] as const)('būsenoje %s nuorodos nerodo', async (status) => {
    mockAuth(status);
    await render(<AccountTab />);

    expect(screen.getByTestId('screen-account')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Prisijungti' })).toBeNull();
  });
});
