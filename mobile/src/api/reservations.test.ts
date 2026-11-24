import { API_PREFIX, API_URL } from '@/config/env';
import { setAuthToken } from './client';
import { cancelReservation, fetchReservation, fetchReservations } from './reservations';

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{}' } as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setAuthToken('tokenas');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

describe('rezervacijų užklausos', () => {
  it('visos siunčia kliento tokeną', async () => {
    await fetchReservations();
    await fetchReservation(15);
    await cancelReservation(15, 0);
    for (const call of fetchMock.mock.calls) {
      expect(call[1].headers.Authorization).toBe('Bearer tokenas');
    }
  });

  it('fetchReservation kviečia konkrečią rezervaciją', async () => {
    await fetchReservation(15);
    expect(fetchMock.mock.calls[0][0]).toBe(`${API_URL}${API_PREFIX}/customer/reservations/15`);
  });

  it('cancelReservation siunčia klientui parodytą mokestį', async () => {
    await cancelReservation(15, 45);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe(`${API_URL}${API_PREFIX}/customer/reservations/15/cancel`);
    expect(init.method).toBe('POST');
    expect(JSON.parse(init.body)).toEqual({ tiketinas_mokestis: 45 });
  });

  it('kliento ID užklausose nesiunčiamas', async () => {
    await fetchReservations();
    expect(fetchMock.mock.calls[0][0]).not.toContain('kliento_id');
  });
});
