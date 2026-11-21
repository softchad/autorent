import { API_PREFIX, API_URL } from '@/config/env';
import { isAbortError, setAuthToken } from './client';
import { ApiError } from './errors';
import { fetchRentalInfo } from './terms';

const URL = `${API_URL}${API_PREFIX}/public/rental-info`;
const BODY = { draudimo_isskaita_eur: 500, skyriai: [{ kodas: 'draudimas', pavadinimas: 'Draudimas', punktai: ['A'] }] };
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => JSON.stringify(BODY) } as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

describe('fetchRentalInfo', () => {
  it('kviečia viešą sąlygų adresą ir grąžina atsakymą', async () => {
    await expect(fetchRentalInfo()).resolves.toEqual(BODY);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0][0]).toBe(URL);
  });

  it('net nustačius bendrą tokeną užklausa siunčiama be Authorization', async () => {
    setAuthToken('kliento-tokenas');
    await fetchRentalInfo();
    expect(fetchMock.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  it('kvietėjo signalas nutraukia vykstančią užklausą', async () => {
    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) =>
        new Promise((_resolve, reject) => {
          init.signal?.addEventListener('abort', () => {
            const error = new Error('aborted');
            error.name = 'AbortError';
            reject(error);
          });
        }),
    );
    const controller = new AbortController();
    const request = fetchRentalInfo(controller.signal);
    controller.abort();

    const error = await request.catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
    expect((fetchMock.mock.calls[0][1] as RequestInit).signal?.aborted).toBe(true);
  });

  it('serverio klaida perduodama kaip ApiError, ne nutylima', async () => {
    fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => JSON.stringify({ detail: 'Laikinai nepasiekiama' }) } as Response);
    const error = await fetchRentalInfo().catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ status: 503 });
  });
});
