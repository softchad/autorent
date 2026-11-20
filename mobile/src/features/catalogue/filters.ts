import { QueryParams } from '@/api/client';
import { PublicCar } from '@/api/types';

// Filtrų būsena programėlėje. null reiškia „filtras nenustatytas“.
export type CatalogueFilters = {
  marke: string | null;
  kebulo_tipas: string | null;
  kuro_tipas: string | null;
  pavaru_deze: string | null;
  max_kaina: number | null;
  sedimos_vietos: number | null;
  vietos_id: number | null;
  date_from: string | null;
  date_to: string | null;
};

export const EMPTY_FILTERS: CatalogueFilters = {
  marke: null,
  kebulo_tipas: null,
  kuro_tipas: null,
  pavaru_deze: null,
  max_kaina: null,
  sedimos_vietos: null,
  vietos_id: null,
  date_from: null,
  date_to: null,
};

// Reikšmės sutampa su DB ENUM (database/schema.sql).
export const FUEL_OPTIONS = ['benzinas', 'dyzelinas', 'elektra', 'hibridas', 'dujos'] as const;
export const GEARBOX_OPTIONS = ['mechaninė', 'automatinė', 'pusiau automatinė'] as const;
export const SEAT_OPTIONS = [2, 4, 5, 7] as const;
export const MAX_PRICE_OPTIONS = [40, 60, 80, 120] as const;

// Paverčia filtrų būseną serverio užklausos parametrais.
export function toQuery(filters: CatalogueFilters): QueryParams {
  const query: QueryParams = {
    marke: filters.marke,
    kebulo_tipas: filters.kebulo_tipas,
    kuro_tipas: filters.kuro_tipas,
    pavaru_deze: filters.pavaru_deze,
    max_kaina: filters.max_kaina,
    sedimos_vietos: filters.sedimos_vietos,
    vietos_id: filters.vietos_id,
  };
  // Serveris reikalauja abiejų datų kartu; pusiau užpildyto laikotarpio nesiunčiame.
  if (filters.date_from && filters.date_to) {
    query.date_from = filters.date_from;
    query.date_to = filters.date_to;
  }
  return query;
}

// Kiek filtrų įjungta (rodoma ant „Filtrai“ mygtuko). Laikotarpis skaičiuojamas kaip vienas filtras.
// Skaičiuojami tik tie filtrai, kurie iš tikrųjų siunčiami: null ir tuščios eilutės praleidžiamos
// (jų nesiunčia ir buildUrl), o laikotarpis – tik kai abi datos netuščios, kaip toQuery.
export function countActiveFilters(filters: CatalogueFilters): number {
  const simpleKeys: (keyof CatalogueFilters)[] = [
    'marke', 'kebulo_tipas', 'kuro_tipas', 'pavaru_deze', 'max_kaina', 'sedimos_vietos', 'vietos_id',
  ];
  const simpleCount = simpleKeys.filter((key) => filters[key] !== null && filters[key] !== '').length;
  const hasPeriod = Boolean(filters.date_from && filters.date_to);
  return simpleCount + (hasPeriod ? 1 : 0);
}

// Paspaudus jau pasirinktą reikšmę filtras išjungiamas, kitaip – pakeičiamas.
export function toggleFilter<Key extends keyof CatalogueFilters>(
  filters: CatalogueFilters,
  key: Key,
  value: NonNullable<CatalogueFilters[Key]>,
): CatalogueFilters {
  const next = filters[key] === value ? null : value;
  return { ...filters, [key]: next };
}

// Unikalių reikšmių sąrašas pasirinkimams (pvz. markės, kėbulo tipai) iš užkrautų automobilių.
export function distinctValues(cars: PublicCar[], field: 'marke' | 'kebulo_tipas'): string[] {
  const unique = new Set(cars.map((car) => car[field]));
  return [...unique].sort((first, second) => first.localeCompare(second, 'lt'));
}
