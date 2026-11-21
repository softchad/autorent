import { resolveOptionalHttpsUrl } from '@/config/env';
import { isAbortError } from './client';
import { buildRouteUrl, fetchRoute, isRoutingConfigured, parseRoute } from './routing';

const FROM = { lat: 54.7, lng: 25.3 };
const TO = { lat: 54.6862, lng: 25.2859 };
const BASE = 'https://routing.example';

const OSRM_BODY = {
  code: 'Ok',
  routes: [{ distance: 2400.5, duration: 420.1, geometry: { coordinates: [[25.3, 54.7], [25.29, 54.69], [25.2859, 54.6862]] } }],
};

function withRoute(route: object) {
  return { code: 'Ok', routes: [route] };
}

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn();

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  jest.useRealTimers();
  globalThis.fetch = originalFetch;
});

// Imituotas fetch, kuris baigiasi tik nutraukus jo signalą.
function hangingFetch() {
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
}

describe('resolveOptionalHttpsUrl', () => {
  it('tuščia ar ne https reikšmė reiškia „nesukonfigūruota“', () => {
    expect(resolveOptionalHttpsUrl(undefined)).toBeNull();
    expect(resolveOptionalHttpsUrl('  ')).toBeNull();
    expect(resolveOptionalHttpsUrl('ftp://routing.example')).toBeNull();
    expect(resolveOptionalHttpsUrl('routing.example')).toBeNull();
  });

  it('https adresas priimamas be galinio pasvirojo brūkšnio', () => {
    expect(resolveOptionalHttpsUrl(' https://routing.example/ ')).toBe('https://routing.example');
  });
});

describe('isRoutingConfigured', () => {
  it('priklauso tik nuo to, ar nurodytas adresas', () => {
    expect(isRoutingConfigured(null)).toBe(false);
    expect(isRoutingConfigured(BASE)).toBe(true);
  });
});

describe('buildRouteUrl', () => {
  it('koordinates rašo OSRM tvarka „ilguma,platuma“', () => {
    expect(buildRouteUrl(BASE, FROM, TO)).toBe(
      'https://routing.example/route/v1/driving/25.300000,54.700000;25.285900,54.686200?overview=full&geometries=geojson',
    );
  });
});

describe('parseRoute', () => {
  it('paverčia atsakymą taškų sąrašu (platuma, ilguma)', () => {
    expect(parseRoute(OSRM_BODY)).toEqual({
      points: [{ lat: 54.7, lng: 25.3 }, { lat: 54.69, lng: 25.29 }, { lat: 54.6862, lng: 25.2859 }],
      distanceMeters: 2400.5,
      durationSeconds: 420.1,
    });
  });

  it('priima nulinį atstumą ir trukmę', () => {
    expect(parseRoute(withRoute({ distance: 0, duration: 0, geometry: { coordinates: [[25.3, 54.7], [25.3, 54.7]] } }))).not.toBeNull();
  });

  const line = { coordinates: [[25.3, 54.7], [25.29, 54.69]] };
  it.each([
    ['tuščias atsakymas', {}],
    ['ne objektas', 'klaida'],
    ['null', null],
    ['OSRM klaida', { code: 'NoRoute', message: 'Impossible route between points', routes: [] }],
    ['be code lauko', { routes: [{ distance: 1, duration: 1, geometry: line }] }],
    ['nėra maršrutų', { code: 'Ok', routes: [] }],
    ['maršrutas null', { code: 'Ok', routes: [null] }],
    ['nėra geometrijos', withRoute({ distance: 1, duration: 1 })],
    ['ne skaičius taške', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], ['x', 1]] } })],
    ['tik vienas taškas', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7]] } })],
    ['platuma už ribų', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], [25.3, 91]] } })],
    ['ilguma už ribų', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], [-181, 54]] } })],
    ['nebaigtinė koordinatė', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], [Infinity, 54]] } })],
    ['NaN koordinatė', withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], [25.3, NaN]] } })],
    [
      'netinkamas vidurinis taškas [A, blogas, C]',
      withRoute({ distance: 1, duration: 1, geometry: { coordinates: [[25.3, 54.7], [25.3, 999], [25.2859, 54.6862]] } }),
    ],
    ['neigiamas atstumas', withRoute({ distance: -1, duration: 1, geometry: line })],
    ['neigiama trukmė', withRoute({ distance: 1, duration: -5, geometry: line })],
    ['nebaigtinis atstumas iš JSON 1e999', JSON.parse('{"code":"Ok","routes":[{"distance":1e999,"duration":1,"geometry":{"coordinates":[[25.3,54.7],[25.29,54.69]]}}]}')],
    ['NaN trukmė', withRoute({ distance: 1, duration: NaN, geometry: line })],
    ['atstumas tekstu', withRoute({ distance: '1', duration: 1, geometry: line })],
  ])('%s → null', (_name, body) => {
    expect(parseRoute(body)).toBeNull();
  });
});

describe('fetchRoute', () => {
  it('nesukonfigūravus paslaugos niekur nesikreipia', async () => {
    expect(await fetchRoute(FROM, TO, undefined, null)).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('grąžina maršrutą ir nesiunčia nei tokeno, nei kitų antraščių', async () => {
    fetchMock.mockResolvedValue({ ok: true, json: async () => OSRM_BODY });
    const route = await fetchRoute(FROM, TO, undefined, BASE);
    expect(route?.points).toHaveLength(3);
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(buildRouteUrl(BASE, FROM, TO));
    expect(options.headers).toBeUndefined();
  });

  it('paslaugos klaida, OSRM klaidos kūnas ar ryšio sutrikimas reiškia „maršruto nėra“', async () => {
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => ({ code: 'NoRoute', message: 'Impossible route' }) });
    expect(await fetchRoute(FROM, TO, undefined, BASE)).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: false, json: async () => Promise.reject(new SyntaxError('ne JSON')) });
    expect(await fetchRoute(FROM, TO, undefined, BASE)).toBeNull();
    fetchMock.mockResolvedValueOnce({ ok: true, json: async () => ({ code: 'NoRoute', routes: [] }) });
    expect(await fetchRoute(FROM, TO, undefined, BASE)).toBeNull();
    fetchMock.mockRejectedValueOnce(new Error('nėra ryšio'));
    expect(await fetchRoute(FROM, TO, undefined, BASE)).toBeNull();
  });

  it('po 12 s užklausa nutraukiama ir grąžinama null', async () => {
    jest.useFakeTimers();
    hangingFetch();
    const request = fetchRoute(FROM, TO, undefined, BASE);
    const init = fetchMock.mock.calls[0][1] as RequestInit;

    jest.advanceTimersByTime(11999);
    expect(init.signal?.aborted).toBe(false);
    jest.advanceTimersByTime(1);
    expect(init.signal?.aborted).toBe(true);
    await expect(request).resolves.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
  });

  it('kvietėjo atšaukimas nutraukia užklausą, meta AbortError ir pašalina klausytoją bei laikmatį', async () => {
    jest.useFakeTimers();
    hangingFetch();
    const controller = new AbortController();
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    const request = fetchRoute(FROM, TO, controller.signal, BASE);
    const init = fetchMock.mock.calls[0][1] as RequestInit;

    controller.abort();
    const error = await request.catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
    expect(init.signal?.aborted).toBe(true);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
    expect(jest.getTimerCount()).toBe(0);
  });

  it('jau atšauktas signalas užklausos nesiunčia', async () => {
    const controller = new AbortController();
    controller.abort();
    const error = await fetchRoute(FROM, TO, controller.signal, BASE).catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('atšaukus po atsakymo gavimo maršrutas negrąžinamas', async () => {
    const controller = new AbortController();
    fetchMock.mockResolvedValue({
      ok: true,
      json: async () => {
        controller.abort();
        return OSRM_BODY;
      },
    });
    const error = await fetchRoute(FROM, TO, controller.signal, BASE).catch((caught: unknown) => caught);
    expect(isAbortError(error)).toBe(true);
  });

  it('sėkmingai baigus pašalina laikmatį ir kvietėjo klausytoją', async () => {
    jest.useFakeTimers();
    fetchMock.mockResolvedValue({ ok: true, json: async () => OSRM_BODY });
    const controller = new AbortController();
    const removeListener = jest.spyOn(controller.signal, 'removeEventListener');
    await expect(fetchRoute(FROM, TO, controller.signal, BASE)).resolves.not.toBeNull();
    expect(jest.getTimerCount()).toBe(0);
    expect(removeListener).toHaveBeenCalledWith('abort', expect.any(Function));
  });
});
