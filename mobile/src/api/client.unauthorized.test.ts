import { apiRequest, setAuthToken, setUnauthorizedListener, UnauthorizedListener } from './client';
import { ApiError } from './errors';

// Netikras tik serveris (fetch); API klientas tikras.
type Reply = { status: number; body?: unknown };
type Held = { init: RequestInit; reply: (r: Reply) => void };

const originalFetch = globalThis.fetch;
let held: Held[] = [];
let removeListener: (() => void) | null = null;

function toResponse(reply: Reply): Response {
  return {
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    text: async () => JSON.stringify(reply.body ?? null),
  } as Response;
}

const fetchMock = jest.fn(
  (_url: string, init: RequestInit) =>
    new Promise<Response>((resolve) => {
      held.push({ init, reply: (r) => resolve(toResponse(r)) });
    }),
);

function listen(listener: UnauthorizedListener = jest.fn()) {
  const mock = jest.fn(listener);
  removeListener = setUnauthorizedListener(mock);
  return mock;
}

function sentAuthorization(index: number): string | undefined {
  const headers = held[index].init.headers as Record<string, string>;
  return headers.Authorization ?? headers.authorization;
}

async function waitForRequests(count: number) {
  while (held.length < count) {
    await Promise.resolve();
  }
}

const UNAUTHORIZED: Reply = { status: 401, body: { detail: 'Invalid token' } };

beforeEach(() => {
  held = [];
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setAuthToken(null);
});

afterEach(() => {
  removeListener?.();
  removeListener = null;
  setAuthToken(null);
});

afterAll(() => {
  globalThis.fetch = originalFetch;
});

describe('401 klausytojas', () => {
  it('auth: true užklausos 401 – klausytojui perduodamas tikrai siųstas tokenas, atmetama ApiError', async () => {
    const listener = listen();
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    expect(sentAuthorization(0)).toBe('Bearer tokenas-a');
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized', status: 401, detail: 'Invalid token' });
    expect(listener).toHaveBeenCalledTimes(1);
    expect(listener.mock.calls[0][0]).toMatchObject({ token: 'tokenas-a' });
  });

  it.each([
    ['login', '/customer/login'],
    ['register', '/customer/register'],
  ])('viešos %s užklausos 401 klausytojo nekviečia, net jei sesija aktyvi', async (_name, path) => {
    const listener = listen();
    setAuthToken('tokenas-a');

    const request = apiRequest(path, { method: 'POST', body: { el_pastas: 'a@b.lt' } });
    await waitForRequests(1);
    expect(sentAuthorization(0)).toBeUndefined();
    held[0].reply({ status: 401, body: { detail: 'Neteisingas el. paštas arba slaptažodis' } });

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();
  });

  it.each([
    [403, 'forbidden'],
    [409, 'conflict'],
  ])('%p auth užklausai – klausytojas nekviečiamas', async (status, kind) => {
    const listener = listen();
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/reservations', { auth: true });
    await waitForRequests(1);
    held[0].reply({ status, body: { detail: 'x' } });

    await expect(request).rejects.toMatchObject({ kind, status });
    expect(listener).not.toHaveBeenCalled();
  });

  it('auth: true, bet tokeno nėra – antraštė nesiunčiama, 401 klausytojo nekviečia', async () => {
    const listener = listen();

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    expect(sentAuthorization(0)).toBeUndefined();
    held[0].reply({ status: 401, body: { detail: 'Not authenticated' } });

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();
  });

  it.each(['Authorization', 'authorization'])(
    'kvietėjo %s antraštė (kandidatinis fetchMe(token)) gerbiama ir 401 klausytojo nekviečia',
    async (name) => {
      const listener = listen();
      setAuthToken('tokenas-a');

      const request = apiRequest('/customer/me', { auth: true, headers: { [name]: 'Bearer kandidatas' } });
      await waitForRequests(1);
      const headers = held[0].init.headers as Record<string, string>;
      expect(headers[name]).toBe('Bearer kandidatas');
      // Bendras tokenas papildomai nepridedamas.
      expect(Object.values(headers)).not.toContain('Bearer tokenas-a');
      held[0].reply(UNAUTHORIZED);

      await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
      expect(listener).not.toHaveBeenCalled();
    },
  );

  it('A užklausos 401, atėjęs jau perėjus į B sesiją, klausytojo nekviečia', async () => {
    const listener = listen();
    setAuthToken('tokenas-a');
    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);

    setAuthToken('tokenas-b');
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();
  });

  it('ta pati tokeno eilutė naujoje sesijoje: senos sesijos 401 klausytojo nekviečia', async () => {
    const listener = listen();
    setAuthToken('tokenas-a');
    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);

    // Nauja sesija su tuo pačiu tekstu (pvz. atsijungta ir vėl prisijungta).
    setAuthToken('tokenas-a');
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();

    // Naujos sesijos užklausa praneša įprastai.
    const fresh = apiRequest('/customer/me', { auth: true });
    await waitForRequests(2);
    held[1].reply(UNAUTHORIZED);
    await expect(fresh).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('keli vienalaikiai 401 – klausytojas, baigiantis sesiją, kviečiamas vieną kartą', async () => {
    // Kaip AuthContext: sesijos pabaiga išvalo bendrą tokeną.
    const listener = listen(() => setAuthToken(null));
    setAuthToken('tokenas-a');
    const requests = [1, 2, 3].map(() => apiRequest('/customer/me', { auth: true }));
    await waitForRequests(3);

    for (const h of held) h.reply(UNAUTHORIZED);

    for (const request of requests) {
      await expect(request).rejects.toMatchObject({ kind: 'unauthorized', status: 401 });
    }
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it('klausytojo išimtis nekeičia klaidos: lieka ApiError unauthorized, ne network', async () => {
    listen(() => {
      throw new Error('Klausytojo klaida');
    });
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    held[0].reply(UNAUTHORIZED);

    const error = await request.catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error).toMatchObject({ kind: 'unauthorized', status: 401 });
  });

  it('klausytojo atmestas Promise neapdorotas nelieka, klaida lieka 401', async () => {
    listen(() => Promise.reject(new Error('Asinchroninė klaida')));
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    // Jest 30 neapdorotą atmetimą paverstų testo klaida.
    await new Promise((resolve) => setTimeout(resolve, 0));
  });

  it('seno klausytojo cleanup nepašalina vėliau užregistruoto', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const removeFirst = setUnauthorizedListener(first);
    removeListener = setUnauthorizedListener(second);
    removeFirst();
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('pašalinus klausytoją 401 vis tiek atmetamas kaip ApiError', async () => {
    const listener = listen();
    removeListener?.();
    setAuthToken('tokenas-a');

    const request = apiRequest('/customer/me', { auth: true });
    await waitForRequests(1);
    held[0].reply(UNAUTHORIZED);

    await expect(request).rejects.toMatchObject({ kind: 'unauthorized' });
    expect(listener).not.toHaveBeenCalled();
  });
});
