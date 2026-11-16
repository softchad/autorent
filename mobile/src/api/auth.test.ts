import { fetchMe, login, register } from './auth';
import { setAuthToken } from './client';
import { ApiError } from './errors';

const fetchMock = jest.fn();
const originalFetch = globalThis.fetch;

function jsonResponse(
  status: number,
  body: unknown,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => JSON.stringify(body),
  } as Response;
}

function textResponse(
  status: number,
  text: string,
): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    text: async () => text,
  } as Response;
}

const REGISTER_PAYLOAD = {
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  slaptazodis: 'Slaptas123!',
};

const TOKEN_CALLS = [
  ['login', () => login('a@b.lt', 'Slaptas123!')],
  ['register', () => register(REGISTER_PAYLOAD)],
] as const;

beforeEach(() => {
  fetchMock.mockReset();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
  setAuthToken(null);
});

afterEach(() => {
  globalThis.fetch = originalFetch;
  setAuthToken(null);
});

describe('login', () => {
  it('sutvarko el. paštą ir grąžina tokeną', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'tokenas',
        token_type: 'bearer',
      }),
    );

    await expect(
      login('  Jonas@Example.com ', 'Slaptas123!'),
    ).resolves.toBe('tokenas');

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toContain('/api/v1/customer/login');
    expect(init.method).toBe('POST');

    expect(JSON.parse(init.body)).toEqual({
      el_pastas: 'jonas@example.com',
      slaptazodis: 'Slaptas123!',
    });
  });

  it('neteisingiems duomenims perduoda unauthorized klaidą', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(401, {
        detail: 'Neteisingas el. paštas arba slaptažodis',
      }),
    );

    await expect(
      login('a@b.lt', 'x'),
    ).rejects.toMatchObject({
      kind: 'unauthorized',
      detail: 'Neteisingas el. paštas arba slaptažodis',
    });
  });
});

describe('register', () => {
  it('siunčia registracijos laukus ir grąžina tokeną', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'naujas',
        token_type: 'bearer',
      }),
    );

    const payload = {
      vardas: 'Jonas',
      pavarde: 'Jonaitis',
      el_pastas: '  Jonas@Example.com ',
      telefono_nr: '+37061234567',
      gimimo_data: '1995-01-01',
      slaptazodis: 'Slaptas123!',
    };

    await expect(
      register(payload),
    ).resolves.toBe('naujas');

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toContain('/api/v1/customer/register');
    expect(init.method).toBe('POST');

    expect(JSON.parse(init.body)).toEqual({
      ...payload,
      el_pastas: 'jonas@example.com',
    });
  });

  it('užimtam el. paštui perduoda conflict klaidą', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(409, {
        detail: 'Klientas su šiuo el. paštu jau užregistruotas',
      }),
    );

    await expect(
      register(REGISTER_PAYLOAD),
    ).rejects.toMatchObject({
      kind: 'conflict',
      status: 409,
      detail: 'Klientas su šiuo el. paštu jau užregistruotas',
    });
  });
});

describe.each(TOKEN_CALLS)('%s', (_name, call) => {
  it('nesiunčia Authorization net kai nustatytas senas tokenas', async () => {
    setAuthToken('senas-tokenas');
    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        access_token: 'naujas',
        token_type: 'bearer',
      }),
    );

    await expect(call()).resolves.toBe('naujas');

    const [, init] = fetchMock.mock.calls[0];

    expect(init.headers).not.toHaveProperty('Authorization');
  });

  it('tokeną grąžina nepakeistą', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { access_token: ' a.b.c ' }),
    );

    await expect(call()).resolves.toBe(' a.b.c ');
  });

  it.each([
    ['tuščias kūnas', ''],
    ['HTML kūnas', '<html>prisijunkite prie Wi-Fi</html>'],
    ['null', 'null'],
    ['masyvas', '[]'],
    ['tuščias objektas', '{}'],
    ['access_token null', '{"access_token":null}'],
    ['skaitinis access_token', '{"access_token":123}'],
    ['tuščias access_token', '{"access_token":""}'],
    ['vien tarpų access_token', '{"access_token":"   "}'],
  ])(
    'sėkmingam atsakymui be tinkamo tokeno (%s) meta ApiError unknown',
    async (_case, text) => {
      fetchMock.mockResolvedValue(textResponse(200, text));

      const error = await call().then(
        () => null,
        (e: unknown) => e,
      );

      expect(error).toBeInstanceOf(ApiError);
      expect(error).toMatchObject({ kind: 'unknown' });
    },
  );
});

describe('fetchMe', () => {
  it('siunčia tokeną Authorization antraštėje', async () => {
    setAuthToken('tokenas');

    fetchMock.mockResolvedValue(
      jsonResponse(200, {
        kliento_id: 1,
        vardas: 'Jonas',
      }),
    );

    await expect(fetchMe()).resolves.toMatchObject({
      kliento_id: 1,
    });

    const [url, init] = fetchMock.mock.calls[0];

    expect(url).toContain('/api/v1/customer/me');
    expect(init.method).toBe('GET');
    expect(init.headers.Authorization).toBe(
      'Bearer tokenas',
    );
  });

  it('su perduotu tokenu naudoja jį tik šiai užklausai', async () => {
    setAuthToken('bendras');
    fetchMock.mockResolvedValue(
      jsonResponse(200, { kliento_id: 8 }),
    );

    await expect(fetchMe('konkretus')).resolves.toMatchObject({
      kliento_id: 8,
    });
    await fetchMe();

    const [explicitUrl, explicitInit] = fetchMock.mock.calls[0];
    const [, sharedInit] = fetchMock.mock.calls[1];

    expect(explicitUrl).toContain('/api/v1/customer/me');
    expect(explicitInit.method).toBe('GET');
    expect(explicitInit.headers.Authorization).toBe('Bearer konkretus');
    // Bendras API kliento tokenas nepakito.
    expect(sharedInit.headers.Authorization).toBe('Bearer bendras');
  });

  it('su perduotu tokenu veikia ir be bendro tokeno', async () => {
    fetchMock.mockResolvedValue(
      jsonResponse(200, { kliento_id: 8 }),
    );

    await fetchMe('konkretus');
    await fetchMe();

    expect(fetchMock.mock.calls[0][1].headers.Authorization).toBe('Bearer konkretus');
    expect(fetchMock.mock.calls[1][1].headers).not.toHaveProperty('Authorization');
  });

  it('su perduotu tokenu 401 perduodamas kaip unauthorized', async () => {
    setAuthToken('bendras');
    fetchMock.mockResolvedValue(
      jsonResponse(401, { detail: 'Invalid token' }),
    );

    await expect(fetchMe('konkretus')).rejects.toMatchObject({
      kind: 'unauthorized',
    });
  });
});