import { PublicCar } from '@/api/types';
import { countActiveFilters, distinctValues, EMPTY_FILTERS, toggleFilter, toQuery } from './filters';

describe('toQuery', () => {
  it('tušti filtrai nesiunčia nieko reikšmingo', () => {
    const values = Object.values(toQuery(EMPTY_FILTERS)).filter((value) => value !== null && value !== undefined);
    expect(values).toEqual([]);
  });

  it('perduoda nustatytus filtrus serverio pavadinimais', () => {
    const query = toQuery({ ...EMPTY_FILTERS, kuro_tipas: 'elektra', max_kaina: 60, vietos_id: 2 });
    expect(query).toMatchObject({ kuro_tipas: 'elektra', max_kaina: 60, vietos_id: 2 });
  });

  it('laikotarpį siunčia tik kai nurodytos abi datos', () => {
    expect(toQuery({ ...EMPTY_FILTERS, date_from: '2026-11-28' })).not.toHaveProperty('date_from');
    expect(toQuery({ ...EMPTY_FILTERS, date_from: '2026-11-28', date_to: '2026-12-02' })).toMatchObject({
      date_from: '2026-11-28',
      date_to: '2026-12-02',
    });
  });
});

describe('countActiveFilters', () => {
  it('be filtrų – 0', () => {
    expect(countActiveFilters(EMPTY_FILTERS)).toBe(0);
  });

  it('laikotarpis skaičiuojamas kaip vienas filtras', () => {
    const filters = { ...EMPTY_FILTERS, marke: 'Toyota', date_from: '2026-11-28', date_to: '2026-12-02' };
    expect(countActiveFilters(filters)).toBe(2);
  });

  it('nebaigtas laikotarpis neskaičiuojamas', () => {
    expect(countActiveFilters({ ...EMPTY_FILTERS, date_from: '2026-11-28' })).toBe(0);
  });

  it('tuščios eilutės neskaičiuojamos, kaip ir nesiunčiamos', () => {
    const filters = { ...EMPTY_FILTERS, marke: '', kebulo_tipas: '', kuro_tipas: '', pavaru_deze: '' };
    expect(countActiveFilters(filters)).toBe(0);
    expect(countActiveFilters({ ...filters, marke: 'Toyota' })).toBe(1);
  });

  it.each([
    ['tuščia pradžia', '', '2026-12-02'],
    ['tuščia pabaiga', '2026-11-28', ''],
    ['abi tuščios', '', ''],
  ])('laikotarpis su tuščia data neskaičiuojamas ir nesiunčiamas (%s)', (_name, date_from, date_to) => {
    const filters = { ...EMPTY_FILTERS, date_from, date_to };
    expect(countActiveFilters(filters)).toBe(0);
    expect(toQuery(filters)).not.toHaveProperty('date_from');
    expect(toQuery(filters)).not.toHaveProperty('date_to');
  });
});

describe('toggleFilter', () => {
  it('įjungia, pakeičia ir išjungia filtrą', () => {
    const on = toggleFilter(EMPTY_FILTERS, 'kuro_tipas', 'elektra');
    expect(on.kuro_tipas).toBe('elektra');
    expect(toggleFilter(on, 'kuro_tipas', 'hibridas').kuro_tipas).toBe('hibridas');
    expect(toggleFilter(on, 'kuro_tipas', 'elektra').kuro_tipas).toBeNull();
  });

  it('nekeičia pradinio objekto', () => {
    toggleFilter(EMPTY_FILTERS, 'sedimos_vietos', 5);
    expect(EMPTY_FILTERS.sedimos_vietos).toBeNull();
  });

  it('nekeičia jau užpildyto pradinio objekto nei keičiant, nei išjungiant filtrą', () => {
    const filled = { ...EMPTY_FILTERS, kuro_tipas: 'elektra', max_kaina: 60, date_from: '2026-11-28', date_to: '2026-12-02' };
    const snapshot = { ...filled };

    const changed = toggleFilter(filled, 'kuro_tipas', 'hibridas');
    const cleared = toggleFilter(filled, 'max_kaina', 60);

    expect(filled).toEqual(snapshot);
    expect(changed).not.toBe(filled);
    expect(cleared).not.toBe(filled);
    expect(changed).toEqual({ ...snapshot, kuro_tipas: 'hibridas' });
    expect(cleared).toEqual({ ...snapshot, max_kaina: null });
  });
});

describe('distinctValues', () => {
  it('grąžina unikalias reikšmes lietuviška abėcėlės tvarka', () => {
    const cars = [{ marke: 'Škoda' }, { marke: 'Audi' }, { marke: 'Toyota' }, { marke: 'Audi' }] as PublicCar[];
    expect(distinctValues(cars, 'marke')).toEqual(['Audi', 'Škoda', 'Toyota']);
  });

  it('naudoja lietuvišką, ne anglišką rikiavimą', () => {
    const cars = [{ marke: 'Jaguar' }, { marke: 'Yamaha' }, { marke: 'Isuzu' }] as PublicCar[];
    const english = ['Jaguar', 'Yamaha', 'Isuzu'].sort((first, second) => first.localeCompare(second, 'en'));
    // Lietuviškame rikiavime „y“ laikoma „i“ atmaina (eina prieš „j“), todėl „Yamaha“ patenka tarp „I“
    // reikšmių, o angliškame – į sąrašo galą.
    expect(distinctValues(cars, 'marke')).toEqual(['Yamaha', 'Isuzu', 'Jaguar']);
    expect(distinctValues(cars, 'marke')).not.toEqual(english);
  });
});
