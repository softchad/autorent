import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { CarAlternatives, fetchAlternatives } from '@/api/booking';
import { ApiError } from '@/api/errors';
import { makeCar } from '@/testUtils/fixtures';
import { Alternatives } from './Alternatives';

jest.mock('@/api/booking');
const fetch = jest.mocked(fetchAlternatives);
const props = { carId: 12, from: '2026-12-10', to: '2026-12-13', onSelectPeriod: jest.fn(), onSelectCar: jest.fn() };
const result: CarAlternatives = {
  automobilio_id: 12, date_from: props.from, date_to: props.to, laisvas: false,
  artimiausias_laikotarpis: { date_from: '2026-12-13', date_to: '2026-12-16' },
  panasus_automobiliai: [{ automobilis: makeCar({ automobilio_id: 99, marke: 'BMW', modelis: '320' }), balas: 6, priezastys: ['kebulo_tipas', 'pavaru_deze', 'sedimos_vietos'] }],
};

function deferred() {
  let resolve!: (value: CarAlternatives) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<CarAlternatives>((done, fail) => { resolve = done; reject = fail; });
  return { promise, resolve, reject };
}

beforeEach(() => {
  jest.clearAllMocks();
  fetch.mockReset().mockResolvedValue(result);
});

it('shows suggested dates, car price and Lithuanian similarity reasons with working actions', async () => {
  await render(<Alternatives {...props} />);
  await waitFor(() => expect(screen.getByTestId('alternative-period')).toBeTruthy());
  expect(screen.getByText('BMW 320')).toBeTruthy();
  expect(screen.getByText('Toks pats kėbulo tipas, Tokia pati pavarų dėžė, Tiek pat sėdimų vietų')).toBeTruthy();
  expect(screen.getByText('45,00 € už parą')).toBeTruthy();
  await fireEvent.press(screen.getByTestId('alternative-period'));
  expect(props.onSelectPeriod).toHaveBeenCalledWith(result.artimiausias_laikotarpis);
  await fireEvent.press(screen.getByTestId('alternative-car-99'));
  expect(props.onSelectCar).toHaveBeenCalledWith(99);
});

it('shows an empty result without selection actions', async () => {
  fetch.mockResolvedValue({ ...result, artimiausias_laikotarpis: null, panasus_automobiliai: [] });
  await render(<Alternatives {...props} />);
  await waitFor(() => expect(screen.getByTestId('alternatives-empty')).toBeTruthy());
  expect(screen.queryByTestId('alternative-period')).toBeNull();
  expect(screen.queryByTestId('alternative-car-99')).toBeNull();
});

it('retries after an error', async () => {
  fetch.mockRejectedValueOnce(new ApiError('network'));
  await render(<Alternatives {...props} />);
  await waitFor(() => expect(screen.getByRole('alert')).toBeTruthy());
  await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
  await waitFor(() => expect(screen.getByTestId('alternative-period')).toBeTruthy());
  expect(fetch).toHaveBeenCalledTimes(2);
});

it('ignores a late error after the requested dates change', async () => {
  const first = deferred();
  fetch.mockReturnValueOnce(first.promise).mockResolvedValueOnce({ ...result, artimiausias_laikotarpis: null, panasus_automobiliai: [] });
  const view = await render(<Alternatives {...props} />);
  expect(screen.getByRole('progressbar')).toBeTruthy();
  await view.rerender(<Alternatives {...props} from="2026-12-20" to="2026-12-23" />);
  await waitFor(() => expect(screen.getByTestId('alternatives-empty')).toBeTruthy());
  await act(async () => first.reject(new ApiError('network')));
  expect(screen.queryByRole('alert')).toBeNull();
  expect(screen.queryByTestId('alternative-car-99')).toBeNull();
});

it('ignores an old A response after switching A to B to A', async () => {
  const first = deferred();
  const second = deferred();
  fetch.mockReturnValueOnce(first.promise).mockReturnValueOnce(second.promise).mockResolvedValueOnce({ ...result, artimiausias_laikotarpis: null, panasus_automobiliai: [] });
  const view = await render(<Alternatives {...props} />);
  await view.rerender(<Alternatives {...props} carId={13} />);
  await view.rerender(<Alternatives {...props} />);
  await waitFor(() => expect(screen.getByTestId('alternatives-empty')).toBeTruthy());
  await act(async () => { first.resolve(result); second.resolve(result); });
  expect(screen.queryByTestId('alternative-period')).toBeNull();
});

it('cancels requests on unmount', async () => {
  const request = deferred();
  fetch.mockReturnValue(request.promise);
  const view = await render(<Alternatives {...props} />);
  const signal = fetch.mock.calls[0][3];
  await view.unmount();
  expect(signal?.aborted).toBe(true);
  await act(async () => request.resolve(result));
  expect(props.onSelectCar).not.toHaveBeenCalled();
});
