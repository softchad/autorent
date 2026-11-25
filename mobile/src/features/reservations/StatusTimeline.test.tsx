import { fireEvent, render, screen } from '@testing-library/react-native';
import { makeReservation } from '@/testUtils/fixtures';
import { ReservationDetailView } from './ReservationDetailView';
import { StatusTimeline } from './StatusTimeline';
import { buildTimeline } from './timeline';

describe('StatusTimeline', () => {
  it('žingsniai turi prieinamumo etiketes su būsena', async () => {
    await render(<StatusTimeline steps={buildTimeline(makeReservation({ etapas: 'patvirtinta' }))} />);
    expect(screen.getByLabelText('Rezervacija sukurta, atlikta')).toBeTruthy();
    expect(screen.getByLabelText('Patvirtinta, atlikta')).toBeTruthy();
    expect(screen.getByLabelText('Paėmimas: gruodžio 1 d., 14:00, dabar')).toBeTruthy();
    expect(screen.getByLabelText('Grąžinimas: gruodžio 5 d., iki 10:00, laukia')).toBeTruthy();
  });

  it('pasibaigęs laikotarpis netvirtina fizinio paėmimo ar grąžinimo', async () => {
    await render(<StatusTimeline steps={buildTimeline(makeReservation({ etapas: 'pasibaigusi' }))} />);
    expect(screen.getByLabelText('Nuomos laikotarpis prasidėjo, atlikta')).toBeTruthy();
    expect(screen.getByLabelText('Nuomos laikotarpis baigėsi, atlikta')).toBeTruthy();
    expect(screen.queryByText('Nuoma baigta')).toBeNull();
  });

  it('atšaukimo mokestis yra matomas ir įtrauktas į žingsnio etiketę', async () => {
    await render(<StatusTimeline steps={buildTimeline(makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: 'klientas', atsaukimo_mokestis: 45 }))} />);
    expect(screen.getByText('Atšaukimo mokestis: 45,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Atšaukėte rezervaciją, nutraukta, Atšaukimo mokestis: 45,00 €')).toBeTruthy();
  });
});

describe('ReservationDetailView', () => {
  it('atšaukimo veiksmas reikalauja ir callback, ir serverio leidimo, ir pasekmės', async () => {
    const onCancel = jest.fn();
    const view = await render(<ReservationDetailView reservation={makeReservation()} onCancel={onCancel} />);
    await fireEvent.press(screen.getByTestId('reservation-cancel'));
    expect(onCancel).toHaveBeenCalledTimes(1);
    await view.rerender(<ReservationDetailView reservation={makeReservation({ veiksmai: ['perziureti'] })} onCancel={onCancel} />);
    expect(screen.queryByTestId('reservation-cancel')).toBeNull();
    await view.rerender(<ReservationDetailView reservation={makeReservation({ atsaukimas: null })} onCancel={onCancel} />);
    expect(screen.queryByTestId('reservation-cancel')).toBeNull();
  });
  it('rodo serverio etapą, užfiksuotus tarifus, paslaugų sumas ir bendrą sumą', async () => {
    await render(<ReservationDetailView reservation={makeReservation()} />);
    expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy();
    expect(screen.getByTestId('stage-badge')).toHaveTextContent('Laukia patvirtinimo');
    expect(screen.getByLabelText('Laikotarpis: 2026 m. gruodžio 1 d. – 2026 m. gruodžio 5 d.')).toBeTruthy();
    expect(screen.getByLabelText('Paros kaina: 45,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Pilna apsauga: 12,00 € už parą · 48,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Priimta sąlygų versija: 2026-11-24')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Atšaukti rezervaciją' })).toBeNull();
  });

  it('nežinomi seni laukai nepristatomi kaip priimtos sąlygos ar nulinis mokestis', async () => {
    await render(<ReservationDetailView reservation={makeReservation({ paslaugos: [], salygu_versija: null, atsaukimo_mokestis: null })} />);
    expect(screen.getByText('Nepasirinkta')).toBeTruthy();
    expect(screen.queryByLabelText(/Priimta sąlygų versija/)).toBeNull();
    expect(screen.queryByLabelText(/^Atšaukimo mokestis:/)).toBeNull();
  });

  it('atskirai rodo atšaukimo mokestį, nekeisdamas rezervacijos sumos', async () => {
    await render(<ReservationDetailView reservation={makeReservation({ etapas: 'atsaukta', atsaukimo_tipas: 'klientas', atsaukimo_mokestis: 45 })} />);
    expect(screen.getByLabelText('Atšaukimo mokestis: 45,00 €')).toBeTruthy();
    expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();
  });
});
