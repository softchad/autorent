import { colors, textPairs } from './colors';
import {
  contrastRatio,
  meetsAA,
  relativeLuminance,
} from './contrast';

describe('relativeLuminance', () => {
  it('juoda = 0, balta = 1', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#FFFFFF')).toBeCloseTo(1, 5);
  });

  it('atmeta netinkamą spalvos formatą', () => {
    expect(() => relativeLuminance('#FFF')).toThrow(
      'Netinkama spalva',
    );

    expect(() => relativeLuminance('red')).toThrow(
      'Netinkama spalva',
    );
  });
});

describe('contrastRatio', () => {
  it('juoda ant baltos = 21:1', () => {
    expect(
      contrastRatio('#000000', '#FFFFFF'),
    ).toBeCloseTo(21, 1);
  });

  it('nepriklauso nuo argumentų tvarkos', () => {
    expect(
      contrastRatio('#0F597B', '#FFFFFF'),
    ).toBeCloseTo(
      contrastRatio('#FFFFFF', '#0F597B'),
      5,
    );
  });

  it('#767676 ant baltos yra ties AA riba', () => {
    expect(
      contrastRatio('#767676', '#FFFFFF'),
    ).toBeCloseTo(4.54, 1);
  });
});

describe('meetsAA', () => {
  it('dideliam tekstui taiko 3:1 ribą', () => {
    expect(
      meetsAA('#949494', '#FFFFFF'),
    ).toBe(false);

    expect(
      meetsAA('#949494', '#FFFFFF', true),
    ).toBe(true);
  });
});

describe('paletė', () => {
  it.each(textPairs)(
    '$text ant $background atitinka AA (4.5:1)',
    ({ text, background }) => {
      expect(
        contrastRatio(colors[text], colors[background]),
      ).toBeGreaterThanOrEqual(4.5);
    },
  );

  it('kontūras išlaiko pasirinktą dekoratyvinę 1.5:1 ribą', () => {
    const backgrounds = [
      colors.background,
      colors.surfaceAlt,
      colors.surface,
      colors.surfaceRaised,
    ];

    for (const background of backgrounds) {
      expect(
        contrastRatio(colors.borderStrong, background),
      ).toBeGreaterThanOrEqual(1.5);
    }
  });

  it('pasirinkimo spalva turi bent 3:1 kontrastą', () => {
    const backgrounds = [
      colors.background,
      colors.surfaceAlt,
      colors.surface,
      colors.neutralSoft,
    ];

    for (const background of backgrounds) {
      expect(
        contrastRatio(colors.primary, background),
      ).toBeGreaterThanOrEqual(3);
    }
  });

  it('fonai tamsūs, tekstas šviesus', () => {
    const backgrounds = [
      colors.background,
      colors.surfaceAlt,
      colors.surface,
      colors.surfaceRaised,
      colors.neutralSoft,
    ];

    for (const background of backgrounds) {
      expect(
        relativeLuminance(background),
      ).toBeLessThan(0.05);
    }

    expect(
      relativeLuminance(colors.text),
    ).toBeGreaterThan(0.8);
  });

  it('prekės ženklo spalvos sutampa su svetainės', () => {
    expect(colors.background).toBe('#0B121F');
    expect(colors.surface).toBe('#1A2238');
    expect(colors.brand).toBe('#0F597B');
    expect(colors.accent).toBe('#FF7A1A');
    expect(colors.accentPressed).toBe('#FF8C3D');
  });
});