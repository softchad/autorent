import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useState } from 'react';
import * as bookingApi from '@/api/booking';
import { ApiError } from '@/api/errors';
import { lt } from '@/i18n/lt';
import { addDays } from '@/utils/isoDate';
import { AvailabilityCalendar, dayLabel, problemMessage } from './AvailabilityCalendar';
import { CalendarDay, EMPTY_SELECTION, Selection } from './calendarLogic';

jest.mock('@/api/booking');
const fetchCalendar = jest.mocked(bookingApi.fetchCalendar);

const RULES = { siandien: '2026-11-26', min_paru: 1, max_paru: 30 };
const BUSY_NIGHTS = new Set(['2026-12-01', '2026-12-02', '2026-12-03', '2026-12-04']);

// Imituoja serverį: grąžina prašomo mėnesio dienas su vienu užimtu laikotarpiu gruodžio 1–5 d.
function serverMonth(_carId: number, year: number, month: number, busyNights: Set<string> = BUSY_NIGHTS) {
  const dienos: CalendarDay[] = [];
  const first = `${year}-${String(month).padStart(2, '0')}-01`;
  for (let day = first; day.slice(5, 7) === first.slice(5, 7); day = addDays(day, 1)) {
    const night = busyNights.has(day);
    const previous = busyNights.has(addDays(day, -1));
    const past = day < RULES.siandien;
    dienos.push({
      data: day,
      busena: past ? 'praeitis' : night && previous ? 'uzimta' : night || previous ? 'dalinai' : 'laisva',
      galima_pradeti: !past && !night,
      galima_baigti: day > RULES.siandien && !previous,
    });
  }
  return Promise.resolve({ automobilio_id: 1, metai: year, menuo: month, siandien: RULES.siandien, dienos });
}

function Harness({ onChange }: { onChange?: (selection: Selection) => void }) {
  const [selection, setSelection] = useState<Selection>(EMPTY_SELECTION);
  return (
    <AvailabilityCalendar
      carId={1}
      rules={RULES}
      selection={selection}
      onChange={(next) => {
        setSelection(next);
        onChange?.(next);
      }}
    />
  );
}

async function openDecember() {
  await waitFor(() => expect(screen.getByTestId('day-2026-11-26')).toBeTruthy());
  await fireEvent.press(screen.getByLabelText('Kitas mėnuo'));
  await waitFor(() => expect(screen.getByTestId('day-2026-12-10')).toBeTruthy());
}

beforeEach(() => {
  fetchCalendar.mockReset();
  fetchCalendar.mockImplementation((carId, year, month) => serverMonth(carId, year, month));
});

describe('AvailabilityCalendar', () => {
  it('rodo šio mėnesio pavadinimą ir užkrauna užimtumą iš serverio', async () => {
    await render(<Harness />);
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2026 m. lapkritis');
    await waitFor(() => expect(screen.getByTestId('day-2026-11-26')).toBeTruthy());
    expect(fetchCalendar).toHaveBeenCalledWith(1, 2026, 11, expect.anything());
  });

  it('į praeities mėnesį grįžti negalima', async () => {
    await render(<Harness />);
    expect(screen.getByLabelText('Ankstesnis mėnuo').props.accessibilityState.disabled).toBe(true);
  });

  it('dienos aprašas ekrano skaitytuvui nurodo būseną', async () => {
    await render(<Harness />);
    await openDecember();
    expect(screen.getByLabelText('gruodžio 2 d., užimta')).toBeTruthy();
    expect(screen.getByLabelText('gruodžio 5 d., iš dalies laisva')).toBeTruthy();
    expect(screen.getByLabelText('gruodžio 10 d., laisva')).toBeTruthy();
  });

  it('pasirenkamas laikotarpis dviem paspaudimais', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await openDecember();
    await fireEvent.press(screen.getByTestId('day-2026-12-10'));
    expect(screen.getByTestId('calendar-message')).toHaveTextContent('Pasirinkite grąžinimo dieną');
    await fireEvent.press(screen.getByTestId('day-2026-12-14'));
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-12-10', to: '2026-12-14' });
    expect(screen.getByLabelText('gruodžio 10 d., laisva, pasirinkta pradžia')).toBeTruthy();
    expect(screen.getByLabelText('gruodžio 12 d., laisva, pasirinktame laikotarpyje')).toBeTruthy();
  });

  it('užimtos dienos pradžiai paspausti negalima', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await openDecember();
    expect(screen.getByTestId('day-2026-12-02').props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(screen.getByTestId('day-2026-12-02'));
    expect(onChange).not.toHaveBeenCalled();
  });

  it('laikotarpis per užimtas dienas atmetamas iškart, su paaiškinimu', async () => {
    const onChange = jest.fn();
    await render(<Harness onChange={onChange} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-11-28')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('day-2026-11-28'));
    await fireEvent.press(screen.getByLabelText('Kitas mėnuo'));
    await waitFor(() => expect(screen.getByTestId('day-2026-12-08')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('day-2026-12-08'));
    expect(screen.getByTestId('calendar-message')).toHaveTextContent('Pasirinktame laikotarpyje yra užimtų dienų.');
    expect(onChange).toHaveBeenLastCalledWith({ from: '2026-11-28', to: null });
  });

  it('nepavykus užkrauti rodo klaidą ir leidžia pakartoti', async () => {
    fetchCalendar.mockReset();
    fetchCalendar
      .mockRejectedValueOnce(new ApiError('network'))
      .mockImplementation((carId, year, month) => serverMonth(carId, year, month));
    await render(<Harness />);
    await waitFor(() => expect(screen.getByText('Užimtumo užkrauti nepavyko.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(screen.getByTestId('day-2026-11-26')).toBeTruthy());
  });
});

describe('AvailabilityCalendar pasenę duomenys', () => {
  const NOVEMBER_BUSY = new Set(['2026-11-28', '2026-11-29']);
  const NO_BUSY = new Set<string>();
  const props = (overrides: Partial<Parameters<typeof AvailabilityCalendar>[0]> = {}) => ({
    carId: 1,
    rules: RULES,
    selection: EMPTY_SELECTION,
    onChange: jest.fn(),
    ...overrides,
  });

  it('pakeitus automobilį seno automobilio dienos nerodomos, kol kraunasi naujos', async () => {
    fetchCalendar.mockImplementation((carId, year, month) =>
      carId === 1 ? serverMonth(carId, year, month) : new Promise(() => {}),
    );
    const view = await render(<AvailabilityCalendar {...props()} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-11-27')).toBeTruthy());

    await view.rerender(<AvailabilityCalendar {...props({ carId: 2 })} />);

    expect(screen.queryByTestId('day-2026-11-27')).toBeNull();
  });

  it('pavėluotas ankstesnio automobilio atsakymas ignoruojamas, net jei abort nepaisomas', async () => {
    let resolveLate: (value: Awaited<ReturnType<typeof serverMonth>>) => void = () => {};
    fetchCalendar.mockImplementation((carId, year, month) =>
      carId === 1 ? new Promise((resolve) => (resolveLate = resolve)) : serverMonth(carId, year, month, NO_BUSY),
    );
    const view = await render(<AvailabilityCalendar {...props()} />);
    await view.rerender(<AvailabilityCalendar {...props({ carId: 2 })} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-11-29')).toBeTruthy());

    await act(async () => resolveLate(await serverMonth(1, 2026, 11, NOVEMBER_BUSY)));

    expect(screen.getByTestId('day-2026-11-29').props.accessibilityLabel).toBe('lapkričio 29 d., laisva');
  });

  it('po refreshKey neperkrauto mėnesio dienos laikotarpio patikrai nebenaudojamos', async () => {
    fetchCalendar.mockImplementation((carId, year, month) => serverMonth(carId, year, month, NO_BUSY));
    const selection = { from: '2026-11-27', to: null };
    const onChange = jest.fn();
    const view = await render(<AvailabilityCalendar {...props({ selection, onChange })} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-11-27')).toBeTruthy());
    await fireEvent.press(screen.getByLabelText('Kitas mėnuo'));
    await waitFor(() => expect(screen.getByTestId('day-2026-12-03')).toBeTruthy());

    await view.rerender(<AvailabilityCalendar {...props({ selection, onChange, refreshKey: 1 })} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-12-03')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('day-2026-12-03'));

    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(lt.calendar.problems.not_loaded);
  });

  it('ties serverio leidžiamu paskutiniu mėnesiu „Kitas mėnuo“ išjungiamas', async () => {
    fetchCalendar.mockImplementation((carId, year, month) => serverMonth(carId, year, month, NO_BUSY));
    await render(<AvailabilityCalendar {...props({ selection: { from: '2028-12-10', to: null } })} />);

    const next = screen.getByLabelText('Kitas mėnuo');
    expect(next.props.accessibilityState.disabled).toBe(true);
    await fireEvent.press(next);
    expect(screen.getByTestId('calendar-title')).toHaveTextContent('2028 m. gruodis');
    expect(fetchCalendar).not.toHaveBeenCalledWith(1, 2029, 1, expect.anything());
  });

  it('atmestos pabaigos paaiškinimas lieka, o pakeitus automobilį ar pasirinkimą išvalomas', async () => {
    fetchCalendar.mockImplementation((carId, year, month) => serverMonth(carId, year, month, NOVEMBER_BUSY));
    const selection = { from: '2026-11-27', to: null };
    const view = await render(<AvailabilityCalendar {...props({ selection })} />);
    await waitFor(() => expect(screen.getByTestId('day-2026-11-30')).toBeTruthy());

    await fireEvent.press(screen.getByTestId('day-2026-11-30'));
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(lt.calendar.problems.busy_inside);

    await view.rerender(<AvailabilityCalendar {...props({ selection: { ...selection } })} />);
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(lt.calendar.problems.busy_inside);

    await view.rerender(<AvailabilityCalendar {...props({ carId: 2, selection: EMPTY_SELECTION })} />);
    expect(screen.getByTestId('calendar-message')).toHaveTextContent(lt.calendar.hintStart);
  });
});

describe('pagalbinės funkcijos', () => {
  it('problemMessage įterpia ilgiausią trukmę', () => {
    expect(problemMessage('too_long', RULES)).toBe('Ilgiausia nuoma – 30 parų.');
    expect(problemMessage('past', RULES)).toBe('Praėjusios dienos pasirinkti negalima.');
  });

  it('dayLabel be vaidmens', () => {
    const day: CalendarDay = { data: '2026-12-24', busena: 'laisva', galima_pradeti: true, galima_baigti: true };
    expect(dayLabel(day, 'none')).toBe('gruodžio 24 d., laisva');
  });
});
