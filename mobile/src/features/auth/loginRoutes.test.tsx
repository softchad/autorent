import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/auth/AuthContext';
import AccountTab from '../../app/(tabs)/paskyra';
import LoginScreen from '../../app/prisijungimas';

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
}));
jest.mock('@/auth/AuthContext');

const mockedUseAuth = jest.mocked(useAuth);
const signIn = jest.fn<Promise<void>, [string, string]>();

function mockAuth(status: 'loading' | 'signedOut' | 'signedIn') {
  mockedUseAuth.mockReturnValue({ status, signIn, notice: null } as unknown as ReturnType<typeof useAuth>);
}

beforeEach(() => {
  jest.clearAllMocks();
  mockParams = {};
  signIn.mockResolvedValue(undefined);
  mockAuth('signedOut');
});

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

  it('registracijos maršruto nėra, todėl ekranas registracijos nuorodos nerodo', async () => {
    expect(fs.existsSync(path.join(APP_DIR, 'registracija.tsx'))).toBe(false);

    await render(<LoginScreen />);

    expect(screen.getByTestId('screen-login')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Registruotis' })).toBeNull();
  });
});

describe('paskyros skirtukas', () => {
  it('neprisijungusiam rodo „Prisijungti“, kuri atidaro /prisijungimas', async () => {
    await render(<AccountTab />);

    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
    expect(mockRouter.push).toHaveBeenCalledWith('/prisijungimas');
  });

  it.each(['signedIn', 'loading'] as const)('būsenoje %s nuorodos nerodo', async (status) => {
    mockAuth(status);
    await render(<AccountTab />);

    expect(screen.getByTestId('screen-account')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Prisijungti' })).toBeNull();
  });
});
