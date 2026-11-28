import { fetchAlternatives } from './booking';
import { setAuthToken } from './client';
import { API_PREFIX, API_URL } from '@/config/env';
import { ApiError } from './errors';

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '{"panasus_automobiliai":[]}' });
  globalThis.fetch = fetchMock;
  setAuthToken('test-token');
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

it('requests alternatives for the selected car and dates without authentication', async () => {
  const result = await fetchAlternatives(12, '2026-12-10', '2026-12-13');
  expect(fetchMock).toHaveBeenCalledTimes(1);
  const [url, options] = fetchMock.mock.calls[0];
  expect(url).toBe(`${API_URL}${API_PREFIX}/public/cars/12/alternatives?date_from=2026-12-10&date_to=2026-12-13`);
  expect(options.method).toBe('GET');
  expect(options.headers.Authorization).toBeUndefined();
  expect(options.body).toBeUndefined();
  expect(result.panasus_automobiliai).toEqual([]);
});

it('propagates caller cancellation', async () => {
  let requestSignal: AbortSignal | undefined;
  fetchMock.mockImplementation((_url, options) => new Promise((_resolve, reject) => {
    requestSignal = options.signal;
    requestSignal?.addEventListener('abort', () => reject(new Error('cancelled')));
  }));
  const controller = new AbortController();
  const request = fetchAlternatives(12, '2026-12-10', '2026-12-13', controller.signal);
  controller.abort();
  await expect(request).rejects.toMatchObject({ name: 'AbortError' });
  expect(requestSignal?.aborted).toBe(true);
});

it('propagates server errors', async () => {
  fetchMock.mockResolvedValue({ ok: false, status: 503, text: async () => '{"detail":"Unavailable"}' });
  await expect(fetchAlternatives(12, '2026-12-10', '2026-12-13')).rejects.toBeInstanceOf(ApiError);
});
