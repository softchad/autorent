import { ApiError, toUserMessage } from '@/api/errors';
import { SupportConversationDetail, SupportStatus } from '@/api/types';
import { BadgeTone } from '@/components/Badge';
import { lt } from '@/i18n/lt';

// Ribos sutampa su serverio (support_service.py): tema 3–150, žinutė 1–5000 simbolių.
// Serveris ilgį skaičiuoja Unicode kodo taškais po Python str.strip(), todėl čia skaičiuojama taip pat.
export const SUBJECT_MIN = 3;
export const SUBJECT_MAX = 150;
export const MESSAGE_MAX = 5000;

// Kategorijų kodai tokie patys kaip serveryje.
export const SUPPORT_CATEGORIES = ['rezervacija', 'atsiemimas_grazinimas', 'automobilis', 'saskaita', 'paskyra', 'kita'] as const;
export type SupportCategory = (typeof SUPPORT_CATEGORIES)[number];

// Simboliai, kuriuos Python str.strip() laiko tarpais (JS trim() rinkinys skiriasi: \x1c–\x1f, \x85, ﻿).
const PY_WHITESPACE = String.raw`[\t\n\v\f\r\x1c-\x1f \x85\xa0  -     　]`;
const PY_STRIP = new RegExp(`^${PY_WHITESPACE}+|${PY_WHITESPACE}+$`, 'g');
// Su „u“ vėliava sveika surogatinė pora yra vienas kodo taškas, todėl atitinka tik pavienis surogatas.
const LONE_SURROGATE = /[\uD800-\uDFFF]/u;

// Pašalina tarpus kraštuose taip pat, kaip serveris.
export function stripLikeServer(value: string): string {
  return value.replace(PY_STRIP, '');
}

// Ilgis Unicode kodo taškais (emoji – vienas, ne du UTF-16 vienetai).
export function codePointLength(value: string): number {
  return Array.from(value).length;
}

// Grąžina klaidos tekstą arba null, jei reikšmė tinkama.
export function validateSubject(subject: string): string | null {
  if (LONE_SURROGATE.test(subject)) {
    return lt.support.errors.invalidCharacters;
  }
  const length = codePointLength(stripLikeServer(subject));
  if (length < SUBJECT_MIN) {
    return lt.support.errors.subjectTooShort;
  }
  if (length > SUBJECT_MAX) {
    return lt.support.errors.subjectTooLong;
  }
  return null;
}

export function validateMessage(message: string): string | null {
  if (LONE_SURROGATE.test(message)) {
    return lt.support.errors.invalidCharacters;
  }
  const length = codePointLength(stripLikeServer(message));
  if (length === 0) {
    return lt.support.errors.messageRequired;
  }
  if (length > MESSAGE_MAX) {
    return lt.support.errors.messageTooLong;
  }
  return null;
}

// Pokalbio numeris iš maršruto: tik teigiamas sveikasis skaičius dešimtainiu pavidalu ir saugaus dydžio.
export function parseConversationId(value: unknown): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

const STATUS_TONES: Record<SupportStatus, BadgeTone> = {
  atvira: 'info',
  sprendziama: 'info',
  laukiama_kliento: 'warning',
  isspresta: 'success',
};

function isKnownStatus(status: string): status is SupportStatus {
  return Object.prototype.hasOwnProperty.call(STATUS_TONES, status);
}

// Nežinoma būsena (jei serveryje atsirastų nauja) rodoma neutraliai, o ne paslepiama.
export function statusBadge(status: string): { label: string; tone: BadgeTone } {
  if (isKnownStatus(status)) {
    return { label: lt.support.status[status], tone: STATUS_TONES[status] };
  }
  return { label: status, tone: 'neutral' };
}

// Paskutinės žinutės numeris – jo reikia pažymint pokalbį perskaitytu.
export function lastMessageId(conversation: SupportConversationDetail): number | null {
  const last = conversation.zinutes[conversation.zinutes.length - 1];
  return last ? last.zinutes_id : null;
}

// '2026-11-19T10:15:00' → '10:15'. Laikas rodomas toks, kokį grąžino serveris.
export function messageTime(isoDateTime: string): string {
  return isoDateTime.slice(11, 16);
}

// Pagalbos srautų klaidos tekstas: serverio „detail“ nerodomas (jis gali būti techninis ar angliškas).
export function supportErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return toUserMessage(error);
  }
  if (error.kind === 'not_found') {
    return lt.support.notFound;
  }
  if (error.kind === 'validation') {
    return lt.support.errors.rejected;
  }
  return toUserMessage(new ApiError(error.kind, error.status));
}
