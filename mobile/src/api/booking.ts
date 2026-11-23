import { CalendarDay } from '@/features/booking/calendarLogic';
import { apiRequest } from './client';

export type CarCalendar = {
  automobilio_id: number;
  metai: number;
  menuo: number;
  siandien: string;
  dienos: CalendarDay[];
};

export type BookingRulesResponse = {
  siandien: string;
  min_paru: number;
  max_paru: number;
  grazinimas_iki_val: number;
  paemimas_nuo_val: number;
  paemimas_iki_val: number;
};

export function fetchCalendar(carId: number, year: number, month: number, signal?: AbortSignal): Promise<CarCalendar> {
  return apiRequest<CarCalendar>(`/public/cars/${carId}/calendar`, { query: { metai: year, menuo: month }, signal });
}

export function fetchBookingRules(signal?: AbortSignal): Promise<BookingRulesResponse> {
  return apiRequest<BookingRulesResponse>('/public/booking-rules', { signal });
}

export type Extra = {
  kodas: string;
  pavadinimas: string;
  aprasymas: string;
  kaina_parai: number;
};

export type QuoteLine = {
  kodas: string;
  pavadinimas: string;
  kaina_parai: number;
  suma: number;
};

export type Quote = {
  automobilio_id: number;
  date_from: string;
  date_to: string;
  paru_skaicius: number;
  kaina_parai: number;
  nuomos_suma: number;
  paslaugos: QuoteLine[];
  paslaugu_suma: number;
  viso: number;
  laisvas: boolean;
};

export function fetchExtras(signal?: AbortSignal): Promise<Extra[]> {
  return apiRequest<Extra[]>('/public/extras', { signal });
}

// Kainą skaičiuoja tik serveris; programėlė siunčia pasirinkimus ir parodo gautą išskaidymą.
export function fetchQuote(
  input: { carId: number; from: string; to: string; extras: string[] },
  signal?: AbortSignal,
): Promise<Quote> {
  return apiRequest<Quote>('/public/quote', {
    method: 'POST',
    body: { automobilio_id: input.carId, date_from: input.from, date_to: input.to, paslaugos: input.extras },
    signal,
  });
}
