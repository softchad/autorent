import { apiRequest } from './client';

export type Coordinates = { lat: number; lng: number };

// Adreso vertimas koordinatėmis per esamą AutoRent serverio endpointą (serveris kreipiasi į Nominatim ir talpina rezultatus).
// Siunčiamas tik padalinio adresas.
export function geocodeAddress(address: string, signal?: AbortSignal): Promise<Coordinates> {
  return apiRequest<Coordinates>('/public/geocode', {
    method: 'POST',
    body: { adresas: address },
    signal,
    // Serveris Nominatim užklausas rikiuoja į eilę (1 per sekundę), todėl laukiame ilgiau.
    timeoutMs: 20000,
  });
}
