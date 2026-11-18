import { isAbortError } from '@/api/client';
import { ApiError, toUserMessage } from '@/api/errors';
import { lt } from '@/i18n/lt';

// Tikslūs backend tekstai (customer_auth.py endpoint ir schema). Vartotojui jie nerodomi –
// pagal juos tik parenkamas lietuviškas tekstas ir laukas.
export const EMAIL_TAKEN_DETAIL = 'Klientas su šiuo el. paštu jau užregistruotas';
const BIRTH_DATE_DETAILS = new Map<string, string>([
  ['Registruotis gali tik pilnamečiai (18+ metų) klientai', lt.registerErrors.tooYoung],
  ['Gimimo data negali būti ateityje', lt.registerErrors.birthDateFuture],
]);

export type RegisterFailure = { field?: 'el_pastas' | 'gimimo_data'; message: string };

/*
 * signUp = POST /customer/register, tada fetchMe(token) ir saveToken. Iš klaidos nematyti,
 * kuriame žingsnyje ji įvyko, todėl:
 * - 409, 422 ir 429 grąžina tik registracijos užklausa (/customer/me neturi kūno ir rate limito),
 *   taigi paskyra šia užklausa nesukurta;
 * - visos kitos klaidos (ryšys, laiko limitas, 5xx, 401 iš fetchMe, saugyklos klaida) galėjo
 *   įvykti jau sukūrus paskyrą, todėl siūloma pirmiausia bandyti prisijungti.
 */
export function describeRegisterError(error: unknown): RegisterFailure | null {
  if (isAbortError(error)) return null;
  return (error instanceof ApiError && describeRejected(error)) || { message: lt.register.errors.uncertain };
}

// Klaidos, kurias grąžina tik pati registracijos užklausa; kitoms – null.
function describeRejected(error: ApiError): RegisterFailure | null {
  switch (error.kind) {
    case 'conflict':
      return error.detail === EMAIL_TAKEN_DETAIL
        ? { field: 'el_pastas', message: lt.register.errors.emailTaken }
        : { message: lt.register.errors.rejected };
    case 'validation': {
      // ApiError išsaugo tik pirmą pranešimo tekstą be lauko (loc), todėl laukas parenkamas
      // tik tiems tekstams, kurie vienareikšmiškai susiję su gimimo data (pvz. kitoks serverio laikrodis).
      const birthDateMessage = error.detail ? BIRTH_DATE_DETAILS.get(error.detail) : undefined;
      return birthDateMessage
        ? { field: 'gimimo_data', message: birthDateMessage }
        : { message: lt.register.errors.rejected };
    }
    case 'rate_limited':
      return { message: toUserMessage(new ApiError('rate_limited')) };
    default:
      return null;
  }
}
