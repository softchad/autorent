import { fonts } from './fonts';
import {
  brandKey,
  getCarPhoto,
  hasOwnCarPhoto,
} from './images';
import { MIN_TOUCH_SIZE, radius } from './spacing';
import { typography } from './typography';

describe('brandKey', () => {
  it.each([
    ['Toyota', 'toyota'],
    ['  BMW ', 'bmw'],
    ['Škoda', 'skoda'],
    ['Skoda', 'skoda'],
    ['Mercedes-Benz', 'mercedes'],
    ['Land Rover', 'land'],
  ])('%p → %p', (brand, expected) => {
    expect(brandKey(brand)).toBe(expected);
  });
});

describe('getCarPhoto', () => {
  it('žinoma markė turi savo nuotrauką', () => {
    expect(hasOwnCarPhoto('Audi')).toBe(true);

    expect(getCarPhoto('Audi')).toBe(
      getCarPhoto('audi'),
    );
  });

  it('nežinoma markė gauna bendrą nuotrauką', () => {
    expect(hasOwnCarPhoto('Lada')).toBe(false);
    expect(getCarPhoto('Lada')).toBeDefined();

    expect(getCarPhoto('Lada')).toBe(
      getCarPhoto('Moskvich'),
    );
  });
});

describe('tipografija', () => {
  it('visi stiliai naudoja Lexend šriftą', () => {
    const families = Object.values(fonts) as string[];

    for (const style of Object.values(typography)) {
      expect(families).toContain(style.fontFamily);
    }
  });

  it('teksto dydžiai ne mažesni nei 12', () => {
    for (const style of Object.values(typography)) {
      expect(style.fontSize).toBeGreaterThanOrEqual(12);
    }
  });
});

describe('matmenys', () => {
  it('kortelių kampai 28–32, lietimo sritis 44', () => {
    expect(radius.card).toBeGreaterThanOrEqual(28);
    expect(radius.card).toBeLessThanOrEqual(32);
    expect(MIN_TOUCH_SIZE).toBe(44);
  });
});