import { lt } from '@/i18n/lt';

// Kliento tikrinimas padeda iškart parodyti klaidas.
// Galutinį duomenų ir prisijungimo tikrinimą atlieka serveris.
export type FieldErrors<Field extends string> =
  Partial<Record<Field, string>>;

export function hasErrors(
  errors: FieldErrors<string>,
): boolean {
  return Object.keys(errors).length > 0;
}

// Paprasta el. pašto formos patikra, ne adreso egzistavimo tikrinimas.
export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

export type LoginValues = {
  email: string;
  password: string;
};

export function validateLogin(
  values: LoginValues,
): FieldErrors<keyof LoginValues> {
  const errors: FieldErrors<keyof LoginValues> = {};

  if (values.email.trim() === '') {
    errors.email = lt.auth.errors.emailRequired;
  } else if (!isValidEmail(values.email)) {
    errors.email = lt.auth.errors.emailInvalid;
  }

  if (values.password === '') {
    errors.password = lt.auth.errors.passwordRequired;
  }

  return errors;
}