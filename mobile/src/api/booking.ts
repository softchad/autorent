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
