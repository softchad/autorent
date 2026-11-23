import { apiRequest } from './client';
import { createHold, fetchHold, Hold, releaseHold } from './holds';

jest.mock('./client');
const request = jest.mocked(apiRequest);

// Atsakymas tokiu formatu, kokį grąžina Python: šeši trupmenos skaitmenys.
const SERVER_HOLD: Hold = {
  laikymo_id: 77,
  automobilio_id: 12,
  pradzia: '2026-12-01',
  pabaiga: '2026-12-05',
  busena: 'aktyvus',
  galioja_iki: '2026-11-28T09:10:00.123456Z',
  serverio_laikas: '2026-11-28T09:00:00.987654Z',
  liko_sekundziu: 600,
};

beforeEach(() => {
  request.mockReset().mockResolvedValue(SERVER_HOLD);
});

describe('laikymų užklausos', () => {
  it.each([
    ['createHold', () => createHold({ carId: 12, from: '2026-12-01', to: '2026-12-05' })],
    ['fetchHold', () => fetchHold(77)],
  ])('%s datų trupmeną trumpina iki milisekundžių, kitų laukų nekeičia', async (_name, call) => {
    const hold = await call();
    expect(hold).toEqual({
      ...SERVER_HOLD,
      galioja_iki: '2026-11-28T09:10:00.123Z',
      serverio_laikas: '2026-11-28T09:00:00.987Z',
    });
    expect(Date.parse(hold.galioja_iki)).toBe(Date.UTC(2026, 10, 28, 9, 10, 0, 123));
    expect(Date.parse(hold.serverio_laikas)).toBe(Date.UTC(2026, 10, 28, 9, 0, 0, 987));
  });

  it('datos be trupmenos ar su milisekundėmis nepakeičiamos', async () => {
    request.mockResolvedValue({ ...SERVER_HOLD, galioja_iki: '2026-11-28T09:10:00Z', serverio_laikas: '2026-11-28T09:00:00.500Z' });
    const hold = await fetchHold(77);
    expect(hold.galioja_iki).toBe('2026-11-28T09:10:00Z');
    expect(hold.serverio_laikas).toBe('2026-11-28T09:00:00.500Z');
  });

  it('naudoja kliento laikymų endpointus su prisijungimo raktu', async () => {
    const signal = new AbortController().signal;
    await createHold({ carId: 12, from: '2026-12-01', to: '2026-12-05' }, signal);
    await fetchHold(77, signal);
    request.mockResolvedValueOnce(null);
    await releaseHold(77);
    expect(request.mock.calls).toEqual([
      [
        '/customer/holds',
        { method: 'POST', auth: true, body: { automobilio_id: 12, date_from: '2026-12-01', date_to: '2026-12-05' }, signal },
      ],
      ['/customer/holds/77', { auth: true, signal }],
      ['/customer/holds/77', { method: 'DELETE', auth: true }],
    ]);
  });
});
