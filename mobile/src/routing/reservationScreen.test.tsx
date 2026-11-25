import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { fetchReservation } from '@/api/reservations';
import { CustomerReservation } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { makeReservation } from '@/testUtils/fixtures';
import ReservationScreen from '../app/rezervacija/[id]';

let mockParams: { id?: string | string[] } = { id: '501' };
const mockRouter = { push: jest.fn() };
let mockRefocus: (() => void) | undefined;

jest.mock('expo-router', () => {
  const { useEffect } = jest.requireActual('react');
  return {
    Stack: { Screen: () => null },
    useLocalSearchParams: () => mockParams,
    useRouter: () => mockRouter,
    useFocusEffect: (effect: () => void) => {
      mockRefocus = effect;
      useEffect(effect, [effect]);
    },
  };
});
jest.mock('@/api/reservations');
jest.mock('@/auth/AuthContext');

const fetchDetail = jest.mocked(fetchReservation);
function setCustomer(id: number | null) {
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn', customer: id === null ? null : { kliento_id: id },
    notice: null, refreshCustomer: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useAuth>);
}
function deferred() {
  let resolve!: (value: CustomerReservation) => void;
  const promise = new Promise<CustomerReservation>((done) => { resolve = done; });
  return { promise, resolve };
}

beforeEach(() => {
  mockParams = { id: '501' };
  mockRouter.push.mockReset();
  mockRefocus = undefined;
  fetchDetail.mockReset().mockResolvedValue(makeReservation());
  setCustomer(7);
});

describe('rezervacijos ekranas', () => {
  it.each(['signedOut', 'loading'] as const)('%s būsenoje rezervacijos nekrauna', async (status) => {
    jest.mocked(useAuth).mockReturnValue({ status, notice: null } as ReturnType<typeof useAuth>);
    await render(<ReservationScreen />);
    expect(fetchDetail).not.toHaveBeenCalled();
    expect(screen.queryByTestId('reservation-detail')).toBeNull();
    expect(screen.getByTestId(status === 'signedOut' ? 'require-auth' : 'loading-view')).toBeTruthy();
  });

  it('be kliento profilio detalės užklausos nesiunčia', async () => {
    setCustomer(null);
    await render(<ReservationScreen />);
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it.each([undefined, '0', '-1', 'abc', '1.5', '9007199254740992', ['501', '502']])('netinkamam ID %s API nekviečia', async (id) => {
    mockParams = { id };
    await render(<ReservationScreen />);
    expect(screen.getByText('Neteisingas rezervacijos numeris.')).toBeTruthy();
    expect(fetchDetail).not.toHaveBeenCalled();
  });

  it('rodo krovimą, tada tikrą detalę, o GET gauna signalą', async () => {
    const pending = deferred();
    fetchDetail.mockReturnValueOnce(pending.promise);
    await render(<ReservationScreen />);
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    expect(fetchDetail).toHaveBeenCalledWith(501, expect.any(AbortSignal));
    await act(async () => pending.resolve(makeReservation()));
    expect(screen.getByTestId('reservation-detail')).toBeTruthy();
    expect(fetchDetail).toHaveBeenCalledTimes(1);
  });

  it('404 rodo klaidą ir leidžia pakartoti', async () => {
    fetchDetail.mockRejectedValueOnce(new ApiError('not_found', 404));
    await render(<ReservationScreen />);
    await fireEvent.press(await screen.findByRole('button', { name: 'Bandyti dar kartą' }));
    expect(await screen.findByTestId('reservation-detail')).toBeTruthy();
    expect(fetchDetail).toHaveBeenCalledTimes(2);
  });

  it('grįžus atnaujina, o atnaujinimo klaida nepaslepia jau rodomos rezervacijos', async () => {
    await render(<ReservationScreen />);
    await screen.findByTestId('reservation-detail');
    fetchDetail.mockRejectedValueOnce(new ApiError('network'));
    await act(async () => mockRefocus?.());
    await screen.findByRole('alert');
    expect(screen.getByTestId('reservation-detail')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(screen.queryByRole('alert')).toBeNull());
    expect(fetchDetail).toHaveBeenCalledTimes(3);
  });

  it('pakeitus ID pavėluota ankstesnė detalė neparodoma', async () => {
    const pending = deferred();
    fetchDetail.mockReturnValueOnce(pending.promise);
    const view = await render(<ReservationScreen />);
    const oldSignal = fetchDetail.mock.calls[0][1];
    mockParams = { id: '502' };
    fetchDetail.mockResolvedValue(makeReservation({ rezervacijos_id: 502, marke: 'Audi' }));
    await view.rerender(<ReservationScreen />);
    await screen.findByRole('header', { name: 'Audi Corolla' });
    await act(async () => pending.resolve(makeReservation()));
    expect(screen.queryByRole('header', { name: 'Toyota Corolla' })).toBeNull();
    expect(oldSignal?.aborted).toBe(true);
  });

  it('pakeitus klientą sena detalė iškart pašalinama ir pavėluotas atsakymas ignoruojamas', async () => {
    const pending = deferred();
    const view = await render(<ReservationScreen />);
    await screen.findByRole('header', { name: 'Toyota Corolla' });
    fetchDetail.mockReturnValueOnce(pending.promise);
    setCustomer(8);
    await view.rerender(<ReservationScreen />);
    expect(screen.queryByTestId('reservation-detail')).toBeNull();
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    jest.mocked(useAuth).mockReturnValue({ status: 'signedOut', notice: null } as ReturnType<typeof useAuth>);
    await view.rerender(<ReservationScreen />);
    await act(async () => pending.resolve(makeReservation()));
    expect(screen.queryByTestId('reservation-detail')).toBeNull();
    expect(screen.getByTestId('require-auth')).toBeTruthy();
  });
});
