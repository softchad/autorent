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

// Tokenas laikomas atmintyje.
// Vėliau jį nustatys prisijungimo ir sesijos valdymo kodas.
let authToken: string | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
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

function buildHeaders(
  options: RequestOptions,
): Record<string, string> {
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...options.headers,
  };

  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }

  if (options.auth && authToken) {
    headers.Authorization = `Bearer ${authToken}`;
  }

  return headers;
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

  try {
    const response = await fetch(
      buildUrl(path, options.query),
      {
        method: options.method ?? 'GET',
        headers: buildHeaders(options),
        body:
          options.body === undefined
            ? undefined
            : JSON.stringify(options.body),
        signal: controller.signal,
      },
    );

    const body = await readJson(response);

    if (!response.ok) {
      throw new ApiError(
        kindFromStatus(response.status),
        response.status,
        extractDetail(body),
      );
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