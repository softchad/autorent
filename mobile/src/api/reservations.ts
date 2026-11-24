import { apiRequest } from './client';
import { CustomerReservation } from './types';

// Serveris grąžina tik prisijungusio kliento rezervacijas (klientą nustato pagal tokeną).
export function fetchReservations(signal?: AbortSignal): Promise<CustomerReservation[]> {
  return apiRequest<CustomerReservation[]>('/customer/reservations', { auth: true, signal });
}

export function fetchReservation(reservationId: number, signal?: AbortSignal): Promise<CustomerReservation> {
  return apiRequest<CustomerReservation>(`/customer/reservations/${reservationId}`, { auth: true, signal });
}

// expectedFee – mokestis, kurį klientas matė patvirtinimo lange; jei serveryje jis jau kitoks, atšaukimas nevykdomas.
export function cancelReservation(reservationId: number, expectedFee: number): Promise<CustomerReservation> {
  return apiRequest<CustomerReservation>(`/customer/reservations/${reservationId}/cancel`, {
    method: 'POST',
    auth: true,
    body: { tiketinas_mokestis: expectedFee },
  });
}
