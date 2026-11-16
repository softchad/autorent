// Skaitomas tik galiojimo laikas. Tokeno parašą tikrina serveris.
const BASE64_ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';

export function decodeBase64Url(input: string): string {
  const base64 = input
    .replace(/-/g, '+')
    .replace(/_/g, '/')
    .replace(/=+$/, '');

  // Ilgis mod 4 == 1 negali būti taisyklingas base64: liktų 6 bitai be pilno baito.
  if (base64.length % 4 === 1) {
    throw new Error('Netinkamas base64 ilgis');
  }

  const bytes: number[] = [];
  let buffer = 0;
  let bitCount = 0;

  for (const char of base64) {
    const value = BASE64_ALPHABET.indexOf(char);

    if (value === -1) {
      throw new Error('Netinkamas base64 simbolis');
    }

    buffer = (buffer << 6) | value;
    bitCount += 6;

    if (bitCount >= 8) {
      bitCount -= 8;
      bytes.push((buffer >> bitCount) & 0xff);
    }
  }

  return decodeUtf8(bytes);
}

function decodeUtf8(bytes: number[]): string {
  const encoded = bytes
    .map((byte) => `%${byte.toString(16).padStart(2, '0')}`)
    .join('');

  return decodeURIComponent(encoded);
}

export function readTokenExpiryMs(token: string): number | null {
  const parts = token.split('.');

  if (parts.length !== 3) {
    return null;
  }

  try {
    const payload: unknown = JSON.parse(
      decodeBase64Url(parts[1]),
    );

    if (
      typeof payload !== 'object' ||
      payload === null ||
      Array.isArray(payload)
    ) {
      return null;
    }

    const exp = (payload as { exp?: unknown }).exp;

    if (typeof exp !== 'number' || !Number.isFinite(exp)) {
      return null;
    }

    const expiryMs = exp * 1000;

    return Number.isFinite(expiryMs) ? expiryMs : null;
  } catch {
    return null;
  }
}

// Atsarga prieš galiojimo pabaigą.
export const EXPIRY_SAFETY_MS = 30_000;

export function isTokenExpired(
  token: string,
  nowMs: number,
): boolean {
  // Nebaigtinis laikas (NaN, ±Infinity) laikomas klaida: tokenas laikomas pasibaigusiu.
  if (!Number.isFinite(nowMs)) {
    return true;
  }

  const expiryMs = readTokenExpiryMs(token);

  if (expiryMs === null) {
    return true;
  }

  return nowMs >= expiryMs - EXPIRY_SAFETY_MS;
}

// Grąžinama reikšmė gali viršyti setTimeout ribą (2^31-1 ms, ~24,8 d.).
// Vėlesnis sesijos laikmatis ją turės apriboti; ši funkcija laikmačių neplanuoja.
export function msUntilExpiry(
  token: string,
  nowMs: number,
): number {
  if (!Number.isFinite(nowMs)) {
    return 0;
  }

  const expiryMs = readTokenExpiryMs(token);

  if (expiryMs === null) {
    return 0;
  }

  return Math.max(
    0,
    expiryMs - EXPIRY_SAFETY_MS - nowMs,
  );
}