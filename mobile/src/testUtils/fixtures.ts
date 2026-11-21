// Tik testams: pavyzdiniai duomenys tokios formos, kokią grąžina serveris.
import { PublicCar } from '@/api/types';

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
