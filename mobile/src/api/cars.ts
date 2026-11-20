import { apiRequest, QueryParams } from './client';
import { Location, PublicCar } from './types';

// Katalogo sąrašas; query – filtrai tokiais pavadinimais, kokių laukia serveris.
export function fetchCars(query: QueryParams, signal?: AbortSignal): Promise<PublicCar[]> {
  return apiRequest<PublicCar[]>('/public/cars', { query, signal });
}

// Vienas automobilis; su datomis serveris pasako, ar jis laisvas tuo laikotarpiu.
export function fetchCar(
  carId: number,
  period?: { date_from: string; date_to: string },
  signal?: AbortSignal,
): Promise<PublicCar> {
  return apiRequest<PublicCar>(`/public/cars/${carId}`, { query: period, signal });
}

export function fetchLocations(signal?: AbortSignal): Promise<Location[]> {
  return apiRequest<Location[]>('/public/locations', { signal });
}
