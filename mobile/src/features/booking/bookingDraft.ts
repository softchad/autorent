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

export function draftFromParams(params: Partial<Record<string, string | string[]>>): BookingDraft | null {
  const text = (key: string) => (typeof params[key] === 'string' ? (params[key] as string) : '');
  const carId = Number(text('carId'));
  const pickupHour = Number(text('pickupHour'));
  const isDate = (value: string) => /^\d{4}-\d{2}-\d{2}$/.test(value);
  if (!Number.isInteger(carId) || carId <= 0 || !isDate(text('from')) || !isDate(text('to')) || !Number.isInteger(pickupHour)) {
    return null;
  }
  const extras = text('extras') === '' ? [] : text('extras').split(',');
  return { carId, from: text('from'), to: text('to'), pickupHour, extras };
}
