// Tik testams: pavyzdiniai duomenys tokios formos, kokią grąžina serveris.
import { Quote } from '@/api/booking';
import { Hold } from '@/api/holds';
import { CustomerReservation, PublicCar, Terms } from '@/api/types';

// Vienas nuoseklus rezervacijos pavyzdys: automobilis 12 (45 €/parą), 2026-12-01 – 2026-12-05 (4 paros),
// paėmimas 14 val., paslauga „pilna_apsauga“ (12 €/parą): 180 + 48 = 228 €.
export const BOOKING_DRAFT = { carId: 12, from: '2026-12-01', to: '2026-12-05', pickupHour: 14, extras: ['pilna_apsauga'] };

export const BOOKING_RULES = {
  siandien: '2026-11-28',
  min_paru: 1,
  max_paru: 30,
  grazinimas_iki_val: 10,
  paemimas_nuo_val: 12,
  paemimas_iki_val: 18,
};

export function makeTerms(overrides: Partial<Terms> = {}): Terms {
  return {
    versija: '2026-11-24',
    skyriai: [{ kodas: 'atsaukimas', pavadinimas: 'Atšaukimas', punktai: ['Dėl rezervacijos atšaukimo kreipkitės į padalinį.'] }],
    ...overrides,
  };
}

// Viešas pasiūlymas: kliento paties laikymas automobilį užima, todėl laisvas – false.
export function makeQuote(overrides: Partial<Quote> = {}): Quote {
  return {
    automobilio_id: 12,
    date_from: '2026-12-01',
    date_to: '2026-12-05',
    paru_skaicius: 4,
    kaina_parai: 45,
    nuomos_suma: 180,
    paslaugos: [{ kodas: 'pilna_apsauga', pavadinimas: 'Pilna apsauga', kaina_parai: 12, suma: 48 }],
    paslaugu_suma: 48,
    viso: 228,
    laisvas: false,
    ...overrides,
  };
}

export function makeHold(overrides: Partial<Hold> = {}): Hold {
  return {
    laikymo_id: 77,
    automobilio_id: 12,
    pradzia: '2026-12-01',
    pabaiga: '2026-12-05',
    busena: 'aktyvus',
    galioja_iki: '2026-11-28T09:10:00.000Z',
    serverio_laikas: '2026-11-28T09:00:30.000Z',
    liko_sekundziu: 570,
    ...overrides,
  };
}

export function makeReservation(overrides: Partial<CustomerReservation> = {}): CustomerReservation {
  return {
    rezervacijos_id: 501,
    automobilio_id: 12,
    marke: 'Toyota',
    modelis: 'Corolla',
    rezervacijos_pradzia: '2026-12-01',
    rezervacijos_pabaiga: '2026-12-05',
    busena: 'laukia',
    dienu_skaicius: 4,
    kaina_parai: 45,
    viso_kaina: 228,
    paemimo_valanda: 14,
    salygu_versija: '2026-11-24',
    paslaugos: [{ kodas: 'pilna_apsauga', pavadinimas: 'Pilna apsauga', kaina_parai: 12, suma: 48 }],
    ...overrides,
  };
}

export function makeCar(overrides: Partial<PublicCar> = {}): PublicCar {
  return {
    automobilio_id: 12,
    marke: 'Toyota',
    modelis: 'Corolla',
    metai: 2022,
    spalva: 'Pilka',
    kebulo_tipas: 'Sedanas',
    pavaru_deze: 'automatinė',
    variklio_turis: 1.8,
    galia_kw: 103,
    kuro_tipas: 'hibridas',
    rida: 20000,
    sedimos_vietos: 5,
    klimato_kontrole: true,
    navigacija: true,
    kaina_parai: 45,
    automobilio_statusas: 'laisvas',
    lokacija: { vietos_id: 1, pavadinimas: 'Vilnius Centras', adresas: 'Gedimino pr. 1, Vilnius', miestas: 'Vilnius' },
    laisvas_pasirinktu_laikotarpiu: null,
    ...overrides,
  };
}
