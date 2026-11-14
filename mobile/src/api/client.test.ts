import {
  apiRequest,
  buildUrl,
  isAbortError,
  setAuthToken,
} from './client';
import { ApiError } from './errors';

const fetchMock = jest.fn();

function jsonResponse(
  status: number,
  body: unknown,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () =>
      body === null ? '' : JSON.stringify(body),
  } as Response;
}

// Imituoja neatsakančią užklausą, kuri baigiasi tik ją atšaukus.
function hangingFetch(
  _url: string,
  init: RequestInit,
): Promise<Response> {
  return new Promise((_resolve, reject) => {
    init.signal?.addEventListener('abort', () => {
      const error = new Error('Aborted');
      error.name = 'AbortError';
      reject(error);
    });
  });
}

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setAuthToken(null);
});

describe('buildUrl', () => {
  it('prideda API priešdėlį', () => {
    expect(buildUrl('/public/cars')).toBe(
      'http://10.0.2.2:8000/api/v1/public/cars',
    );
  });

  it('praleidžia tuščius filtrus ir užkoduoja reikšmes', () => {
    const url = buildUrl('/public/cars', {
      marke: 'Škoda',
      max_kaina: 50,
      kuro_tipas: '',
      vietos_id: undefined,
    });

    expect(url).toBe(
      'http://10.0.2.2:8000/api/v1/public/cars?marke=%C5%A0koda&max_kaina=50',
    );
  });
});

describe('apiRequest', () => {
  it('grąžina JSON atsakymą', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { ok: true }),
    );

    await expect(
      apiRequest('/public/cars'),
    ).resolves.toEqual({ ok: true });
  });

  it('siunčia JSON kūną su teisinga antrašte', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));

    await apiRequest('/customer/login', {
      method: 'POST',
      body: { el_pastas: 'a@b.lt' },
    });

    const init = fetchMock.mock.calls[0][1];

    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe(
      'application/json',
    );
    expect(init.body).toBe('{"el_pastas":"a@b.lt"}');
  });

  it('tokeną prideda tik kai auth: true', async () => {
    fetchMock.mockResolvedValue(jsonResponse(200, {}));
    setAuthToken('abc');

    await apiRequest('/public/cars');
    await apiRequest('/customer/me', { auth: true });

    expect(
      fetchMock.mock.calls[0][1].headers.Authorization,
    ).toBeUndefined();

    expect(
      fetchMock.mock.calls[1][1].headers.Authorization,
    ).toBe('Bearer abc');
  });

  it('HTTP klaidą paverčia ApiError su serverio tekstu', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        detail: 'Automobilis jau užimtas',
      }),
    );

    await expect(
      apiRequest('/customer/reservations'),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      detail: 'Automobilis jau užimtas',
    });
  });

  it('tinklo klaidą paverčia ApiError network', async () => {
    fetchMock.mockRejectedValue(
      new TypeError('Network request failed'),
    );

    await expect(
      apiRequest('/public/cars'),
    ).rejects.toMatchObject({
      kind: 'network',
    });
  });

  it('tuščią atsakymą grąžina kaip null', async () => {
    fetchMock.mockResolvedValue(jsonResponse(204, null));

    await expect(
      apiRequest('/customer/holds/1', {
        method: 'DELETE',
      }),
    ).resolves.toBeNull();
  });

  it('viršijus laiko limitą meta ApiError timeout', async () => {
    jest.useFakeTimers();
    fetchMock.mockImplementation(hangingFetch);

    const promise = apiRequest('/public/cars', {
      timeoutMs: 500,
    });

    const assertion = expect(
      promise,
    ).rejects.toMatchObject({
      kind: 'timeout',
    });

    jest.advanceTimersByTime(600);
    await assertion;

    jest.useRealTimers();
  });

  it('kvietėjo atšaukimas nėra ApiError', async () => {
    fetchMock.mockImplementation(hangingFetch);

    const controller = new AbortController();

    const promise = apiRequest('/public/cars', {
      signal: controller.signal,
    });

    controller.abort();

    const error = await promise.catch(
      (e: unknown) => e,
    );

    expect(isAbortError(error)).toBe(true);
    expect(error).not.toBeInstanceOf(ApiError);
  });
    it('perduoda atšaukimą, kai kvietėjo signalas jau atšauktas', async () => {
    const controller = new AbortController();
    controller.abort();

    fetchMock.mockImplementation(
      (_url: string, init: RequestInit) => {
        if (init.signal?.aborted) {
          const error = new Error('Aborted');
          error.name = 'AbortError';
          return Promise.reject(error);
        }

        return Promise.resolve(
          jsonResponse(200, { ok: true }),
        );
      },
    );

    await expect(
      apiRequest('/public/cars', {
        signal: controller.signal,
      }),
    ).rejects.toMatchObject({
      name: 'AbortError',
    });
  });
});