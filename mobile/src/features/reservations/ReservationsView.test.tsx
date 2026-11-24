import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError, toUserMessage } from '@/api/errors';
import * as reservationsApi from '@/api/reservations';
import { CustomerReservation } from '@/api/types';
import { makeReservation } from '@/testUtils/fixtures';
import { ReservationsView } from './ReservationsView';

jest.mock('@/api/reservations');
const fetchReservations = jest.mocked(reservationsApi.fetchReservations);

function deferred<T>() {
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((_, rej) => {
    reject = rej;
  });
  return { promise, reject };
}

const LIST = [
  makeReservation({ rezervacijos_id: 1, etapas: 'pasibaigusi', marke: 'Audi', modelis: 'A4', rezervacijos_pradzia: '2026-09-01', rezervacijos_pabaiga: '2026-09-03' }),
  makeReservation({ rezervacijos_id: 2, etapas: 'patvirtinta' }),
];

beforeEach(() => fetchReservations.mockReset());

describe('ReservationsView', () => {
  it('rodo esamas ir buvusias rezervacijas atskirose grupėse', async () => {
    fetchReservations.mockResolvedValue(LIST);
    await render(<ReservationsView onOpen={jest.fn()} onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Esamos' })).toBeTruthy());
    expect(screen.getByRole('header', { name: 'Buvusios' })).toBeTruthy();
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByText('Audi A4')).toBeTruthy();
  });

  it('kortelė perskaitoma vienu sakiniu su etapu ir kaina', async () => {
    fetchReservations.mockResolvedValue(LIST);
    await render(<ReservationsView onOpen={jest.fn()} onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('reservation-card-2')).toBeTruthy());
    expect(screen.getByTestId('reservation-card-2').props.accessibilityLabel).toBe(
      'Toyota Corolla. gruodžio 1 d. – gruodžio 5 d., 4 paros. Patvirtinta. 228,00 €',
    );
  });

  it('grupės be rezervacijų antraštės nerodo', async () => {
    fetchReservations.mockResolvedValue([LIST[1]]);
    await render(<ReservationsView onOpen={jest.fn()} onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByRole('header', { name: 'Esamos' })).toBeTruthy());
    expect(screen.queryByRole('header', { name: 'Buvusios' })).toBeNull();
  });

  it('paspaudus kortelę atidaro rezervaciją', async () => {
    fetchReservations.mockResolvedValue(LIST);
    const onOpen = jest.fn();
    await render(<ReservationsView onOpen={onOpen} onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('reservation-card-2')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('reservation-card-2'));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ rezervacijos_id: 2 }));
  });

  it('be rezervacijų siūlo ieškoti automobilio', async () => {
    fetchReservations.mockResolvedValue([]);
    const onBrowse = jest.fn();
    await render(<ReservationsView onOpen={jest.fn()} onBrowse={onBrowse} />);
    await waitFor(() => expect(screen.getByText('Rezervacijų dar nėra')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Ieškoti automobilio' }));
    expect(onBrowse).toHaveBeenCalledTimes(1);
  });

  it('be onOpen kortelė nepaspaudžiama ir neturi atidarymo užuominos', async () => {
    fetchReservations.mockResolvedValue(LIST);
    await render(<ReservationsView onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('reservation-card-2')).toBeTruthy());
    const card = screen.getByTestId('reservation-card-2');
    expect(card.props.accessibilityRole).toBeUndefined();
    expect(card.props.accessibilityHint).toBeUndefined();
    expect(card.props.onClick).toBeUndefined();
    expect(card.props.accessibilityLabel).toBe('Toyota Corolla. gruodžio 1 d. – gruodžio 5 d., 4 paros. Patvirtinta. 228,00 €');
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });

  it('nepavykus pull-to-refresh sąrašas lieka, o klaida rodoma', async () => {
    fetchReservations.mockResolvedValueOnce(LIST).mockRejectedValueOnce(new ApiError('network'));
    await render(<ReservationsView onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());

    await act(async () => {
      screen.getByTestId('reservation-list').props.refreshControl.props.onRefresh();
    });
    await waitFor(() =>
      expect(screen.getByTestId('reservations-refresh-error')).toHaveTextContent(toUserMessage(new ApiError('network'))),
    );
    expect(fetchReservations).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByText('Audi A4')).toBeTruthy();
  });

  it('pasikeitus refreshKey sąrašas lieka, o nepavykus atnaujinti klaida rodoma', async () => {
    fetchReservations.mockResolvedValueOnce(LIST);
    const { rerender } = await render(<ReservationsView onBrowse={jest.fn()} refreshKey={1} />);
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());

    const refresh = deferred<CustomerReservation[]>();
    fetchReservations.mockReturnValueOnce(refresh.promise);
    await rerender(<ReservationsView onBrowse={jest.fn()} refreshKey={2} />);
    expect(fetchReservations).toHaveBeenCalledTimes(2);
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();

    await act(async () => {
      refresh.reject(new ApiError('network'));
    });
    expect(screen.getByTestId('reservations-refresh-error')).toHaveTextContent(toUserMessage(new ApiError('network')));
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByText('Audi A4')).toBeTruthy();
  });

  it('klaidos atveju leidžia pakartoti', async () => {
    fetchReservations.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue(LIST);
    await render(<ReservationsView onOpen={jest.fn()} onBrowse={jest.fn()} />);
    await waitFor(() => expect(screen.getByTestId('error-view')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());
  });
});
