export type ApiErrorKind =
  | 'network'
  | 'timeout'
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'conflict'
  | 'validation'
  | 'rate_limited'
  | 'server'
  | 'unknown';

// Viena klaidos forma visai programėlei.
export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly detail: string | null;

  constructor(
    kind: ApiErrorKind,
    status: number | null = null,
    detail: string | null = null,
  ) {
    super(detail ?? kind);
    this.name = 'ApiError';
    this.kind = kind;
    this.status = status;
    this.detail = detail;
  }
}

export function kindFromStatus(status: number): ApiErrorKind {
  if (status === 401) return 'unauthorized';
  if (status === 403) return 'forbidden';
  if (status === 404) return 'not_found';
  if (status === 409) return 'conflict';
  if (status === 400 || status === 422) return 'validation';
  if (status === 429) return 'rate_limited';
  if (status >= 500) return 'server';
  return 'unknown';
}

// Paima pranešimą iš FastAPI klaidos atsakymo.
export function extractDetail(body: unknown): string | null {
  if (
    typeof body !== 'object' ||
    body === null ||
    !('detail' in body)
  ) {
    return null;
  }

  const detail = (body as { detail: unknown }).detail;

  if (typeof detail === 'string') {
    return detail;
  }

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as { msg?: unknown };

    if (typeof first.msg === 'string') {
      return first.msg.replace(/^Value error,\s*/, '');
    }
  }

  return null;
}

const GENERIC_MESSAGES: Record<ApiErrorKind, string> = {
  network:
    'Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį.',
  timeout: 'Serveris neatsakė laiku. Bandykite dar kartą.',
  unauthorized: 'Sesija baigėsi. Prisijunkite iš naujo.',
  forbidden: 'Šis veiksmas jums neleidžiamas.',
  not_found: 'Įrašas nerastas.',
  conflict:
    'Veiksmo atlikti nepavyko, nes duomenys pasikeitė.',
  validation: 'Patikrinkite įvestus duomenis.',
  rate_limited:
    'Per daug bandymų. Palaukite minutę ir bandykite dar kartą.',
  server: 'Serverio klaida. Bandykite dar kartą.',
  unknown: 'Įvyko nenumatyta klaida.',
};

const KINDS_WITH_SERVER_TEXT: ApiErrorKind[] = [
  'conflict',
  'validation',
  'rate_limited',
  'unauthorized',
];

export function toUserMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return GENERIC_MESSAGES.unknown;
  }

  const serverTextIsSafe =
    KINDS_WITH_SERVER_TEXT.includes(error.kind);

  if (
    serverTextIsSafe &&
    error.detail &&
    error.detail !== 'Invalid token'
  ) {
    return error.detail;
  }

  return GENERIC_MESSAGES[error.kind];
}