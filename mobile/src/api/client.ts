import { API_PREFIX, API_URL } from '@/config/env';
import { ApiError, extractDetail, kindFromStatus } from './errors';

export type QueryParams = Record<
  string,
  string | number | boolean | null | undefined
>;

export type RequestOptions = {
  method?: 'GET' | 'POST' | 'PATCH' | 'DELETE';
  body?: unknown;
  query?: QueryParams;
  // true – pridėti prisijungusio kliento tokeną.
  auth?: boolean;
  signal?: AbortSignal;
  timeoutMs?: number;
  headers?: Record<string, string>;
};

const DEFAULT_TIMEOUT_MS = 10000;

// Tokenas laikomas atmintyje; jį nustato sesijos kontekstas.
// Kiekvienas setAuthToken kvietimas pradeda naują autentifikacijos sesijos versiją – net jei tokeno
// tekstas toks pat, todėl senos sesijos užklausos atsakymas neprimetamas naujai sesijai.
let authToken: string | null = null;
let authVersion = 0;

export function setAuthToken(token: string | null): void {
  authToken = token;
  authVersion += 1;
}

// Sesijos tokenas, kuris tikrai buvo išsiųstas užklausoje, ir jos pradžios versija.
export type SessionAuth = { token: string; version: number };
export type UnauthorizedListener = (auth: SessionAuth) => void | Promise<unknown>;

let unauthorizedListener: UnauthorizedListener | null = null;

// Vienas klausytojas: kviečiamas, kai užklausa su bendru sesijos tokenu gauna 401, o ta sesija
// vis dar dabartinė. Grąžinama funkcija pašalina tik šį klausytoją, ne vėliau užregistruotą.
export function setUnauthorizedListener(listener: UnauthorizedListener): () => void {
  unauthorizedListener = listener;
  return () => {
    if (unauthorizedListener === listener) {
      unauthorizedListener = null;
    }
  };
}

function notifyUnauthorized(auth: SessionAuth): void {
  if (auth.version !== authVersion || !unauthorizedListener) {
    return;
  }
  // Klausytojo klaida neturi pakeisti užklausos klaidos (401) ar likti neapdorota.
  try {
    const result = unauthorizedListener(auth);
    if (result && typeof result.then === 'function') {
      result.then(undefined, () => undefined);
    }
  } catch {
    // Nuryjama tyčia: kvietėjas vis tiek gauna ApiError('unauthorized').
  }
}

function hasHeader(headers: Record<string, string> | undefined, name: string): boolean {
  const lower = name.toLowerCase();
  return Object.keys(headers ?? {}).some((key) => key.toLowerCase() === lower);
}

// Sudeda pilną adresą ir praleidžia tuščius filtrus.
export function buildUrl(
  path: string,
  query?: QueryParams,
): string {
  const url = `${API_URL}${API_PREFIX}${path}`;

  if (!query) {
    return url;
  }

  const parts: string[] = [];

  for (const [key, value] of Object.entries(query)) {
    if (
      value === undefined ||
      value === null ||
      value === ''
    ) {
      continue;
    }

    parts.push(
      `${encodeURIComponent(key)}=${encodeURIComponent(String(value))}`,
    );
  }

  return parts.length > 0
    ? `${url}?${parts.join('&')}`
    : url;
}

// Kvietėjo pateikta Authorization antraštė (bet kokio raidžių dydžio) paliekama tokia, kokia yra,
// ir tokia užklausa nelaikoma sesijos užklausa (pvz. kandidatinis fetchMe(token)).
// Bendras tokenas pridedamas tik auth: true užklausai, kai jis yra ir kvietėjas savo antraštės nedavė.
function buildHeaders(
  options: RequestOptions,
): { headers: Record<string, string>; sessionAuth: SessionAuth | null } {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  let sessionAuth: SessionAuth | null = null;
  if (options.auth && authToken && !hasHeader(options.headers, 'Authorization')) {
    headers.Authorization = `Bearer ${authToken}`;
    sessionAuth = { token: authToken, version: authVersion };
  }

  return { headers, sessionAuth };
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();

  if (text === '') {
    return null;
  }

  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

export async function apiRequest<T>(
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController();
  let timedOut = false;

  // Pasibaigus laukimo laikui užklausa nutraukiama.
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, options.timeoutMs ?? DEFAULT_TIMEOUT_MS);

  // Užklausą gali atšaukti ir ją iškvietęs kodas.
  const onCallerAbort = () => controller.abort();

  options.signal?.addEventListener('abort', onCallerAbort);
  if (options.signal?.aborted) controller.abort();

  // Tokenas ir sesijos versija fiksuojami užklausos pradžioje, ne atsakymo metu.
  const { headers, sessionAuth } = buildHeaders(options);

  try {
    const response = await fetch(
      buildUrl(path, options.query),
      {
        method: options.method ?? 'GET',
        headers,
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        signal: controller.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      const error = new ApiError(
        kindFromStatus(response.status),
        response.status,
        extractDetail(body),
      );
      if (response.status === 401 && sessionAuth) {
        notifyUnauthorized(sessionAuth);
      }
      throw error;
    }

    return body as T;
  } catch (error) {
    throw normalizeError(
      error,
      timedOut,
      options.signal?.aborted ?? false,
    );
  } finally {
    clearTimeout(timer);

    options.signal?.removeEventListener(
      'abort',
      onCallerAbort,
    );
  }
}

// Leidžia atskirti atšauktą užklausą nuo tikros klaidos.
export function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === 'AbortError'
  );
}

function normalizeError(
  error: unknown,
  timedOut: boolean,
  callerAborted: boolean,
): unknown {
  if (error instanceof ApiError) {
    return error;
  }

  if (timedOut) {
    return new ApiError('timeout');
  }

  if (callerAborted) {
    const abortError = new Error('Užklausa atšaukta');
    abortError.name = 'AbortError';
    return abortError;
  }

  return new ApiError('network');
}