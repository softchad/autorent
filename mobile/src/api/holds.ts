import { apiRequest } from './client';

export type Hold = {
  laikymo_id: number;
  automobilio_id: number;
  pradzia: string;
  pabaiga: string;
  busena: 'aktyvus' | 'panaudotas' | 'atsauktas' | 'pasibaiges';
  galioja_iki: string;
  serverio_laikas: string;
  liko_sekundziu: number;
};

// Serveris gali grąžinti iki 6 trupmenos skaitmenų, o ECMAScript datų formatas apibrėžia tik 3 –
// ilgesnę eilutę skirtingi JavaScript varikliai gali perskaityti skirtingai. Trupmena trumpinama iki milisekundžių.
function trimFraction(iso: string): string {
  return iso.replace(/(\.\d{3})\d+/, '$1');
}

function normalizeHold(hold: Hold): Hold {
  return { ...hold, galioja_iki: trimFraction(hold.galioja_iki), serverio_laikas: trimFraction(hold.serverio_laikas) };
}

export function createHold(input: { carId: number; from: string; to: string }, signal?: AbortSignal): Promise<Hold> {
  return apiRequest<Hold>('/customer/holds', {
    method: 'POST',
    auth: true,
    body: { automobilio_id: input.carId, date_from: input.from, date_to: input.to },
    signal,
  }).then(normalizeHold);
}

export function fetchHold(holdId: number, signal?: AbortSignal): Promise<Hold> {
  return apiRequest<Hold>(`/customer/holds/${holdId}`, { auth: true, signal }).then(normalizeHold);
}

export function releaseHold(holdId: number): Promise<null> {
  return apiRequest<null>(`/customer/holds/${holdId}`, { method: 'DELETE', auth: true });
}
