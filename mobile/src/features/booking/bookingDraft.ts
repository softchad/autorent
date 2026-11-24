import { Quote } from '@/api/booking';
import { diffDays, isBefore, isValidIsoDate } from '@/utils/isoDate';
import { EMPTY_SELECTION, Selection } from './calendarLogic';
import { PriceState } from './priceRequest';

// Kliento pasirinkimai, kuriuos datų ekranas perduoda patvirtinimo ekranui.
export type BookingDraft = {
  carId: number;
  from: string;
  to: string;
  pickupHour: number;
  extras: string[];
};

// Paslaugos pažymėjimas / atžymėjimas; grąžina naują sąrašą.
export function toggleExtra(selected: string[], code: string): string[] {
  return selected.includes(code) ? selected.filter((item) => item !== code) : [...selected, code];
}

// Paėmimo valandų pasirinkimai pagal serverio taisykles, pvz. 12…18.
export function pickupHours(fromHour: number, toHour: number): number[] {
  const hours: number[] = [];
  for (let hour = fromHour; hour <= toHour; hour += 1) {
    hours.push(hour);
  }
  return hours;
}

// Tęsti galima tik turint pilną laikotarpį ir serverio patvirtintą kainą laisvam automobiliui.
export function canContinue(selection: Selection, price: PriceState<Quote>): boolean {
  return Boolean(selection.from && selection.to && price.status === 'ready' && price.quote?.laisvas);
}

// Laikotarpis, atkeliavęs iš katalogo paieškos. Priimamas tik jei datos tinkamos, ne praeityje
// ir trukmė telpa į nuomos ribas; kitu atveju klientas datas renkasi kalendoriuje pats.
export function selectionFromSearch(
  from: string | undefined,
  to: string | undefined,
  rules: { siandien: string; min_paru: number; max_paru: number },
): Selection {
  if (!from || !to || !isValidIsoDate(from) || !isValidIsoDate(to) || isBefore(from, rules.siandien)) {
    return EMPTY_SELECTION;
  }
  const days = diffDays(from, to);
  if (days < rules.min_paru || days > rules.max_paru) {
    return EMPTY_SELECTION;
  }
  return { from, to };
}

// Maršruto parametrai yra tekstai, todėl juodraštis verčiamas į tekstus ir atgal.
export function draftToParams(draft: BookingDraft): Record<string, string> {
  return {
    carId: String(draft.carId),
    from: draft.from,
    to: draft.to,
    pickupHour: String(draft.pickupHour),
    extras: draft.extras.join(','),
  };
}

// Serveris priima ne daugiau kaip 10 paslaugų.
export const MAX_DRAFT_EXTRAS = 10;

// Struktūrinė patikra be serverio taisyklių: saugus teigiamas ID, egzistuojančios datos (from < to),
// sveika valanda, iki 10 netuščių nesikartojančių paslaugų. Pakartotas parametras (masyvas) nepriimamas.
export function draftFromParams(params: Partial<Record<string, string | string[]>>): BookingDraft | null {
  const text = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : null);
  const [carText, from, to, hourText] = ['carId', 'from', 'to', 'pickupHour'].map(text);
  // Tuščias paslaugų parametras maršrute gali būti praleistas – tai reiškia „be paslaugų“.
  const extrasText = params.extras === undefined ? '' : text('extras');
  if (carText === null || from === null || to === null || hourText === null || extrasText === null) {
    return null;
  }
  const carId = /^[1-9]\d*$/.test(carText) ? Number(carText) : Number.NaN;
  const pickupHour = /^\d{1,2}$/.test(hourText) ? Number(hourText) : Number.NaN;
  if (!Number.isSafeInteger(carId) || !Number.isInteger(pickupHour)) {
    return null;
  }
  if (!isValidIsoDate(from) || !isValidIsoDate(to) || !isBefore(from, to)) {
    return null;
  }
  const extras = extrasText === '' ? [] : extrasText.split(',');
  if (extras.length > MAX_DRAFT_EXTRAS || extras.includes('') || new Set(extras).size !== extras.length) {
    return null;
  }
  return { carId, from, to, pickupHour, extras };
}

// Patikra pagal serverio taisykles; kviečiama gavus jas, prieš kuriant laikymą.
export function draftMatchesRules(
  draft: BookingDraft,
  rules: { siandien: string; min_paru: number; max_paru: number; paemimas_nuo_val: number; paemimas_iki_val: number },
): boolean {
  const days = diffDays(draft.from, draft.to);
  return (
    !isBefore(draft.from, rules.siandien) &&
    days >= rules.min_paru &&
    days <= rules.max_paru &&
    draft.pickupHour >= rules.paemimas_nuo_val &&
    draft.pickupHour <= rules.paemimas_iki_val
  );
}
