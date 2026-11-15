import {
  formatCountdown,
  formatDateCompact,
  formatDateLong,
  formatDateRange,
  formatDateShort,
  formatDays,
  formatMoney,
  pluralize,
} from './format';

describe('formatMoney', () => {
  it.each([
    [0, '0,00 €'],
    [45, '45,00 €'],
    [12.5, '12,50 €'],
    [1234.5, '1 234,50 €'],
    [1234567.891, '1 234 567,89 €'],
    [-20, '−20,00 €'],
  ])('%p → %s', (amount, expected) => {
    expect(formatMoney(amount)).toBe(expected);
  });
});

describe('formatDateCompact', () => {
  it('rodo dieną ir trumpą mėnesio pavadinimą', () => {
    expect(formatDateCompact('2026-10-31')).toBe('31 Spa');
    expect(formatDateCompact('2026-01-05')).toBe('5 Sau');
  });

  it('atmeta netinkamą datos formatą', () => {
    expect(() => formatDateCompact('31.10.2026')).toThrow(
      'Netinkama data',
    );
  });
});

describe('datos', () => {
  it('trumpas formatas', () => {
    expect(formatDateShort('2026-11-28')).toBe(
      'lapkričio 28 d.',
    );
    expect(formatDateShort('2027-01-05')).toBe(
      'sausio 5 d.',
    );
  });

  it('ilgas formatas su metais', () => {
    expect(formatDateLong('2026-12-02')).toBe(
      '2026 m. gruodžio 2 d.',
    );
  });

  it('laikotarpis', () => {
    expect(
      formatDateRange('2026-11-28', '2026-12-02'),
    ).toBe('lapkričio 28 d. – gruodžio 2 d.');
  });

  it('atmeta netinkamą datos formatą', () => {
    expect(() => formatDateShort('28/11/2026')).toThrow(
      'Netinkama data',
    );
  });
});

describe('pluralize / formatDays', () => {
  it.each([
    [1, '1 para'],
    [2, '2 paros'],
    [9, '9 paros'],
    [10, '10 parų'],
    [11, '11 parų'],
    [12, '12 parų'],
    [20, '20 parų'],
    [21, '21 para'],
    [22, '22 paros'],
    [30, '30 parų'],
  ])('%i → %s', (count, expected) => {
    expect(formatDays(count)).toBe(expected);
  });

  it('veikia su kitais žodžiais', () => {
    expect(
      pluralize(5, 'automobilis', 'automobiliai', 'automobilių'),
    ).toBe('automobiliai');

    expect(
      pluralize(15, 'automobilis', 'automobiliai', 'automobilių'),
    ).toBe('automobilių');
  });
});

describe('formatCountdown', () => {
  it.each([
    [600, '10:00'],
    [754, '12:34'],
    [59.9, '00:59'],
    [0, '00:00'],
    [-5, '00:00'],
  ])('%p s → %s', (seconds, expected) => {
    expect(formatCountdown(seconds)).toBe(expected);
  });
});

describe('formatMoney: netinkamos ir per didelės sumos', () => {
  it.each([[NaN], [Infinity], [-Infinity]])('%p atmetama klaida', (amount) => {
    expect(() => formatMoney(amount)).toThrow('Netinkama suma');
  });

  it.each([[1e14], [-1e14], [1e21], [Number.MAX_SAFE_INTEGER]])('%p per didelė', (amount) => {
    expect(() => formatMoney(amount)).toThrow('Per didelė suma');
  });

  it('didelė, bet dar tiksli suma formatuojama', () => {
    expect(formatMoney(90000000000000)).toBe('90 000 000 000 000,00 €');
    expect(formatMoney(-90000000000000)).toBe('−90 000 000 000 000,00 €');
  });
});

describe('formatMoney: suapvalinus iki nulio ženklo nerodoma', () => {
  it.each([[-0], [-0.001], [-0.004], [-0.0049], [0.001]])('%p → 0,00 €', (amount) => {
    expect(formatMoney(amount)).toBe('0,00 €');
  });

  it('realią neigiamą sumą palieka su minusu', () => {
    expect(formatMoney(-0.01)).toBe('−0,01 €');
    expect(formatMoney(-0.5)).toBe('−0,50 €');
    expect(formatMoney(-1234.5)).toBe('−1 234,50 €');
  });
});

describe('datos: tikrinama tikra kalendorinė data', () => {
  const functions: [string, (isoDate: string) => string][] = [
    ['formatDateShort', formatDateShort],
    ['formatDateCompact', formatDateCompact],
    ['formatDateLong', formatDateLong],
  ];

  describe.each(functions)('%s', (_name, format) => {
    it.each([
      ['2026-02-30', 'vasaris neturi 30 dienos'],
      ['2026-02-29', 'nekeliamieji metai'],
      ['2100-02-29', 'šimtmetis, nesidalijantis iš 400'],
      ['1900-02-29', 'šimtmetis, nesidalijantis iš 400'],
      ['2026-04-31', 'balandis turi 30 dienų'],
      ['2026-06-31', 'birželis turi 30 dienų'],
      ['2026-09-31', 'rugsėjis turi 30 dienų'],
      ['2026-11-31', 'lapkritis turi 30 dienų'],
      ['2026-01-32', 'sausis turi 31 dieną'],
      ['2026-13-01', 'mėnuo 13'],
      ['2026-00-10', 'mėnuo 00'],
      ['2026-11-00', 'diena 00'],
      ['2026-11-99', 'diena 99'],
    ])('atmeta %s (%s)', (isoDate) => {
      expect(() => format(isoDate)).toThrow('Netinkama data');
    });

    it.each([
      ['2024-02-29'],
      ['2000-02-29'],
      ['2026-02-28'],
      ['2026-01-31'],
      ['2026-04-30'],
      ['2026-12-31'],
      ['2026-03-29'],
    ])('priima tikrą datą %s', (isoDate) => {
      expect(() => format(isoDate)).not.toThrow();
    });
  });

  it('keliamųjų metų vasario 29 d. rodoma, nekeliamųjų – ne', () => {
    expect(formatDateShort('2024-02-29')).toBe('vasario 29 d.');
    expect(formatDateLong('2000-02-29')).toBe('2000 m. vasario 29 d.');
    expect(() => formatDateShort('2023-02-29')).toThrow('Netinkama data');
  });

  it('mėnesio paskutinės dienos rodomos teisingai', () => {
    expect(formatDateShort('2026-01-31')).toBe('sausio 31 d.');
    expect(formatDateShort('2026-04-30')).toBe('balandžio 30 d.');
    expect(formatDateCompact('2026-12-31')).toBe('31 Gru');
  });

  it('niekada nerodo žodžio „undefined“', () => {
    for (let month = 0; month <= 13; month += 1) {
      const isoDate = `2026-${String(month).padStart(2, '0')}-01`;
      let text = '';
      try {
        text = formatDateShort(isoDate) + formatDateCompact(isoDate);
      } catch {
        continue;
      }
      expect(text).not.toContain('undefined');
    }
  });
});

describe('formatDateRange per metų ribą', () => {
  it('to paties metų laikotarpis lieka be metų', () => {
    expect(formatDateRange('2026-01-01', '2026-12-31')).toBe('sausio 1 d. – gruodžio 31 d.');
    expect(formatDateRange('2026-11-28', '2026-11-28')).toBe('lapkričio 28 d. – lapkričio 28 d.');
  });

  it('kai metai skiriasi, abi datos rodomos su metais', () => {
    expect(formatDateRange('2026-12-30', '2027-01-02')).toBe(
      '2026 m. gruodžio 30 d. – 2027 m. sausio 2 d.',
    );
    expect(formatDateRange('2026-12-31', '2028-01-01')).toBe(
      '2026 m. gruodžio 31 d. – 2028 m. sausio 1 d.',
    );
  });

  it('atmeta netinkamą bet kurią datą', () => {
    expect(() => formatDateRange('2026-02-30', '2026-03-02')).toThrow('Netinkama data');
    expect(() => formatDateRange('2026-12-30', '2027-02-29')).toThrow('Netinkama data');
  });
});

describe('formatCountdown: nebaigtinės reikšmės', () => {
  it.each([[NaN], [Infinity], [-Infinity]])('%p atmetama klaida', (seconds) => {
    expect(() => formatCountdown(seconds)).toThrow('Netinkamas sekundžių skaičius');
  });

  it('baigtinės neigiamos sekundės rodomos kaip 00:00', () => {
    expect(formatCountdown(-0.5)).toBe('00:00');
    expect(formatCountdown(-3600)).toBe('00:00');
  });

  it('valandos ir ilgesni laikai nepaverčiami klaida', () => {
    expect(formatCountdown(3600)).toBe('60:00');
    expect(formatCountdown(6000)).toBe('100:00');
  });
});
