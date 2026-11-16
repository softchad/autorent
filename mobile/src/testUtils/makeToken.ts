// Tik testams: JWT formos tekstas su netikru parašu.
const ALPHABET =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function utf8Bytes(text: string): number[] {
  const escaped = encodeURIComponent(text);
  const bytes: number[] = [];

  for (let i = 0; i < escaped.length; i += 1) {
    if (escaped[i] === '%') {
      bytes.push(
        parseInt(escaped.slice(i + 1, i + 3), 16),
      );
      i += 2;
    } else {
      bytes.push(escaped.charCodeAt(i));
    }
  }

  return bytes;
}

export function encodeBase64Url(text: string): string {
  const bytes = utf8Bytes(text);
  let output = '';

  for (let i = 0; i < bytes.length; i += 3) {
    const chunk =
      (bytes[i] << 16) |
      ((bytes[i + 1] ?? 0) << 8) |
      (bytes[i + 2] ?? 0);

    output +=
      ALPHABET[(chunk >> 18) & 63] +
      ALPHABET[(chunk >> 12) & 63];

    if (i + 1 < bytes.length) {
      output += ALPHABET[(chunk >> 6) & 63];
    }

    if (i + 2 < bytes.length) {
      output += ALPHABET[chunk & 63];
    }
  }

  return output;
}

export function makeToken(payload: object): string {
  const header = encodeBase64Url(
    JSON.stringify({ alg: 'HS256', typ: 'JWT' }),
  );

  const body = encodeBase64Url(JSON.stringify(payload));

  return `${header}.${body}.parasas`;
}