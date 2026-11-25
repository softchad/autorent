import { PublicCar } from '@/api/types';

export type SortOrder = 'recommended' | 'price_asc' | 'price_desc' | 'newest' | 'power';

export const SORT_ORDERS: SortOrder[] = ['recommended', 'price_asc', 'price_desc', 'newest', 'power'];

type Comparator = (first: PublicCar, second: PublicCar) => number;

const COMPARATORS: Record<Exclude<SortOrder, 'recommended'>, Comparator> = {
  price_asc: (first, second) => first.kaina_parai - second.kaina_parai,
  price_desc: (first, second) => second.kaina_parai - first.kaina_parai,
  newest: (first, second) => second.metai - first.metai,
  power: (first, second) => second.galia_kw - first.galia_kw,
};

// Rikiuoja jau užkrautą sąrašą telefone (serveris grąžina nuo pigiausio).
// Lygias reikšmes skiria automobilio ID, kad tvarka tarp atnaujinimų nešokinėtų.
export function sortCars(cars: PublicCar[], order: SortOrder): PublicCar[] {
  if (order === 'recommended') {
    if (cars.length === 0) return [];
    const prices = cars.map((car) => car.kaina_parai);
    const years = cars.map((car) => car.metai);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const minYear = Math.min(...years);
    const maxYear = Math.max(...years);
    const score = (car: PublicCar) => {
      const price = maxPrice > minPrice ? 1 - (car.kaina_parai - minPrice) / (maxPrice - minPrice) : 1;
      const year = maxYear > minYear ? (car.metai - minYear) / (maxYear - minYear) : 1;
      return price * 0.6 + year * 0.4;
    };
    const ranked = [...cars].sort((first, second) => score(second) - score(first) || first.automobilio_id - second.automobilio_id);
    const models = new Set<string>();
    const picks: PublicCar[] = [];
    const remaining: PublicCar[] = [];
    for (const car of ranked) {
      const model = JSON.stringify([car.marke, car.modelis]);
      if (models.has(model)) {
        remaining.push(car);
      } else {
        models.add(model);
        picks.push(car);
      }
    }
    return [...picks, ...remaining];
  }
  const compare = COMPARATORS[order];
  return [...cars].sort((first, second) => compare(first, second) || first.automobilio_id - second.automobilio_id);
}
