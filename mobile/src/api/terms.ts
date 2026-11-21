import { apiRequest } from './client';
import { RentalInfo } from './types';

// Draudimo ir kelionių į užsienį sąlygos iš serverio; dabar rodomos automobilio ekrane.
export function fetchRentalInfo(signal?: AbortSignal): Promise<RentalInfo> {
  return apiRequest<RentalInfo>('/public/rental-info', { signal });
}
