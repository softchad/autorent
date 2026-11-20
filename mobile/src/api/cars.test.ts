import { API_PREFIX, API_URL } from '@/config/env';
import { fetchCar, fetchCars, fetchLocations } from './cars';
import { setAuthToken } from './client';

const BASE = `${API_URL}${API_PREFIX}`;
const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

function sentHeaders(): Record<string, string> {
  return fetchMock.mock.calls[0][1].headers;
}

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockResolvedValue({ ok: true, status: 200, text: async () => '[]' } as Response);
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

describe('katalogo užklausos', () => {
  it('fetchCars perduoda filtrus kaip užklausos parametrus', async () => {
    await fetchCars({ kuro_tipas: 'elektra', max_kaina: 60, vietos_id: undefined });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/cars?kuro_tipas=elektra&max_kaina=60`);
  });

  it('fetchCar su laikotarpiu prideda datas', async () => {
    await fetchCar(12, { date_from: '2026-11-28', date_to: '2026-12-02' });
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/cars/12?date_from=2026-11-28&date_to=2026-12-02`);
  });

  it('fetchCar be laikotarpio datų nesiunčia', async () => {
    await fetchCar(12);
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/cars/12`);
  });

  it('fetchLocations kviečia viešą padalinių sąrašą', async () => {
    await fetchLocations();
    expect(fetchMock.mock.calls[0][0]).toBe(`${BASE}/public/locations`);
  });
});

// Bendras tokenas nustatytas, todėl antraštės nebuvimas rodo, kad užklausa jo sąmoningai nenaudoja.
describe('viešos užklausos nesiunčia prisijungimo tokeno', () => {
  it('fetchCars', async () => {
    setAuthToken('kliento-tokenas');
    await fetchCars({});
    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });

  it('fetchCar', async () => {
    setAuthToken('kliento-tokenas');
    await fetchCar(12);
    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });

  it('fetchLocations', async () => {
    setAuthToken('kliento-tokenas');
    await fetchLocations();
    expect(sentHeaders()).not.toHaveProperty('Authorization');
  });
});
