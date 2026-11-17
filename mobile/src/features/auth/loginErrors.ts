import { isAbortError } from '@/api/client';
import { ApiError, toUserMessage } from '@/api/errors';
import { lt } from '@/i18n/lt';

// Tikslus backend /customer/login 401 atsakymo detail (customer_auth.py).
export const INVALID_CREDENTIALS_DETAIL = 'Neteisingas el. paštas arba slaptažodis';

export type LoginFailure = {
  // Laukas, prie kurio rodoma klaida; be jo – formos lygio klaida.
  field?: 'email';
  message: string;
};

// Prisijungimo formos klaidų tekstai. Serverio detail tekstas vartotojui nerodomas:
// 401 ir 422 detail gali būti techninis angliškas tekstas (pvz. „Invalid token“, pydantic EmailStr).
// null – veiksmas nutrauktas (AbortError), klaidos rodyti nereikia.
export function describeLoginError(error: unknown): LoginFailure | null {
  if (isAbortError(error)) {
    return null;
  }

  if (error instanceof ApiError) {
    if (error.kind === 'unauthorized') {
      // Neteisingi duomenys – tik žinomas login atsakymas; kiti 401 (pvz. profilio užklausa
      // su ką tik gautu tokenu) yra techniniai.
      return {
        message:
          error.detail === INVALID_CREDENTIALS_DETAIL
            ? lt.login.errors.invalidCredentials
            : lt.login.errors.signInFailed,
      };
    }

    if (error.kind === 'validation') {
      // Login užklausoje serverio schema tikrina el_pastas (EmailStr) ir slaptazodis (str);
      // forma visada siunčia slaptažodį kaip eilutę, todėl 422 reiškia el. pašto formatą.
      return { field: 'email', message: lt.auth.errors.emailInvalid };
    }

    // Kitoms kategorijoms – bendri lietuviški tekstai be serverio detail.
    return { message: toUserMessage(new ApiError(error.kind, error.status)) };
  }

  return { message: toUserMessage(error) };
}
