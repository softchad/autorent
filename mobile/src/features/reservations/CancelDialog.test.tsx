import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { cancelReservation } from '@/api/reservations';
import { CustomerReservation } from '@/api/types';
import { makeReservation } from '@/testUtils/fixtures';
import { pressTwiceBeforeCommit } from '@/testUtils/pressTwice';
import { CancelDialog, consequenceLines, formatFreeUntil } from './CancelDialog';

jest.mock('@/api/reservations');
const cancel = jest.mocked(cancelReservation);
const FREE = makeReservation();
const PAID = makeReservation({ atsaukimas: { nemokamai: false, mokestis: 45, nemokamai_iki: '2026-11-29T12:00:00Z' } });
function dialog(reservation = FREE) {
  const props = { onClose: jest.fn(), onDone: jest.fn(), onConditionsChanged: jest.fn() };
  return { props, view: render(<CancelDialog reservation={reservation} {...props} />) };
}
function deferred() {
  let resolve!: (value: CustomerReservation) => void;
  const promise = new Promise<CustomerReservation>((done) => { resolve = done; });
  return { promise, resolve };
}
beforeEach(() => cancel.mockReset());

describe('atšaukimo pasekmė', () => {
  it.each([
    ['2026-12-01T10:00:00Z', '2026 m. gruodžio 1 d. 12:00'],
    ['2026-07-01T09:00:00Z', '2026 m. liepos 1 d. 12:00'],
    ['2026-12-01T22:30:00.123456Z', '2026 m. gruodžio 2 d. 00:30'],
  ])('Lietuvos laikas: %s', (input, expected) => expect(formatFreeUntil(input)).toBe(expected));

  it('rodo tik serverio grąžintą nemokamą ribą arba mokestį', () => {
    expect(consequenceLines(FREE.atsaukimas!)).toEqual([
      'Atšaukimas nemokamas.', 'Nemokamai iki 2026 m. lapkričio 29 d. 14:00 (Lietuvos laiku).',
    ]);
    expect(consequenceLines(PAID.atsaukimas!)).toEqual(['Atšaukimo mokestis: 45,00 €']);
  });
});

describe('CancelDialog', () => {
  it('rodo pasekmę prieš bet kokią užklausą; palikti rezervaciją nieko neatšaukia', async () => {
    const { props, view } = dialog();
    await view;
    expect(screen.getByText('Atšaukimas nemokamas.')).toBeTruthy();
    expect(cancel).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('cancel-keep'));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(cancel).not.toHaveBeenCalled();
  });

  it('rodo mokestį ant mygtuko ir siunčia būtent tą sumą', async () => {
    const updated = makeReservation({ etapas: 'atsaukta', atsaukimas: null, veiksmai: ['perziureti'], atsaukimo_tipas: 'klientas', atsaukimo_mokestis: 45 });
    cancel.mockResolvedValue(updated);
    const { props, view } = dialog(PAID);
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Atšaukti su 45,00 € mokesčiu' }));
    expect(cancel).toHaveBeenCalledWith(501, 45);
    await waitFor(() => expect(props.onDone).toHaveBeenCalledWith(updated));
  });

  it.each([
    { atsaukimas: null },
    { veiksmai: ['perziureti'] as CustomerReservation['veiksmai'] },
  ])('be serverio leidimo arba pasekmės patvirtinimo nėra (%j)', async (overrides) => {
    await dialog(makeReservation(overrides)).view;
    expect(screen.queryByTestId('cancel-confirm')).toBeNull();
    expect(cancel).not.toHaveBeenCalled();
  });

  it('du paspaudimai prieš React commit siunčia tik vieną užklausą; kol siunčiama langas neuždaromas', async () => {
    const pending = deferred();
    cancel.mockReturnValue(pending.promise);
    const { props, view } = dialog();
    await view;
    await pressTwiceBeforeCommit('cancel-confirm');
    expect(cancel).toHaveBeenCalledTimes(1);
    await fireEvent(screen.getByTestId('cancel-modal'), 'requestClose');
    await fireEvent.press(screen.getByTestId('cancel-keep'));
    expect(props.onClose).not.toHaveBeenCalled();
    await act(async () => pending.resolve(makeReservation()));
  });

  it('po 409 prašo naujos peržiūros ir nebesiunčia seno patvirtinimo', async () => {
    cancel.mockRejectedValue(new ApiError('conflict', 409));
    const { props, view } = dialog();
    await view;
    await fireEvent.press(screen.getByTestId('cancel-confirm'));
    await waitFor(() => expect(props.onConditionsChanged).toHaveBeenCalledTimes(1));
    await fireEvent.press(screen.getByTestId('cancel-confirm'));
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it('ryšio klaidą parodo ir leidžia sąmoningai pakartoti', async () => {
    cancel.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(makeReservation());
    const { props, view } = dialog();
    await view;
    await fireEvent.press(screen.getByTestId('cancel-confirm'));
    await screen.findByTestId('cancel-error');
    await fireEvent.press(screen.getByTestId('cancel-confirm'));
    await waitFor(() => expect(props.onDone).toHaveBeenCalledTimes(1));
    expect(cancel).toHaveBeenCalledTimes(2);
  });

  it('po išmontavimo pavėluota sėkmė nekviečia seno ekrano callback', async () => {
    const pending = deferred();
    cancel.mockReturnValue(pending.promise);
    const { props, view } = dialog();
    const mounted = await view;
    await fireEvent.press(screen.getByTestId('cancel-confirm'));
    await mounted.unmount();
    await act(async () => pending.resolve(makeReservation()));
    expect(props.onDone).not.toHaveBeenCalled();
    expect(props.onConditionsChanged).not.toHaveBeenCalled();
  });
});
