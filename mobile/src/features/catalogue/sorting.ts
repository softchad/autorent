import { PublicCar } from '@/api/types';

export type SortOrder = 'price_asc' | 'price_desc' | 'newest' | 'power';

export const SORT_ORDERS: SortOrder[] = ['price_asc', 'price_desc', 'newest', 'power'];

type Comparator = (first: PublicCar, second: PublicCar) => number;

const COMPARATORS: Record<SortOrder, Comparator> = {
  price_asc: (first, second) => first.kaina_parai - second.kaina_parai,
  price_desc: (first, second) => second.kaina_parai - first.kaina_parai,
  newest: (first, second) => second.metai - first.metai,
  power: (first, second) => second.galia_kw - first.galia_kw,
};

// Rikiuoja jau užkrautą sąrašą telefone (serveris grąžina nuo pigiausio).
// Lygias reikšmes skiria automobilio ID, kad tvarka tarp atnaujinimų nešokinėtų.
export function sortCars(cars: PublicCar[], order: SortOrder): PublicCar[] {
  const compare = COMPARATORS[order];
  return [...cars].sort((first, second) => compare(first, second) || first.automobilio_id - second.automobilio_id);
}
