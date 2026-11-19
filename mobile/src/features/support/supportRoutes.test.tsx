import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as supportApi from '@/api/support';
import { Customer, SupportConversationDetail } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import ConversationScreen from '../../app/pokalbis/[id]';
import NewConversationScreen from '../../app/pokalbis/naujas';

// Ekranų elgesys su expo-router ir AuthContext mock'ais. Tai nėra tikros navigacijos ar telefono patikra.
jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => ({ push: jest.fn(), replace: jest.fn(), back: jest.fn(), canGoBack: () => false }),
  useLocalSearchParams: () => ({ id: '31' }),
}));
jest.mock('@/auth/AuthContext');
jest.mock('@/api/support');

const api = jest.mocked(supportApi);
const refreshCustomer = jest.fn<Promise<void>, []>();

const CUSTOMER_A: Customer = {
  kliento_id: 7,
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  registracijos_data: null,
};
const CUSTOMER_B: Customer = { ...CUSTOMER_A, kliento_id: 8, vardas: 'Ona', el_pastas: 'ona@example.com' };

function mockAuth(customer: Customer | null) {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    notice: null,
    customer,
    refreshCustomer,
  } as unknown as ReturnType<typeof useAuth>);
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const DETAIL: SupportConversationDetail = {
  pokalbio_id: 31,
  tema: 'Klausimas',
  kategorija: 'kita',
  busena: 'atvira',
  sukurimo_data: '2026-11-18T09:00:00',
  atnaujinimo_data: '2026-11-18T09:00:00',
  paskutine_zinute: 'Labas',
  paskutine_zinute_autorius: 'klientas',
  neperskaityta: false,
  rezervacija: null,
  sprendimo_santrauka: null,
  zinutes: [{ zinutes_id: 1, autoriaus_tipas: 'klientas', autorius_vardas: null, tekstas: 'Labas', sukurimo_data: '2026-11-18T09:00:00' }],
};

beforeEach(() => {
  refreshCustomer.mockReset().mockResolvedValue(undefined);
  api.fetchConversation.mockReset().mockResolvedValue(DETAIL);
  api.markConversationSeen.mockReset().mockResolvedValue(DETAIL);
});

describe('naujo pokalbio ekranas', () => {
  it('kol kliento ID nežinomas, formos nėra; pavėluotai atėjus profiliui įvestas tekstas išlieka', async () => {
    const profile = deferred();
    refreshCustomer.mockReturnValue(profile.promise);
    mockAuth(null);
    const { rerender } = await render(<NewConversationScreen />);

    expect(screen.getByText('Gaunami paskyros duomenys…')).toBeTruthy();
    expect(screen.queryByTestId('support-subject')).toBeNull();
    expect(screen.queryByTestId('support-message')).toBeNull();

    mockAuth(CUSTOMER_A);
    await act(async () => {
      profile.resolve();
    });
    await rerender(<NewConversationScreen />);
    await fireEvent.changeText(screen.getByTestId('support-subject'), 'Mano tema');
    await fireEvent.changeText(screen.getByTestId('support-message'), 'Mano juodraštis');

    // Vėlesni to paties kliento atnaujinimai formos nemontuoja iš naujo.
    mockAuth({ ...CUSTOMER_A, vardas: 'Jonas Atnaujintas' });
    await rerender(<NewConversationScreen />);
    expect(screen.getByTestId('support-subject').props.value).toBe('Mano tema');
    expect(screen.getByTestId('support-message').props.value).toBe('Mano juodraštis');
  });

  it('nepavykus gauti profilio rodoma klaida su pakartojimu, o ne forma', async () => {
    refreshCustomer.mockRejectedValueOnce(new Error('ryšys'));
    mockAuth(null);
    await render(<NewConversationScreen />);
    await waitFor(() => expect(screen.getByText('Profilio duomenų užkrauti nepavyko.')).toBeTruthy());
    expect(screen.queryByTestId('support-subject')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(refreshCustomer).toHaveBeenCalledTimes(2);
  });

  it('pasikeitus paskyrai A juodraštis nepereina B', async () => {
    mockAuth(CUSTOMER_A);
    const { rerender } = await render(<NewConversationScreen />);
    expect(refreshCustomer).not.toHaveBeenCalled();
    await fireEvent.changeText(screen.getByTestId('support-subject'), 'A tema');
    await fireEvent.changeText(screen.getByTestId('support-message'), 'A juodraštis');

    mockAuth(CUSTOMER_B);
    await rerender(<NewConversationScreen />);
    expect(screen.getByTestId('support-subject').props.value).toBe('');
    expect(screen.getByTestId('support-message').props.value).toBe('');
  });
});

describe('pokalbio ekranas', () => {
  it('kol kliento ID nežinomas, pokalbis ir žinutės laukas nerodomi; atėjus profiliui juodraštis išlieka', async () => {
    const profile = deferred();
    refreshCustomer.mockReturnValue(profile.promise);
    mockAuth(null);
    const { rerender } = await render(<ConversationScreen />);

    expect(screen.getByText('Gaunami paskyros duomenys…')).toBeTruthy();
    expect(screen.queryByTestId('composer-input')).toBeNull();
    expect(api.fetchConversation).not.toHaveBeenCalled();

    mockAuth(CUSTOMER_A);
    await act(async () => {
      profile.resolve();
    });
    await rerender(<ConversationScreen />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'Juodraštis');

    mockAuth({ ...CUSTOMER_A, vardas: 'Jonas Atnaujintas' });
    await rerender(<ConversationScreen />);
    expect(screen.getByTestId('composer-input').props.value).toBe('Juodraštis');
  });

  it('pasikeitus paskyrai A juodraštis nepereina B, o pokalbis užklausiamas iš naujo', async () => {
    mockAuth(CUSTOMER_A);
    const { rerender } = await render(<ConversationScreen />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    await fireEvent.changeText(screen.getByTestId('composer-input'), 'A juodraštis');

    mockAuth(CUSTOMER_B);
    await rerender(<ConversationScreen />);
    await waitFor(() => expect(screen.getByTestId('composer-input')).toBeTruthy());
    expect(screen.getByTestId('composer-input').props.value).toBe('');
    expect(api.fetchConversation).toHaveBeenCalledTimes(2);
  });
});
