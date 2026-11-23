import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as bookingApi from '@/api/booking';
import { makeCar } from '@/testUtils/fixtures';
import { ApiError } from '@/api/errors';
import { addDays, diffDays } from '@/utils/isoDate';
import { BookingView } from './BookingView';
import { CalendarDay } from './calendarLogic';
import { QUOTE_DEBOUNCE_MS } from './usePriceQuote';

jest.mock('@/api/booking');
const api = jest.mocked(bookingApi);

const RULES = { siandien: '2026-11-28', min_paru: 1, max_paru: 30, grazinimas_iki_val: 10, paemimas_nuo_val: 12, paemimas_iki_val: 18 };
const EXTRAS = [
  {
    kodas: 'pilna_apsauga',
    pavadinimas: 'Pilna apsauga',
    aprasymas: 'Papildomos apsaugos paslauga. Sąlygos nurodomos nuomos sutartyje.',
    kaina_parai: 12,
  },
];

function freeMonth(_carId: number, year: number, month: number) {
  const dienos: CalendarDay[] = [];
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  for (let day = first; day.slice(5, 7) === first.slice(5, 7); day = addDays(day, 1)) {
    const past = day < RULES.siandien;
    dienos.push({ data: day, busena: past ? 'praeitis' : 'laisva', galima_pradeti: !past, galima_baigti: day > RULES.siandien });
  }
  return Promise.resolve({ automobilio_id: 12, metai: year, menuo: month, siandien: RULES.siandien, dienos });
}

// Atsakymas atitinka užklausą: tas pats automobilis, datos, parų skaičius ir paslaugos.
function quoteFor(input: { carId: number; from: string; to: string; extras: string[] }, laisvas = true) {
  const days = diffDays(input.from, input.to);
  const lines = input.extras.map((kodas) => ({ kodas, pavadinimas: 'Pilna apsauga', kaina_parai: 12, suma: 12 * days }));
  const extrasTotal = lines.reduce((sum, line) => sum + line.suma, 0);
  return Promise.resolve({
    automobilio_id: input.carId, date_from: input.from, date_to: input.to, paru_skaicius: days, kaina_parai: 45,
    nuomos_suma: 45 * days, paslaugos: lines, paslaugu_suma: extrasTotal, viso: 45 * days + extrasTotal, laisvas,
  });
}

async function selectPeriod() {
  await waitFor(() => expect(screen.getByTestId('day-2026-11-28')).toBeTruthy());
  await fireEvent.press(screen.getByTestId('day-2026-11-28'));
  await fireEvent.press(screen.getByTestId('day-2026-11-30'));
  await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
}

beforeEach(() => {
  jest.useFakeTimers();
  api.fetchCalendar.mockReset().mockImplementation(freeMonth);
  api.fetchQuote.mockReset().mockImplementation((input) => quoteFor(input));
});
afterEach(() => jest.useRealTimers());

describe('BookingView', () => {
  it('pasirinkus laikotarpį parodo kainą ir praneša, kad galima tęsti', async () => {
    const onDraftChange = jest.fn();
    await render(<BookingView car={makeCar()} rules={RULES} extras={EXTRAS} onDraftChange={onDraftChange} />);
    expect(onDraftChange).toHaveBeenLastCalledWith(null, false);

    await selectPeriod();

    expect(screen.getByTestId('selected-period')).toHaveTextContent('Pasirinkta: lapkričio 28 d. – lapkričio 30 d. (2 paros)');
    expect(screen.getByLabelText('Iš viso: 90,00 €')).toBeTruthy();
    expect(onDraftChange).toHaveBeenLastCalledWith(
      { carId: 12, from: '2026-11-28', to: '2026-11-30', pickupHour: 12, extras: [] },
      true,
    );
  });

  it('pažymėjus paslaugą kaina perskaičiuojama serveryje', async () => {
    const onDraftChange = jest.fn();
    await render(<BookingView car={makeCar()} rules={RULES} extras={EXTRAS} onDraftChange={onDraftChange} />);
    await selectPeriod();

    await fireEvent.press(screen.getByRole('checkbox', { name: /Pilna apsauga/ }));
    // Kol nauja kaina neatėjo, tęsti negalima ir sena suma nerodoma.
    expect(onDraftChange.mock.calls.at(-1)?.[1]).toBe(false);
    expect(screen.queryByLabelText('Iš viso: 90,00 €')).toBeNull();

    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));
    expect(screen.getByLabelText('Iš viso: 114,00 €')).toBeTruthy();
    expect(screen.getByTestId('price-change')).toHaveTextContent('Kaina padidėjo 24,00 €');
    expect(api.fetchQuote.mock.calls.at(-1)?.[0]).toMatchObject({ extras: ['pilna_apsauga'] });
  });

  it('paėmimo valanda patenka į juodraštį', async () => {
    const onDraftChange = jest.fn();
    await render(<BookingView car={makeCar()} rules={RULES} extras={[]} onDraftChange={onDraftChange} />);
    await selectPeriod();
    await fireEvent.press(screen.getByRole('button', { name: '15:00' }));
    expect(onDraftChange.mock.calls.at(-1)?.[0]).toMatchObject({ pickupHour: 15 });
  });

  it('jei serveris sako, kad automobilis užimtas – tęsti negalima', async () => {
    api.fetchQuote.mockImplementation((input) => quoteFor(input, false));
    const onDraftChange = jest.fn();
    await render(<BookingView car={makeCar()} rules={RULES} extras={[]} onDraftChange={onDraftChange} />);
    await selectPeriod();
    expect(screen.getByTestId('not-free')).toBeTruthy();
    expect(onDraftChange.mock.calls.at(-1)?.[1]).toBe(false);
  });

  it('nepavykus gauti kainos ją galima pakartoti, pasirinkimų ir kalendoriaus nekeičiant', async () => {
    api.fetchQuote.mockRejectedValueOnce(new ApiError('network'));
    const onDraftChange = jest.fn();
    await render(<BookingView car={makeCar()} rules={RULES} extras={EXTRAS} onDraftChange={onDraftChange} />);
    await selectPeriod();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(onDraftChange.mock.calls.at(-1)?.[1]).toBe(false);
    const calendarCalls = api.fetchCalendar.mock.calls.length;

    await fireEvent.press(screen.getByTestId('price-retry'));
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));

    expect(api.fetchQuote).toHaveBeenCalledTimes(2);
    expect(api.fetchQuote.mock.calls[1][0]).toEqual({ carId: 12, from: '2026-11-28', to: '2026-11-30', extras: [] });
    expect(screen.getByLabelText('Iš viso: 90,00 €')).toBeTruthy();
    expect(screen.queryByTestId('price-retry')).toBeNull();
    expect(screen.getByTestId('selected-period')).toHaveTextContent('Pasirinkta: lapkričio 28 d. – lapkričio 30 d. (2 paros)');
    expect(api.fetchCalendar).toHaveBeenCalledTimes(calendarCalls);
    expect(onDraftChange.mock.calls.at(-1)?.[1]).toBe(true);
  });

  it('pasikeitus refreshKey perkraunama ir kaina, ir kalendorius', async () => {
    const props = { car: makeCar(), rules: RULES, extras: EXTRAS, onDraftChange: jest.fn() };
    const view = await render(<BookingView {...props} />);
    await selectPeriod();
    expect(api.fetchQuote).toHaveBeenCalledTimes(1);
    const calendarCalls = api.fetchCalendar.mock.calls.length;

    await view.rerender(<BookingView {...props} refreshKey={1} />);
    await act(async () => jest.advanceTimersByTime(QUOTE_DEBOUNCE_MS));

    expect(api.fetchQuote).toHaveBeenCalledTimes(2);
    expect(api.fetchCalendar.mock.calls.length).toBeGreaterThan(calendarCalls);
    expect(screen.getByTestId('selected-period')).toHaveTextContent('Pasirinkta: lapkričio 28 d. – lapkričio 30 d. (2 paros)');
    expect(screen.getByLabelText('Iš viso: 90,00 €')).toBeTruthy();
  });
});
