import { act, renderHook, waitFor } from '@testing-library/react-native';
import { ReactNode } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { apiRequest, isAbortError, setAuthToken } from '@/api/client';
import { Customer } from '@/api/types';
import { makeToken } from '@/testUtils/makeToken';
import { AuthProvider, useAuth } from './AuthContext';
import * as tokenStorage from './tokenStorage';

// tokenStorage pakeistas mock'u su atmintyje laikoma reikšme: tai NE tikros
// įrenginio saugyklos patikra, o tik sesijos konteksto elgesio su ja testas.
jest.mock('./tokenStorage');
const storage = jest.mocked(tokenStorage);
let stored: string | null = null;

// API sluoksnis tikras (api/auth + api/client); netikras tik serveris (fetch).
type Req = { path: string; method: string; auth: string | null; body: any };
type Reply = { status: number; body?: unknown } | 'network';
type Held = { req: Req; reply: (r: Reply) => void };

const CUSTOMER_A: Customer = {
  kliento_id: 7,
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  registracijos_data: null,
};
const CUSTOMER_B: Customer = {
  ...CUSTOMER_A,
  kliento_id: 8,
  vardas: 'Ona',
  pavarde: 'Onaitė',
  el_pastas: 'ona@example.com',
};

const tokenFor = (sub: string, expOffsetS: number) =>
  makeToken({ sub, type: 'customer', exp: Math.floor(Date.now() / 1000) + expOffsetS });
const TOKEN_A = tokenFor('7', 3600);
const TOKEN_B = tokenFor('8', 3600);
const EXPIRED = tokenFor('7', -10);

const PROFILES = new Map<string, Customer>([
  [TOKEN_A, CUSTOMER_A],
  [TOKEN_B, CUSTOMER_B],
]);
const LOGINS: Record<string, string> = {
  'jonas@example.com': TOKEN_A,
  'ona@example.com': TOKEN_B,
};
const PASSWORD = 'Slaptas123!';
const REGISTER_PAYLOAD = {
  vardas: 'Ona',
  pavarde: 'Onaitė',
  el_pastas: 'Ona@Example.com',
  telefono_nr: '+37061234568',
  gimimo_data: '1996-02-02',
  slaptazodis: PASSWORD,
};

let requests: Req[] = [];
let held: Held[] = [];
let override: ((req: Req) => Reply | 'hold' | undefined) | null = null;

function defaultReply(req: Req): Reply {
  if (req.path === '/customer/login') {
    const token = LOGINS[req.body.el_pastas];
    return token && req.body.slaptazodis === PASSWORD
      ? { status: 200, body: { access_token: token, token_type: 'bearer' } }
      : { status: 401, body: { detail: 'Neteisingas el. paštas arba slaptažodis' } };
  }
  if (req.path === '/customer/register') {
    return { status: 200, body: { access_token: TOKEN_B, token_type: 'bearer' } };
  }
  if (req.path === '/customer/me') {
    const customer = req.auth ? PROFILES.get(req.auth) : undefined;
    return customer
      ? { status: 200, body: customer }
      : { status: 401, body: { detail: req.auth ? 'Invalid token' : 'Not authenticated' } };
  }
  return { status: 404, body: { detail: 'Not Found' } };
}

function toResponse(reply: Reply): Promise<Response> {
  if (reply === 'network') return Promise.reject(new TypeError('Network request failed'));
  return Promise.resolve({
    ok: reply.status >= 200 && reply.status < 300,
    status: reply.status,
    text: async () => JSON.stringify(reply.body ?? null),
  } as Response);
}

const originalFetch = globalThis.fetch;
function fakeServer(url: string, init: RequestInit = {}): Promise<Response> {
  const headers = (init.headers ?? {}) as Record<string, string>;
  const req: Req = {
    path: url.replace(/^.*\/api\/v1/, ''),
    method: init.method ?? 'GET',
    auth: headers.Authorization ? headers.Authorization.replace(/^Bearer /, '') : null,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  };
  // Zondas API kliento tokenui patikrinti; jis neįrašomas į užklausų sąrašą.
  if (req.path === '/__probe') return toResponse({ status: 200, body: { auth: req.auth } });

  requests.push(req);
  const custom = override?.(req);
  if (custom === 'hold') {
    return new Promise<Response>((resolve, reject) => {
      held.push({ req, reply: (r) => toResponse(r).then(resolve, reject) });
    });
  }
  return toResponse(custom ?? defaultReply(req));
}
const fakeFetch = jest.fn(fakeServer);

// Kokį tokeną API klientas šiuo metu prideda prie auth: true užklausų.
async function apiToken(): Promise<string | null> {
  const body = await apiRequest<{ auth: string | null }>('/__probe', { auth: true });
  return body.auth;
}

function meRequests(token?: string | null) {
  return requests.filter((r) => r.path === '/customer/me' && (token === undefined || r.auth === token));
}

async function release(index: number, reply: Reply) {
  await act(async () => {
    held[index].reply(reply);
  });
}

type Settled = { ok: true } | { ok: false; error: any };

// Atmetimo laukiama act viduje. Forma expect(act(...)).rejects su RNTL v14 tikrinimą
// užbaigdavo anksčiau nei veiksmas iš tikrųjų baigdavosi.
async function rejectionOf(run: () => Promise<void>): Promise<any> {
  let outcome!: Settled;
  await act(async () => {
    outcome = await settle(run());
  });
  if (outcome.ok) throw new Error('Tikėtasi atmetimo, bet veiksmas pavyko');
  return outcome.error;
}
function settle(promise: Promise<void>): Promise<Settled> {
  return promise.then(
    () => ({ ok: true }) as const,
    (error) => ({ ok: false, error }) as const,
  );
}

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

const wrapper = ({ children }: { children: ReactNode }) => <AuthProvider>{children}</AuthProvider>;

async function renderAuth() {
  return renderHook(() => useAuth(), { wrapper });
}

async function renderSignedOut() {
  const hook = await renderAuth();
  await waitFor(() => expect(hook.result.current.status).toBe('signedOut'));
  return hook;
}

async function renderSignedInAs(token: string, customer: Customer) {
  stored = token;
  const hook = await renderAuth();
  await waitFor(() => expect(hook.result.current.customer).toEqual(customer));
  return hook;
}

// Neapdorotą Promise atmetimą Jest 30 pats paverčia testo klaida, todėl atskiros gaudyklės nereikia.
let consoleError: jest.SpyInstance;

let appStateListeners: ((state: AppStateStatus) => void)[] = [];
const appStateSpy = jest.spyOn(AppState, 'addEventListener');

async function emitAppState(state: AppStateStatus) {
  await act(async () => {
    for (const listener of [...appStateListeners]) listener(state);
  });
}

afterAll(() => {
  globalThis.fetch = originalFetch;
  appStateSpy.mockRestore();
});

beforeEach(() => {
  jest.resetAllMocks();
  stored = null;
  requests = [];
  held = [];
  override = null;
  setAuthToken(null);
  globalThis.fetch = fakeFetch as unknown as typeof fetch;
  fakeFetch.mockImplementation(fakeServer);
  storage.loadToken.mockImplementation(async () => stored);
  storage.saveToken.mockImplementation(async (token) => {
    stored = token;
  });
  storage.clearToken.mockImplementation(async () => {
    stored = null;
  });
  // resetAllMocks išvalo ir jest-expo AppState mock'ą, todėl klausytojai registruojami iš naujo.
  // Tai AppState imitacija, ne native fono patikra.
  appStateListeners = [];
  appStateSpy.mockImplementation((_type, listener) => {
    const typed = listener as (state: AppStateStatus) => void;
    appStateListeners.push(typed);
    return {
      remove: () => {
        appStateListeners = appStateListeners.filter((l) => l !== typed);
      },
    } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
  consoleError = jest.spyOn(console, 'error');
});

afterEach(async () => {
  // Neatsakytos užklausos uždaromos, kad neliktų kabančių laikmačių.
  for (const h of held.splice(0)) h.reply('network');
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
  // Jokių „not wrapped in act“ ar būsenos keitimo po išmontavimo įspėjimų.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  setAuthToken(null);
});

describe('sesijos atkūrimas', () => {
  it('be išsaugoto tokeno – neprisijungęs, API tokeno nėra', async () => {
    const { result } = await renderSignedOut();

    expect(result.current.notice).toBeNull();
    expect(meRequests()).toHaveLength(0);
    expect(await apiToken()).toBeNull();
  });

  it('su galiojančiu tokenu – prisijungęs, profilis gautas su tuo tokenu', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);

    expect(result.current.status).toBe('signedIn');
    expect(meRequests(TOKEN_A)).toHaveLength(1);
    expect(await apiToken()).toBe(TOKEN_A);
  });

  it('pasibaigusį tokeną ištrina ir paaiškina, serverio neklausia', async () => {
    stored = EXPIRED;
    const { result } = await renderSignedOut();

    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(stored).toBeNull();
    expect(meRequests()).toHaveLength(0);
    expect(await apiToken()).toBeNull();
  });

  it('pasibaigęs tokenas ir trynimo klaida – neužstringa loading, be neapdoroto Promise', async () => {
    stored = EXPIRED;
    storage.clearToken.mockRejectedValue(new Error('Trynimo klaida'));
    const { result } = await renderSignedOut();

    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(await apiToken()).toBeNull();
  });

  it('serveris tokeno nepriima (401) – atjungia, ištrina ir išvalo API tokeną', async () => {
    stored = tokenFor('99', 3600);
    const { result } = await renderSignedOut();

    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('401 ir trynimo klaida – vis tiek atjungta atmintyje, be neapdoroto Promise', async () => {
    stored = tokenFor('99', 3600);
    storage.clearToken.mockRejectedValue(new Error('Trynimo klaida'));
    const { result } = await renderSignedOut();

    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(await apiToken()).toBeNull();
  });

  it('be ryšio sesijos nenutraukia: prisijungęs be profilio, tokenas lieka', async () => {
    stored = TOKEN_A;
    override = (req) => (req.path === '/customer/me' ? 'network' : undefined);
    const { result } = await renderAuth();

    await waitFor(() => expect(meRequests()).toHaveLength(1));
    await waitFor(() => expect(result.current.status).toBe('signedIn'));
    expect(result.current.customer).toBeNull();
    expect(stored).toBe(TOKEN_A);
    expect(await apiToken()).toBe(TOKEN_A);
  });

  it('jei loadToken atmetamas – neprisijungęs, neužstringa loading', async () => {
    storage.loadToken.mockRejectedValue(new Error('Skaitymo klaida'));
    const { result } = await renderSignedOut();

    expect(result.current.customer).toBeNull();
  });
});

describe('signIn ir signUp', () => {
  it('signIn išsaugo tokeną, nustato API tokeną ir užkrauna profilį', async () => {
    const { result } = await renderSignedOut();

    await act(() => result.current.signIn('jonas@example.com', PASSWORD));

    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_A);
    expect(stored).toBe(TOKEN_A);
    expect(meRequests(TOKEN_A)).toHaveLength(1);
    expect(await apiToken()).toBe(TOKEN_A);
  });

  it('neteisingi duomenys – klaida perduodama, nieko neišsaugota', async () => {
    const { result } = await renderSignedOut();

    expect(await rejectionOf(() => result.current.signIn('jonas@example.com', 'blogas'))).toMatchObject({
      kind: 'unauthorized',
    });
    expect(storage.saveToken).not.toHaveBeenCalled();
    expect(result.current.status).toBe('signedOut');
    expect(await apiToken()).toBeNull();
  });

  it.each([
    ['401', { status: 401, body: { detail: 'Invalid token' } } as Reply, 'unauthorized'],
    ['ryšio klaida', 'network' as Reply, 'network'],
    ['serverio klaida', { status: 500, body: null } as Reply, 'server'],
  ])('fetchMe po prisijungimo nepavyksta (%s) – sesija nepradedama', async (_name, reply, kind) => {
    override = (req) => (req.path === '/customer/me' ? reply : undefined);
    const { result } = await renderSignedOut();

    expect(await rejectionOf(() => result.current.signIn('jonas@example.com', PASSWORD))).toMatchObject({ kind });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.customer).toBeNull();
    expect(storage.saveToken).not.toHaveBeenCalled();
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('saveToken nepavyksta – klaida perduodama, sesija nepradedama', async () => {
    storage.saveToken.mockRejectedValue(new Error('Rašymo klaida'));
    const { result } = await renderSignedOut();

    expect(await rejectionOf(() => result.current.signIn('jonas@example.com', PASSWORD))).toMatchObject({
      message: 'Rašymo klaida',
    });

    expect(result.current.status).toBe('signedOut');
    expect(result.current.customer).toBeNull();
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('signUp registruoja, išsaugo tokeną ir užkrauna naujo kliento profilį', async () => {
    const { result } = await renderSignedOut();

    await act(() => result.current.signUp(REGISTER_PAYLOAD));

    const registerReq = requests.find((r) => r.path === '/customer/register')!;
    expect(registerReq.body.el_pastas).toBe('ona@example.com');
    expect(registerReq.auth).toBeNull();
    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(stored).toBe(TOKEN_B);
    expect(await apiToken()).toBe(TOKEN_B);
  });

  it('signUp 409 – conflict perduodamas, sesija nepradedama', async () => {
    override = (req) =>
      req.path === '/customer/register'
        ? { status: 409, body: { detail: 'Klientas su šiuo el. paštu jau užregistruotas' } }
        : undefined;
    const { result } = await renderSignedOut();

    expect(await rejectionOf(() => result.current.signUp(REGISTER_PAYLOAD))).toMatchObject({ kind: 'conflict' });
    expect(result.current.status).toBe('signedOut');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('paskyros keitimas nepavyksta – lieka ankstesnė sesija su savo profiliu ir tokenu', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === '/customer/me' && req.auth === TOKEN_B ? 'network' : undefined);

    expect(await rejectionOf(() => result.current.signIn('ona@example.com', PASSWORD))).toMatchObject({
      kind: 'network',
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_A);
    expect(stored).toBe(TOKEN_A);
    expect(await apiToken()).toBe(TOKEN_A);
  });
});

describe('signOut', () => {
  it('ištrina tokeną, profilį ir API tokeną', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);

    await act(() => result.current.signOut());

    expect(stored).toBeNull();
    expect(result.current.status).toBe('signedOut');
    expect(result.current.customer).toBeNull();
    expect(result.current.notice).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('trynimo klaida – atmetama, sesija lieka nepakeista (UI ir API tokenas sutampa)', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    storage.clearToken.mockRejectedValueOnce(new Error('Trynimo klaida'));

    expect(await rejectionOf(() => result.current.signOut('Atsijungta'))).toMatchObject({
      message: 'Trynimo klaida',
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_A);
    expect(result.current.notice).toBeNull();
    expect(stored).toBe(TOKEN_A);
    expect(await apiToken()).toBe(TOKEN_A);

    // Pakartojus ir pavykus – atsijungta.
    await act(() => result.current.signOut());
    expect(result.current.status).toBe('signedOut');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('senas saveToken negali įvykti po naujesnio clearToken', async () => {
    const save = deferred<void>();
    storage.saveToken.mockImplementationOnce(async (token) => {
      await save.promise;
      stored = token;
    });
    const { result } = await renderSignedOut();

    let signIn!: Promise<Settled>;
    await act(async () => {
      signIn = settle(result.current.signIn('jonas@example.com', PASSWORD));
    });
    await waitFor(() => expect(storage.saveToken).toHaveBeenCalled());

    let signOut!: Promise<Settled>;
    await act(async () => {
      signOut = settle(result.current.signOut());
    });
    expect(storage.clearToken).not.toHaveBeenCalled();

    await act(async () => {
      save.resolve();
    });

    expect(await signIn).toEqual({ ok: true });
    expect(await signOut).toEqual({ ok: true });
    expect(stored).toBeNull();
    expect(result.current.status).toBe('signedOut');
    expect(await apiToken()).toBeNull();
  });
});

describe('refreshCustomer', () => {
  it('atnaujina profilį', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    const updated = { ...CUSTOMER_A, telefono_nr: '+37060000000' };
    override = (req) => (req.path === '/customer/me' ? { status: 200, body: updated } : undefined);

    await act(() => result.current.refreshCustomer());

    expect(result.current.customer).toEqual(updated);
  });

  it('401 – sesija baigiama su pranešimu, tokenas ištrinamas, API tokenas išvalomas', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === '/customer/me' ? { status: 401, body: { detail: 'Invalid token' } } : undefined);

    await act(() => result.current.refreshCustomer());

    expect(result.current.status).toBe('signedOut');
    expect(result.current.customer).toBeNull();
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('ryšio klaida – perduodama, sesija ir profilis lieka', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === '/customer/me' ? 'network' : undefined);

    expect(await rejectionOf(() => result.current.refreshCustomer())).toMatchObject({ kind: 'network' });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_A);
    expect(stored).toBe(TOKEN_A);
    expect(await apiToken()).toBe(TOKEN_A);
  });
});

describe('pavėluoti rezultatai', () => {
  it('pavėluotas loadToken nepakeičia jau pradėtos naujos sesijos', async () => {
    const load = deferred<string | null>();
    storage.loadToken.mockReturnValueOnce(load.promise);
    const { result } = await renderAuth();

    await act(() => result.current.signIn('ona@example.com', PASSWORD));
    expect(result.current.customer).toEqual(CUSTOMER_B);

    await act(async () => {
      load.resolve(TOKEN_A);
    });

    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(meRequests(TOKEN_A)).toHaveLength(0);
    expect(await apiToken()).toBe(TOKEN_B);
  });

  it('pavėluotas login po signOut – atmetamas AbortError, nieko neišsaugo', async () => {
    const { result } = await renderSignedOut();
    override = (req) => (req.path === '/customer/login' ? 'hold' : undefined);

    let signIn!: Promise<Settled>;
    await act(async () => {
      signIn = settle(result.current.signIn('jonas@example.com', PASSWORD));
    });
    await act(() => result.current.signOut());
    await release(0, { status: 200, body: { access_token: TOKEN_A, token_type: 'bearer' } });

    const outcome = await signIn;
    expect(outcome.ok).toBe(false);
    expect(isAbortError((outcome as { error: unknown }).error)).toBe(true);
    expect(result.current.status).toBe('signedOut');
    expect(storage.saveToken).not.toHaveBeenCalled();
    expect(meRequests()).toHaveLength(0);
    expect(await apiToken()).toBeNull();
  });

  it('pavėluotas register po signOut – atmetamas AbortError, nieko neišsaugo', async () => {
    const { result } = await renderSignedOut();
    override = (req) => (req.path === '/customer/register' ? 'hold' : undefined);

    let signUp!: Promise<Settled>;
    await act(async () => {
      signUp = settle(result.current.signUp(REGISTER_PAYLOAD));
    });
    await act(() => result.current.signOut());
    await release(0, { status: 200, body: { access_token: TOKEN_B, token_type: 'bearer' } });

    const outcome = await signUp;
    expect(outcome.ok).toBe(false);
    expect(isAbortError((outcome as { error: unknown }).error)).toBe(true);
    expect(result.current.status).toBe('signedOut');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('pavėluotas startSession fetchMe po signOut – sesija nepradedama', async () => {
    const { result } = await renderSignedOut();
    override = (req) => (req.path === '/customer/me' ? 'hold' : undefined);

    let signIn!: Promise<Settled>;
    await act(async () => {
      signIn = settle(result.current.signIn('jonas@example.com', PASSWORD));
    });
    await waitFor(() => expect(held).toHaveLength(1));
    await act(() => result.current.signOut());
    await release(0, { status: 200, body: CUSTOMER_A });

    expect((await signIn).ok).toBe(false);
    expect(result.current.status).toBe('signedOut');
    expect(result.current.customer).toBeNull();
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('paskyros keitimas: senas profilio atsakymas netampa naujo kliento profiliu', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === '/customer/me' && req.auth === TOKEN_A ? 'hold' : undefined);

    let refresh!: Promise<Settled>;
    await act(async () => {
      refresh = settle(result.current.refreshCustomer());
    });
    await waitFor(() => expect(held).toHaveLength(1));

    await act(() => result.current.signIn('ona@example.com', PASSWORD));
    expect(result.current.customer).toEqual(CUSTOMER_B);

    await release(0, { status: 200, body: CUSTOMER_A });

    expect(await refresh).toEqual({ ok: true });
    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(stored).toBe(TOKEN_B);
    expect(await apiToken()).toBe(TOKEN_B);
  });

  it('paskyros keitimas: senas 401 neatjungia naujos sesijos', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === '/customer/me' && req.auth === TOKEN_A ? 'hold' : undefined);

    let refresh!: Promise<Settled>;
    await act(async () => {
      refresh = settle(result.current.refreshCustomer());
    });
    await waitFor(() => expect(held).toHaveLength(1));
    await act(() => result.current.signIn('ona@example.com', PASSWORD));

    await release(0, { status: 401, body: { detail: 'Invalid token' } });

    expect(await refresh).toEqual({ ok: true });
    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(result.current.notice).toBeNull();
    expect(stored).toBe(TOKEN_B);
    expect(await apiToken()).toBe(TOKEN_B);
  });

  it.each([
    ['ryšio klaida', 'network' as Reply],
    ['401', { status: 401, body: { detail: 'Invalid token' } } as Reply],
  ])(
    'kol tikrinama paskyra B, kitos užklausos naudoja A tokeną; B nepavykus (%s) lieka A',
    async (_name, failure) => {
      const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
      override = (req) => (req.path === '/customer/me' && req.auth === TOKEN_B ? 'hold' : undefined);

      let signIn!: Promise<Settled>;
      await act(async () => {
        signIn = settle(result.current.signIn('ona@example.com', PASSWORD));
      });
      await waitFor(() => expect(held).toHaveLength(1));

      // B profilis tikrinamas tik su B tokenu toje vienoje užklausoje.
      expect(held[0].req.auth).toBe(TOKEN_B);
      // Bendras API kliento tokenas vis dar A.
      expect(await apiToken()).toBe(TOKEN_A);
      // Kitos užklausos (čia – profilio atnaujinimas) eina su A tokenu ir gauna A profilį.
      await act(() => result.current.refreshCustomer());
      expect(meRequests(TOKEN_A)).toHaveLength(2);
      expect(meRequests(TOKEN_B)).toHaveLength(1);
      expect(result.current.customer).toEqual(CUSTOMER_A);

      await release(0, failure);

      expect((await signIn).ok).toBe(false);
      expect(result.current.status).toBe('signedIn');
      expect(result.current.customer).toEqual(CUSTOMER_A);
      expect(result.current.notice).toBeNull();
      expect(storage.saveToken).not.toHaveBeenCalled();
      expect(stored).toBe(TOKEN_A);
      expect(await apiToken()).toBe(TOKEN_A);
    },
  );

  it('bendras tokenas pakeičiamas tik užbaigus B sesijos pradžią', async () => {
    const save = deferred<void>();
    storage.saveToken.mockImplementationOnce(async (token) => {
      await save.promise;
      stored = token;
    });
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);

    let signIn!: Promise<Settled>;
    await act(async () => {
      signIn = settle(result.current.signIn('ona@example.com', PASSWORD));
    });
    // B profilis jau gautas, bet tokenas dar saugomas – sesija dar neužbaigta.
    await waitFor(() => expect(storage.saveToken).toHaveBeenCalled());
    expect(meRequests(TOKEN_B)).toHaveLength(1);
    expect(await apiToken()).toBe(TOKEN_A);
    expect(result.current.customer).toEqual(CUSTOMER_A);

    await act(async () => {
      save.resolve();
    });

    expect(await signIn).toEqual({ ok: true });
    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(await apiToken()).toBe(TOKEN_B);
  });
});

describe('išmontavimas', () => {
  it('pavėluotas atkūrimo profilis po išmontavimo nieko nekeičia ir neįspėja', async () => {
    stored = TOKEN_A;
    override = (req) => (req.path === '/customer/me' ? 'hold' : undefined);
    const { unmount } = await renderAuth();
    await waitFor(() => expect(held).toHaveLength(1));

    await unmount();
    await release(0, { status: 401, body: { detail: 'Invalid token' } });

    expect(storage.clearToken).not.toHaveBeenCalled();
    expect(stored).toBe(TOKEN_A);
  });

  it('prisijungimas, nutrauktas išmontavimu, atmetamas AbortError ir nieko neišsaugo', async () => {
    const { result, unmount } = await renderSignedOut();
    override = (req) => (req.path === '/customer/me' ? 'hold' : undefined);

    let signIn!: Promise<Settled>;
    await act(async () => {
      signIn = settle(result.current.signIn('jonas@example.com', PASSWORD));
    });
    await waitFor(() => expect(held).toHaveLength(1));

    await unmount();
    await release(0, { status: 200, body: CUSTOMER_A });

    const outcome = await signIn;
    expect(outcome.ok).toBe(false);
    expect(isAbortError((outcome as { error: unknown }).error)).toBe(true);
    expect(storage.saveToken).not.toHaveBeenCalled();
    expect(await apiToken()).toBeNull();
  });
});

describe('automatinis sesijos pabaigimas (026)', () => {
  // Bet kuri užklausa su bendru sesijos tokenu (auth: true).
  const SESSION_PATH = '/customer/reservations';
  const sessionRequest = () => settle(apiRequest(SESSION_PATH, { auth: true }) as Promise<void>);
  const UNAUTHORIZED: Reply = { status: 401, body: { detail: 'Invalid token' } };

  it('sesijos užklausos 401 – atjungia automatiniu keliu: pranešimas, tokenas ištrintas, API tokenas išvalytas', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === SESSION_PATH ? UNAUTHORIZED : undefined);

    let outcome!: Settled;
    await act(async () => {
      outcome = await sessionRequest();
    });

    expect(outcome.ok).toBe(false);
    expect((outcome as { error: unknown }).error).toMatchObject({ kind: 'unauthorized', status: 401 });
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(stored).toBeNull();
    expect(await apiToken()).toBeNull();
  });

  it('keli vienalaikiai 401 – viena sesijos pabaiga, vienas tokeno trynimas', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === SESSION_PATH ? 'hold' : undefined);

    let outcomes!: Promise<Settled[]>;
    await act(async () => {
      outcomes = Promise.all([sessionRequest(), sessionRequest(), sessionRequest()]);
    });
    await waitFor(() => expect(held).toHaveLength(3));
    await act(async () => {
      for (const h of held) h.reply(UNAUTHORIZED);
    });

    expect((await outcomes).every((o) => !o.ok)).toBe(true);
    await waitFor(() => expect(result.current.status).toBe('signedOut'));
    expect(storage.clearToken).toHaveBeenCalledTimes(1);
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
  });

  it('A sesijos 401, atėjęs perėjus į B, B neatjungia', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === SESSION_PATH ? 'hold' : undefined);

    let outcome!: Promise<Settled>;
    await act(async () => {
      outcome = sessionRequest();
    });
    await waitFor(() => expect(held).toHaveLength(1));
    expect(held[0].req.auth).toBe(TOKEN_A);
    await act(() => result.current.signIn('ona@example.com', PASSWORD));

    await release(0, UNAUTHORIZED);

    expect((await outcome).ok).toBe(false);
    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_B);
    expect(result.current.notice).toBeNull();
    expect(storage.clearToken).not.toHaveBeenCalled();
    expect(stored).toBe(TOKEN_B);
    expect(await apiToken()).toBe(TOKEN_B);
  });

  it('ta pati tokeno eilutė naujoje sesijoje: senos sesijos 401 jos neatjungia', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === SESSION_PATH ? 'hold' : undefined);

    let outcome!: Promise<Settled>;
    await act(async () => {
      outcome = sessionRequest();
    });
    await waitFor(() => expect(held).toHaveLength(1));

    // Atsijungta ir vėl prisijungta; serveris grąžina tą patį tokeno tekstą.
    await act(() => result.current.signOut());
    await act(() => result.current.signIn('jonas@example.com', PASSWORD));
    expect(await apiToken()).toBe(TOKEN_A);
    storage.clearToken.mockClear();

    await release(0, UNAUTHORIZED);

    expect((await outcome).ok).toBe(false);
    expect(result.current.status).toBe('signedIn');
    expect(result.current.customer).toEqual(CUSTOMER_A);
    expect(storage.clearToken).not.toHaveBeenCalled();
    expect(stored).toBe(TOKEN_A);
  });

  it('viešo login 401 (neteisingas slaptažodis) esamos paskyros neatjungia', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);

    expect(await rejectionOf(() => result.current.signIn('jonas@example.com', 'blogas'))).toMatchObject({
      kind: 'unauthorized',
    });

    expect(result.current.status).toBe('signedIn');
    expect(result.current.notice).toBeNull();
    expect(storage.clearToken).not.toHaveBeenCalled();
    expect(await apiToken()).toBe(TOKEN_A);
  });

  it('išmontavus pavėluotas sesijos 401 nieko netrina ir neįspėja', async () => {
    const { unmount } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    override = (req) => (req.path === SESSION_PATH ? 'hold' : undefined);

    let outcome!: Promise<Settled>;
    await act(async () => {
      outcome = sessionRequest();
    });
    await waitFor(() => expect(held).toHaveLength(1));

    await unmount();
    await release(0, UNAUTHORIZED);

    expect((await outcome).ok).toBe(false);
    expect(storage.clearToken).not.toHaveBeenCalled();
    expect(stored).toBe(TOKEN_A);
  });

  it('galiojimo laikmatis baigia sesiją automatiniu keliu; trynimo klaida neapdorota nelieka', async () => {
    // exp sekundėmis: iki saugos atsargos lieka (0; 1] s.
    const soon = tokenFor('7', 31);
    override = (req) =>
      req.path === '/customer/me' && req.auth === soon ? { status: 200, body: CUSTOMER_A } : undefined;
    storage.clearToken.mockRejectedValue(new Error('Trynimo klaida'));
    const { result } = await renderSignedInAs(soon, CUSTOMER_A);

    await waitFor(() => expect(result.current.status).toBe('signedOut'), { timeout: 3000 });
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(await apiToken()).toBeNull();
    expect(storage.clearToken).toHaveBeenCalledTimes(1);

    // Grįžimas į active po pabaigos – antro atjungimo nėra.
    await emitAppState('active');
    expect(storage.clearToken).toHaveBeenCalledTimes(1);
  });

  it('grįžus į active po galiojimo pabaigos – vienas atjungimas; nauja sesija su tuo pačiu tokenu stebima iš naujo', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    const realNow = Date.now();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(realNow + 2 * 3600_000);

    await emitAppState('active');
    await emitAppState('active');
    nowSpy.mockRestore();

    expect(result.current.status).toBe('signedOut');
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(storage.clearToken).toHaveBeenCalledTimes(1);
    expect(stored).toBeNull();

    // Ta pati tokeno eilutė (realiu laiku dar galioja) – nauja sesija, iškart neatjungiama.
    await act(() => result.current.signIn('jonas@example.com', PASSWORD));
    await emitAppState('active');
    expect(result.current.status).toBe('signedIn');
    expect(result.current.notice).toBeNull();
    expect(storage.clearToken).toHaveBeenCalledTimes(1);
  });

  it('nepavykęs rankinis signOut nesikeičia: atmetamas, sesija aktyvi, galiojimas vis dar stebimas', async () => {
    const { result } = await renderSignedInAs(TOKEN_A, CUSTOMER_A);
    storage.clearToken.mockRejectedValueOnce(new Error('Trynimo klaida'));

    expect(await rejectionOf(() => result.current.signOut())).toMatchObject({ message: 'Trynimo klaida' });
    expect(result.current.status).toBe('signedIn');

    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(Date.now() + 2 * 3600_000);
    await emitAppState('active');
    nowSpy.mockRestore();

    expect(result.current.status).toBe('signedOut');
    expect(result.current.notice).toBe('Sesija baigėsi. Prisijunkite iš naujo.');
    expect(stored).toBeNull();
  });
});
