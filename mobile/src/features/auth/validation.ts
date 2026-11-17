import { lt } from '@/i18n/lt';
import { fullYearsBetween, isBefore, isValidIsoDate } from '@/utils/isoDate';

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

export type RegisterValues = {
  vardas: string;
  pavarde: string;
  el_pastas: string;
  telefono_nr: string;
  gimimo_data: string;
  slaptazodis: string;
  slaptazodis2: string;
};

// Ribos sutampa su backend CustomerRegisterRequest ir DB stulpeliais.
export const MIN_AGE_YEARS = 18;
export const MIN_NAME_LENGTH = 2;
export const MIN_PASSWORD_LENGTH = 8;
// Serveris atmeta slaptažodžius, ilgesnius nei 72 UTF-8 baitai (bcrypt riba), todėl ribą tikriname baitais.
export const MAX_PASSWORD_BYTES = 72;
export const MIN_PHONE_DIGITS = 6;
// DB stulpelis telefono_nr yra String(20).
export const MAX_PHONE_LENGTH = 20;
// Registracijos taisyklė (backend: metai < 1900 atmetami), ne bendras datų formato apribojimas.
export const MIN_BIRTH_DATE = '1900-01-01';

// Ilgis Unicode kodo taškais, kaip Python len(): emoji yra 1 simbolis, ne 2 UTF-16 vienetai.
export function codePointLength(text: string): number {
  return [...text].length;
}

// Vienišas UTF-16 surogatas nėra tekstas; serveris tokios užklausos neišanalizuotų.
export function hasLoneSurrogate(text: string): boolean {
  for (const char of text) {
    const code = char.codePointAt(0)!;
    if (code >= 0xd800 && code <= 0xdfff) {
      return true;
    }
  }
  return false;
}

// UTF-8 baitų skaičius: lietuviška raidė – 2, emoji – 4. Klaidos nemeta;
// vienišas surogatas skaičiuojamas kaip pakaitinis simbolis (3 baitai), bet tinkamu netampa.
export function utf8ByteLength(text: string): number {
  let bytes = 0;
  for (const char of text) {
    const code = char.codePointAt(0)!;
    bytes += code < 0x80 ? 1 : code < 0x800 ? 2 : code < 0x10000 ? 3 : 4;
  }
  return bytes;
}

function validateName(value: string): string | undefined {
  if (hasLoneSurrogate(value)) {
    return lt.registerErrors.invalidCharacters;
  }
  return codePointLength(value.trim()) < MIN_NAME_LENGTH ? lt.registerErrors.nameTooShort : undefined;
}

// Leidžiami skaitmenys, tarpai, brūkšneliai, skliaustai ir pradinis „+“ (backend ir web formatų neriboja).
// Skaitmenų kiekis tikrinamas atskirai, kad numerio nebūtų galima užpildyti tarpais.
function validatePhone(value: string): string | undefined {
  const trimmed = value.trim();
  const digits = trimmed.replace(/\D/g, '').length;
  const valid =
    /^\+?[\d ()-]+$/.test(trimmed) && digits >= MIN_PHONE_DIGITS && trimmed.length <= MAX_PHONE_LENGTH;
  return valid ? undefined : lt.registerErrors.phoneInvalid;
}

function validateBirthDate(value: string, todayIso: string): string | undefined {
  if (!isValidIsoDate(value)) {
    return lt.registerErrors.birthDateInvalid;
  }
  if (isBefore(todayIso, value)) {
    return lt.registerErrors.birthDateFuture;
  }
  if (isBefore(value, MIN_BIRTH_DATE)) {
    return lt.registerErrors.birthDateTooEarly;
  }
  if (fullYearsBetween(value, todayIso) < MIN_AGE_YEARS) {
    return lt.registerErrors.tooYoung;
  }
  return undefined;
}

// Slaptažodis nekarpomas: tarpai kraštuose yra jo dalis, kaip ir serveryje.
function validatePassword(value: string): string | undefined {
  if (hasLoneSurrogate(value)) {
    return lt.registerErrors.invalidCharacters;
  }
  if (codePointLength(value) < MIN_PASSWORD_LENGTH) {
    return lt.registerErrors.passwordTooShort;
  }
  if (utf8ByteLength(value) > MAX_PASSWORD_BYTES) {
    return lt.registerErrors.passwordTooLong;
  }
  return undefined;
}

function validateEmailField(value: string): string | undefined {
  if (value.trim() === '') {
    return lt.auth.errors.emailRequired;
  }
  return isValidEmail(value) && !hasLoneSurrogate(value) ? undefined : lt.auth.errors.emailInvalid;
}

// todayIso perduodama iš išorės, kad funkciją būtų galima testuoti su bet kuria data.
// Netinkama todayIso yra programos klaida: metama klaida, kad nepilnametis nebūtų praleistas.
export function validateRegistration(values: RegisterValues, todayIso: string): FieldErrors<keyof RegisterValues> {
  if (!isValidIsoDate(todayIso)) {
    throw new Error(`Netinkama šiandienos data: ${todayIso}`);
  }

  const candidates: Record<keyof RegisterValues, string | undefined> = {
    vardas: validateName(values.vardas),
    pavarde: validateName(values.pavarde),
    el_pastas: validateEmailField(values.el_pastas),
    telefono_nr: validatePhone(values.telefono_nr),
    gimimo_data: validateBirthDate(values.gimimo_data, todayIso),
    slaptazodis: validatePassword(values.slaptazodis),
    slaptazodis2: values.slaptazodis2 === values.slaptazodis ? undefined : lt.registerErrors.passwordsDiffer,
  };

  const errors: FieldErrors<keyof RegisterValues> = {};
  for (const field of Object.keys(candidates) as (keyof RegisterValues)[]) {
    const message = candidates[field];
    if (message) {
      errors[field] = message;
    }
  }
  return errors;
}