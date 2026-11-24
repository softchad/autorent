import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeReservation } from '@/testUtils/fixtures';
import { BookingSuccess } from './BookingSuccess';

// Tokios formos atsakymą grąžina patvirtinimo endpointas.
const RESERVATION = makeReservation();

describe('BookingSuccess', () => {
  it('rodo sėkmės antraštę ir tikrus sukurtos rezervacijos duomenis', async () => {
    await render(<BookingSuccess reservation={RESERVATION} onShowAll={jest.fn()} />);
    expect(screen.getByRole('header', { name: 'Rezervacija sukurta' })).toBeTruthy();
    expect(screen.getByText('Rezervacija Nr. 501')).toBeTruthy();
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByLabelText('Laikotarpis: gruodžio 1 d. – gruodžio 5 d.')).toBeTruthy();
    expect(screen.getByLabelText('Trukmė: 4 paros')).toBeTruthy();
    expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();
  });

  it('pasako, kas bus toliau (rezervaciją dar turi patvirtinti darbuotojas)', async () => {
    await render(<BookingSuccess reservation={RESERVATION} onShowAll={jest.fn()} />);
    expect(screen.getByText('Rezervacija sukurta. Apie patvirtinimą praneš darbuotojas.')).toBeTruthy();
  });

  it('veda į rezervacijų sąrašą, o jei perduota – ir į pačią rezervaciją', async () => {
    const onShowAll = jest.fn();
    const onOpen = jest.fn();
    const view = await render(<BookingSuccess reservation={RESERVATION} onShowAll={onShowAll} />);
    expect(screen.queryByTestId('success-open')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Mano rezervacijos' }));
    expect(onShowAll).toHaveBeenCalledTimes(1);

    await view.rerender(<BookingSuccess reservation={RESERVATION} onShowAll={onShowAll} onOpen={onOpen} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Peržiūrėti rezervaciją' }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });
});
