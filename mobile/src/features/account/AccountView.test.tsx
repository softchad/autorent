import { Text } from 'react-native';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as supportApi from '@/api/support';
import { Customer, SupportConversation } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { pressTwiceBeforeCommit } from '@/testUtils/pressTwice';
import AccountTab from '../../app/(tabs)/paskyra';
import { AccountView, initials } from './AccountView';

// Ekrano elgesys su expo-router ir AuthContext mock'ais. Tai nėra tikros navigacijos ar telefono patikra.
jest.mock('expo-router', () => ({
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useFocusEffect: (effect: () => void) => jest.requireActual<typeof import('react')>('react').useEffect(effect, [effect]),
}));
jest.mock('@/auth/AuthContext');
jest.mock('@/api/support');

const signOut = jest.fn<Promise<void>, []>();
const refreshCustomer = jest.fn<Promise<void>, []>();

const CUSTOMER: Customer = {
  kliento_id: 7,
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  registracijos_data: '2026-11-19T10:15:00',
};

const CUSTOMER_B: Customer = {
  ...CUSTOMER,
  kliento_id: 8,
  vardas: 'Ona',
  pavarde: 'Onaitė',
  el_pastas: 'ona@example.com',
};

function mockAuth(customer: Customer | null) {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    notice: null,
    customer,
    signOut,
    refreshCustomer,
  } as unknown as ReturnType<typeof useAuth>);
}

function deferred<T = void>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function conversation(pokalbio_id: number, tema: string): SupportConversation {
  return {
    pokalbio_id,
    tema,
    kategorija: 'kita',
    busena: 'atvira',
    sukurimo_data: '2026-11-18T09:00:00',
    atnaujinimo_data: '2026-11-18T09:00:00',
    paskutine_zinute: null,
    paskutine_zinute_autorius: 'klientas',
    neperskaityta: false,
    rezervacija: null,
    sprendimo_santrauka: null,
  };
}

beforeEach(() => {
  signOut.mockReset().mockResolvedValue(undefined);
  refreshCustomer.mockReset().mockResolvedValue(undefined);
  jest.mocked(supportApi.fetchConversations).mockReset().mockResolvedValue([]);
});

describe('initials', () => {
  it('pirmosios vardo ir pavardės raidės', () => {
    expect(initials('jonas', ' Jonaitis')).toBe('JJ');
    expect(initials('Šarūnas', '')).toBe('Š');
  });
});

describe('AccountView', () => {
  it('rodo antraštę „Mano paskyra“, pasisveikinimą ir kliento duomenis', async () => {
    mockAuth(CUSTOMER);
    await render(<AccountView />);
    expect(screen.getByRole('header', { name: 'Mano paskyra' })).toBeTruthy();
    expect(screen.getByText('Sveiki, Jonas')).toBeTruthy();
    expect(screen.getByText('Jonas Jonaitis')).toBeTruthy();
    expect(screen.getByText('jonas@example.com')).toBeTruthy();
    expect(screen.getByText('2026 m. lapkričio 19 d.')).toBeTruthy();
    expect(refreshCustomer).not.toHaveBeenCalled();
  });

  it('gimimo datos nerodo (jos ekrane nereikia)', async () => {
    mockAuth(CUSTOMER);
    await render(<AccountView />);
    expect(screen.queryByText(/1995/)).toBeNull();
  });

  it('be papildomų skirtukų skirtukų juosta nerodoma', async () => {
    mockAuth(CUSTOMER);
    await render(<AccountView />);
    expect(screen.queryByTestId('account-tab-profile')).toBeNull();
  });

  it('skirtukas „Pašto dėžutė“ parodo pokalbius iš pagalbos API', async () => {
    mockAuth(CUSTOMER);
    const onNew = jest.fn();
    await render(<AccountView onOpenConversation={jest.fn()} onNewConversation={onNew} />);
    expect(supportApi.fetchConversations).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByRole('button', { name: 'Pašto dėžutė' }));
    await waitFor(() => expect(screen.getByText('Žinučių dar nėra')).toBeTruthy());
    expect(screen.getByTestId('account-tab-inbox').props.accessibilityState).toEqual({ selected: true });
    expect(screen.queryByTestId('account-profile')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Nauja žinutė' }));
    expect(onNew).toHaveBeenCalledTimes(1);
  });
});

describe('AccountView – profilis be customer', () => {
  it('kol profilis kraunamas, rodomas krovimas, o ne klaida', async () => {
    const pending = deferred();
    refreshCustomer.mockReturnValue(pending.promise);
    mockAuth(null);
    await render(<AccountView />);
    expect(refreshCustomer).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    expect(screen.queryByTestId('error-view')).toBeNull();
    await act(async () => {
      pending.resolve();
    });
  });

  it('nepavykus rodo lietuvišką klaidą; pakartojus vėl kraunama, o atsijungti galima', async () => {
    refreshCustomer.mockRejectedValueOnce(new Error('ryšys'));
    mockAuth(null);
    await render(<AccountView />);
    await waitFor(() => expect(screen.getByText('Profilio duomenų užkrauti nepavyko.')).toBeTruthy());
    expect(screen.getByRole('button', { name: 'Atsijungti' })).toBeTruthy();

    const retry = deferred();
    refreshCustomer.mockReturnValueOnce(retry.promise);
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(refreshCustomer).toHaveBeenCalledTimes(2);
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    await act(async () => {
      retry.resolve();
    });
  });

  it('dvigubas „Bandyti dar kartą“ siunčia vieną profilio užklausą', async () => {
    refreshCustomer.mockRejectedValueOnce(new Error('ryšys'));
    mockAuth(null);
    await render(<AccountView />);
    await waitFor(() => expect(screen.getByTestId('retry-button')).toBeTruthy());

    const retry = deferred();
    refreshCustomer.mockReturnValueOnce(retry.promise);
    await pressTwiceBeforeCommit('retry-button');
    expect(refreshCustomer).toHaveBeenCalledTimes(2);
    await act(async () => {
      retry.resolve();
    });
  });
});

describe('AccountView – atsijungimas', () => {
  it('atsijungimo mygtukas kviečia signOut', async () => {
    mockAuth(CUSTOMER);
    await render(<AccountView />);
    await fireEvent.press(screen.getByRole('button', { name: 'Atsijungti' }));
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId('account-logout-error')).toBeNull();
  });

  it('kol atsijungiama, mygtukas užimtas, o dvigubas paspaudimas signOut kviečia vieną kartą', async () => {
    const pending = deferred();
    signOut.mockReturnValue(pending.promise);
    mockAuth(CUSTOMER);
    await render(<AccountView />);

    await pressTwiceBeforeCommit('account-logout');
    expect(signOut).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('account-logout')).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });
  });

  it('nepavykęs atsijungimas rodomas kaip klaida, ne kaip sėkmė, ir leidžia bandyti dar kartą', async () => {
    signOut.mockRejectedValueOnce(new Error('Nepavyko ištrinti'));
    mockAuth(CUSTOMER);
    await render(<AccountView />);

    await fireEvent.press(screen.getByRole('button', { name: 'Atsijungti' }));
    await waitFor(() => expect(screen.getByTestId('account-logout-error')).toHaveTextContent('Atsijungti nepavyko. Bandykite dar kartą.'));
    // Profilis lieka – sesija nepakeista.
    expect(screen.getByTestId('account-profile')).toBeTruthy();
    expect(screen.getByTestId('account-logout')).not.toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: 'Atsijungti' }));
    expect(signOut).toHaveBeenCalledTimes(2);
    await waitFor(() => expect(screen.queryByTestId('account-logout-error')).toBeNull());
  });
});

describe('paskyros skirtukas – kliento tapatybė', () => {
  it('pasikeitus klientui A pokalbiai B nerodomi, net jei A atsakymas ateina vėliau', async () => {
    const lateA = deferred<SupportConversation[]>();
    jest.mocked(supportApi.fetchConversations).mockReturnValueOnce(lateA.promise);
    mockAuth(CUSTOMER);
    const { rerender } = await render(<AccountTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pašto dėžutė' }));
    expect(screen.getByTestId('loading-view')).toBeTruthy();

    // Kitas klientas (pvz. prisijungus kita paskyra) – turinys montuojamas iš naujo.
    jest.mocked(supportApi.fetchConversations).mockResolvedValueOnce([conversation(80, 'B pokalbis')]);
    mockAuth(CUSTOMER_B);
    await rerender(<AccountTab />);
    expect(screen.getByText('ona@example.com')).toBeTruthy();
    expect(screen.queryByText('jonas@example.com')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Pašto dėžutė' }));
    await waitFor(() => expect(screen.getByText('B pokalbis')).toBeTruthy());

    await act(async () => {
      lateA.resolve([conversation(70, 'A pokalbis')]);
    });
    expect(screen.queryByText('A pokalbis')).toBeNull();
    expect(screen.getByText('B pokalbis')).toBeTruthy();
  });

  it('A sąrašas nelieka rodomas B paskyrai', async () => {
    jest.mocked(supportApi.fetchConversations).mockResolvedValueOnce([conversation(70, 'A pokalbis')]);
    mockAuth(CUSTOMER);
    const { rerender } = await render(<AccountTab />);
    await fireEvent.press(screen.getByRole('button', { name: 'Pašto dėžutė' }));
    await waitFor(() => expect(screen.getByText('A pokalbis')).toBeTruthy());

    mockAuth(CUSTOMER_B);
    await rerender(<AccountTab />);
    expect(screen.queryByText('A pokalbis')).toBeNull();
  });

  it('atkurta sesija be profilio: kol profilis kraunamas – krovimas, atėjus – kliento duomenys', async () => {
    const pending = deferred();
    refreshCustomer.mockReturnValue(pending.promise);
    mockAuth(null);
    const { rerender } = await render(<AccountTab />);
    expect(screen.getByTestId('loading-view')).toBeTruthy();

    mockAuth(CUSTOMER);
    await act(async () => {
      pending.resolve();
    });
    await rerender(<AccountTab />);
    expect(screen.getByText('jonas@example.com')).toBeTruthy();
    expect(screen.queryByTestId('error-view')).toBeNull();
  });
});

  it('skirtukas „Rezervacijos“ rodo ekrano perduotą sąrašą', async () => {
    mockAuth(CUSTOMER);
    await render(<AccountView reservations={<Text>Rezervacijų sąrašas</Text>} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rezervacijos' }));
    expect(screen.getByText('Rezervacijų sąrašas')).toBeTruthy();
  });
