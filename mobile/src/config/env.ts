// Android emuliatoriaus adresas, kuriuo pasiekiamas kompiuterio localhost.
const DEV_DEFAULT_API_URL = 'http://10.0.2.2:8000';

// Grąžina sutvarkytą API adresą arba meta klaidą, jei jis netinkamas.
export function resolveApiUrl(
  rawUrl: string | undefined,
  isProduction: boolean,
): string {
  const url = (rawUrl ?? '').trim().replace(/\/+$/, '');

  if (url === '') {
    if (isProduction) {
      throw new Error('Nenurodytas EXPO_PUBLIC_API_URL.');
    }
    return DEV_DEFAULT_API_URL;
  }

  const isHttps = url.startsWith('https://');
  const isHttp = url.startsWith('http://');

  if (!isHttps && !isHttp) {
    throw new Error(
      'EXPO_PUBLIC_API_URL turi prasidėti http:// arba https://.',
    );
  }

  if (isProduction && !isHttps) {
    throw new Error(
      'Production versijoje API adresas privalo būti https://.',
    );
  }

  return url;
}

// Šie kintamieji patenka į programėlės kodą, todėl čia negali būti paslapčių.
export const API_URL = resolveApiUrl(
  process.env.EXPO_PUBLIC_API_URL,
  !__DEV__,
);

export const API_PREFIX = '/api/v1';