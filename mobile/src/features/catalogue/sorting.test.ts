import { PublicCar } from '@/api/types';
import { SORT_ORDERS, SortOrder, sortCars } from './sorting';

const car = (id: number, kaina_parai: number, metai: number, galia_kw: number) =>
  ({ automobilio_id: id, kaina_parai, metai, galia_kw }) as PublicCar;

const CARS = [car(1, 60, 2021, 110), car(2, 35, 2019, 66), car(3, 90, 2023, 150), car(4, 35, 2022, 81)];
const ids = (cars: PublicCar[]) => cars.map((item) => item.automobilio_id);

describe('sortCars', () => {
  it('pigiausi pirmi; vienodą kainą skiria ID', () => {
    expect(ids(sortCars(CARS, 'price_asc'))).toEqual([2, 4, 1, 3]);
  });

  it('brangiausi pirmi', () => {
    expect(ids(sortCars(CARS, 'price_desc'))).toEqual([3, 1, 2, 4]);
  });

  it('naujausi pirmi', () => {
    expect(ids(sortCars(CARS, 'newest'))).toEqual([3, 4, 1, 2]);
  });

  it('galingiausi pirmi', () => {
    expect(ids(sortCars(CARS, 'power'))).toEqual([3, 1, 4, 2]);
  });

  it('nekeičia pradinio sąrašo', () => {
    sortCars(CARS, 'price_desc');
    expect(ids(CARS)).toEqual([1, 2, 3, 4]);
  });
});

// Įvestyje vienodos reikšmės sudėtos didesnio ID tvarka pirmiau, todėl stabilus rikiavimas be ID
// jų tvarkos nepakeistų ir testas kristų.
describe('sortCars – vienodas reikšmes skiria ID didėjimo tvarka', () => {
  const cases: [SortOrder, PublicCar[], number[]][] = [
    ['price_asc', [car(8, 50, 2020, 100), car(3, 50, 2021, 90), car(6, 70, 2019, 80)], [3, 8, 6]],
    ['price_desc', [car(8, 50, 2020, 100), car(3, 50, 2021, 90), car(6, 30, 2019, 80)], [3, 8, 6]],
    ['newest', [car(7, 40, 2022, 80), car(2, 55, 2022, 95), car(5, 30, 2020, 70)], [2, 7, 5]],
    ['power', [car(9, 40, 2020, 120), car(1, 60, 2018, 120), car(4, 50, 2023, 90)], [1, 9, 4]],
  ];

  it.each(cases)('%s', (order, input, expected) => {
    expect(ids(sortCars(input, order))).toEqual(expected);
  });
});

describe('sortCars – kraštiniai atvejai ir nekeitimas', () => {
  it.each(SORT_ORDERS)('tuščias sąrašas grąžina naują tuščią masyvą (%s)', (order) => {
    const empty: PublicCar[] = [];
    const result = sortCars(empty, order);
    expect(result).toEqual([]);
    expect(result).not.toBe(empty);
  });

  it.each(SORT_ORDERS)('vienas elementas grąžinamas naujame masyve su ta pačia nuoroda (%s)', (order) => {
    const only = [car(5, 40, 2020, 90)];
    const result = sortCars(only, order);
    expect(result).not.toBe(only);
    expect(result).toHaveLength(1);
    expect(result[0]).toBe(only[0]);
  });

  it.each(SORT_ORDERS)('nekeičia pradinio sąrašo ir objektų, grąžina tas pačias nuorodas (%s)', (order) => {
    const input = [car(4, 35, 2022, 81), car(2, 35, 2019, 66), car(3, 90, 2023, 150), car(1, 60, 2021, 110)];
    const originalOrder = [...input];
    const originalValues = input.map((item) => ({ ...item }));

    const result = sortCars(input, order);

    expect(result).not.toBe(input);
    expect(input).toEqual(originalValues);
    input.forEach((item, index) => expect(item).toBe(originalOrder[index]));
    expect(result).toHaveLength(input.length);
    result.forEach((item) => expect(input).toContain(item));
    expect(new Set(result).size).toBe(input.length);
  });
});
