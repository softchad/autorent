import {
  encodeBase64Url,
  makeToken,
} from '@/testUtils/makeToken';
import {
  decodeBase64Url,
  EXPIRY_SAFETY_MS,
  isTokenExpired,
  msUntilExpiry,
  readTokenExpiryMs,
} from './jwt';

const NOW = Date.UTC(2026, 10, 16, 12, 0, 0);

// RFC 7519 §3.1 pavyzdinis tokenas (payload su exp = 1300819380).
const RFC7519_PAYLOAD =
  'eyJpc3MiOiJqb2UiLA0KICJleHAiOjEzMDA4MTkzODAsDQogImh0dHA6Ly9leGFtcGxlLmNvbS9pc19yb290Ijp0cnVlfQ';
const RFC7519_TOKEN =
  `eyJ0eXAiOiJKV1QiLA0KICJhbGciOiJIUzI1NiJ9.${RFC7519_PAYLOAD}.dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk`;

describe('decodeBase64Url', () => {
  it('dekoduoja lietuviškas raides', () => {
    const text = 'Šiauliai ąčęėįšųūž';

    expect(
      decodeBase64Url(encodeBase64Url(text)),
    ).toBe(text);
  });

  it('priima base64url simbolius - ir _', () => {
    const encoded = encodeBase64Url('???>>>');

    expect(encoded).toMatch(/[-_]/);
    expect(decodeBase64Url(encoded)).toBe('???>>>');
  });

  it('atmeta neleistinus simbolius', () => {
    expect(() => decodeBase64Url('ab$c')).toThrow();
  });

  // Fiksuoti RFC 4648 §10 pavyzdžiai: nepriklauso nuo mūsų encoderio.
  it.each([
    ['', ''],
    ['Zg', 'f'],
    ['Zm8', 'fo'],
    ['Zm9v', 'foo'],
    ['Zm9vYg', 'foob'],
    ['Zm9vYmE', 'fooba'],
    ['Zm9vYmFy', 'foobar'],
    ['Zg==', 'f'],
    ['Zm8=', 'fo'],
  ])('RFC 4648 pavyzdys %p dekoduojamas į %p', (encoded, expected) => {
    expect(decodeBase64Url(encoded)).toBe(expected);
  });

  it('dekoduoja RFC 7519 §3.1 payload', () => {
    expect(decodeBase64Url(RFC7519_PAYLOAD)).toBe(
      '{"iss":"joe",\r\n "exp":1300819380,\r\n "http://example.com/is_root":true}',
    );
  });

  it.each(['_w', '7aA', 'wKA'])(
    'atmeta netinkamą UTF-8: %p',
    (encoded) => {
      expect(() => decodeBase64Url(encoded)).toThrow(URIError);
    },
  );

  it.each(['Z', 'Zm9vY', 'Zm9vY=', 'Zm9vYmFyZ'])(
    'atmeta netaisyklingą ilgį (mod 4 == 1): %p',
    (encoded) => {
      expect(() => decodeBase64Url(encoded)).toThrow(
        'Netinkamas base64 ilgis',
      );
    },
  );
});

describe('readTokenExpiryMs', () => {
  it('perskaito exp ir paverčia milisekundėmis', () => {
    const token = makeToken({
      sub: '1',
      type: 'customer',
      exp: 1_800_000_000,
    });

    expect(readTokenExpiryMs(token)).toBe(
      1_800_000_000_000,
    );
  });

  it('perskaito exp iš RFC 7519 pavyzdinio tokeno', () => {
    expect(readTokenExpiryMs(RFC7519_TOKEN)).toBe(
      1_300_819_380_000,
    );
  });

  it('netinkamo UTF-8 payload atveju grąžina null', () => {
    expect(readTokenExpiryMs('a._w.c')).toBeNull();
  });

  it('netaisyklingo ilgio payload atveju grąžina null', () => {
    const payload = encodeBase64Url('{"exp":1800000000}');

    expect(readTokenExpiryMs(`a.${payload}A.c`)).toBeNull();
  });

  it.each([
    '',
    'ne-tokenas',
    'a.b',
    'a.%%%.c',
    makeToken({ sub: '1' }),
    makeToken({ exp: 'rytoj' }),
  ])('netinkamam tokenui %p grąžina null', (token) => {
    expect(readTokenExpiryMs(token)).toBeNull();
  });

  it.each(['null', '[]', '"tekstas"', '42'])(
    'atmeta netinkamą payload tipą: %s',
    (payload) => {
      const token = `a.${encodeBase64Url(payload)}.c`;

      expect(readTokenExpiryMs(token)).toBeNull();
    },
  );

  it('atmeta nebaigtinį exp', () => {
    const token =
      `a.${encodeBase64Url('{"exp":1e309}')}.c`;

    expect(readTokenExpiryMs(token)).toBeNull();
  });

  it('atmeta konvertuojant perpildytas milisekundes', () => {
    const token = makeToken({ exp: Number.MAX_VALUE });

    expect(readTokenExpiryMs(token)).toBeNull();
  });
});

describe('isTokenExpired', () => {
  it('galiojantis tokenas nepasibaigęs', () => {
    const token = makeToken({
      exp: (NOW + 10 * 60_000) / 1000,
    });

    expect(isTokenExpired(token, NOW)).toBe(false);
  });

  it('pasibaigęs tokenas', () => {
    const token = makeToken({
      exp: (NOW - 1000) / 1000,
    });

    expect(isTokenExpired(token, NOW)).toBe(true);
  });

  it('saugos atsargos riboje laikomas pasibaigusiu', () => {
    const token = makeToken({
      exp: (NOW + EXPIRY_SAFETY_MS) / 1000,
    });

    expect(isTokenExpired(token, NOW)).toBe(true);
  });

  it('sugadintas tokenas laikomas pasibaigusiu', () => {
    expect(isTokenExpired('sugadintas', NOW)).toBe(true);
  });

  it.each([NaN, Infinity, -Infinity])(
    'nebaigtinis nowMs %p laikomas pasibaigusiu',
    (nowMs) => {
      const token = makeToken({
        exp: (NOW + 10 * 60_000) / 1000,
      });

      expect(isTokenExpired(token, nowMs)).toBe(true);
    },
  );
});

describe('msUntilExpiry', () => {
  it('atima saugos atsargą', () => {
    const token = makeToken({
      exp: (NOW + 60 * 60_000) / 1000,
    });

    expect(msUntilExpiry(token, NOW)).toBe(
      60 * 60_000 - EXPIRY_SAFETY_MS,
    );
  });

  it('negrąžina neigiamo laiko', () => {
    const token = makeToken({
      exp: (NOW - 5000) / 1000,
    });

    expect(msUntilExpiry(token, NOW)).toBe(0);
    expect(msUntilExpiry('sugadintas', NOW)).toBe(0);
  });

  it.each([NaN, Infinity, -Infinity])(
    'nebaigtiniam nowMs %p grąžina 0',
    (nowMs) => {
      const token = makeToken({
        exp: (NOW + 60 * 60_000) / 1000,
      });

      expect(msUntilExpiry(token, nowMs)).toBe(0);
    },
  );
});