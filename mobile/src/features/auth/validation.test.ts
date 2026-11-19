import {
  hasErrors,
  isValidEmail,
  validateLogin,
  RegisterValues,
  codePointLength,
  hasLoneSurrogate,
  utf8ByteLength,
  validateRegistration,
} from './validation';

describe('isValidEmail', () => {
  it.each([
    'jonas@example.com',
    ' jonas.petrauskas@pastas.lt ',
    'a@b.co',
  ])('priima %p', (email) => {
    expect(isValidEmail(email)).toBe(true);
  });

  it.each([
    '',
    'jonas',
    'jonas@',
    '@example.com',
    'jonas@example',
    'jo nas@example.com',
  ])('atmeta %p', (email) => {
    expect(isValidEmail(email)).toBe(false);
  });
});

describe('validateLogin', () => {
  it('teisingiems duomenims klaidų nėra', () => {
    const errors = validateLogin({
      email: 'jonas@example.com',
      password: 'Slaptas123!',
    });

    expect(hasErrors(errors)).toBe(false);
  });

  it('tuštiems laukams grąžina abi klaidas', () => {
    const errors = validateLogin({
      email: '  ',
      password: '',
    });

    expect(errors).toEqual({
      email: 'Įveskite el. pašto adresą',
      password: 'Įveskite slaptažodį',
    });

    expect(hasErrors(errors)).toBe(true);
  });

  it('neteisingam el. paštui grąžina klaidą', () => {
    expect(
      validateLogin({
        email: 'jonas@',
        password: 'x',
      }),
    ).toEqual({
      email: 'El. pašto adresas neteisingas',
    });
  });

  it('nekeičia pateiktų reikšmių', () => {
    const values = {
      email: ' Jonas@Example.com ',
      password: ' Slaptas123! ',
    };

    validateLogin(values);

    expect(values).toEqual({
      email: ' Jonas@Example.com ',
      password: ' Slaptas123! ',
    });
  });
});

const TODAY = '2026-11-18';

const VALID: RegisterValues = {
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-01-01',
  slaptazodis: 'Slaptas123!',
  slaptazodis2: 'Slaptas123!',
};

describe('validateRegistration', () => {
  it('teisingi duomenys – klaidų nėra', () => {
    expect(validateRegistration(VALID, TODAY)).toEqual({});
  });

  it('per trumpas vardas ir pavardė', () => {
    const errors = validateRegistration({ ...VALID, vardas: ' J ', pavarde: '' }, TODAY);
    expect(errors.vardas).toBe('Įveskite bent 2 simbolius');
    expect(errors.pavarde).toBe('Įveskite bent 2 simbolius');
  });

  it('vardo ilgis skaičiuojamas kodo taškais, kaip backend len(strip())', () => {
    expect(validateRegistration({ ...VALID, vardas: '\u{1F600}' }, TODAY).vardas).toBe('Įveskite bent 2 simbolius');
    expect(validateRegistration({ ...VALID, vardas: ' 𝒜 ' }, TODAY).vardas).toBe('Įveskite bent 2 simbolius');
    expect(validateRegistration({ ...VALID, vardas: '\u{1F600}\u{1F600}' }, TODAY).vardas).toBeUndefined();
    expect(validateRegistration({ ...VALID, vardas: 'Ąž' }, TODAY).vardas).toBeUndefined();
    // e + jungiamasis ženklas: 2 kodo taškai ir JS, ir Python.
    expect(validateRegistration({ ...VALID, pavarde: 'é' }, TODAY).pavarde).toBeUndefined();
  });

  it('vardas su vienišu surogatu atmetamas kaip netinkami simboliai', () => {
    const errors = validateRegistration({ ...VALID, vardas: 'Jo\uDC00nas', pavarde: '\uD800' }, TODAY);
    expect(errors.vardas).toBe('Laukelyje yra netinkamų simbolių');
    expect(errors.pavarde).toBe('Laukelyje yra netinkamų simbolių');
  });

  it('el. paštas su vienišu surogatu atmetamas', () => {
    expect(validateRegistration({ ...VALID, el_pastas: 'jo\uD800nas@example.com' }, TODAY).el_pastas).toBe(
      'El. pašto adresas neteisingas',
    );
  });
});

describe('validateRegistration: telefonas', () => {
  it.each([
    '+37061234567',
    '861234567',
    '+370 612 34567',
    '+370-612-34567',
    '+370 (612) 34567',
    '(8 5) 212 3456',
    '  +37061234567  ',
    '123456',
  ])('teisingas telefonas %p', (telefono_nr) => {
    expect(validateRegistration({ ...VALID, telefono_nr }, TODAY).telefono_nr).toBeUndefined();
  });

  it.each([
    ['', 'tuščias'],
    ['      ', 'tik tarpai'],
    ['123', 'per mažai skaitmenų'],
    ['12 34 5', '5 skaitmenys'],
    ['1     2', '2 skaitmenys ir daug tarpų'],
    ['(((---)))', 'be skaitmenų'],
    ['telefonas', 'raidės'],
    ['+370 abc', 'raidės'],
    ['370+61234567', '„+“ ne pradžioje'],
    ['++37061234567', 'du „+“'],
    ['+370\t61234567', 'tabuliacija viduje'],
  ])('neteisingas telefonas %p (%s)', (telefono_nr) => {
    expect(validateRegistration({ ...VALID, telefono_nr }, TODAY).telefono_nr).toBe(
      'Telefono numeris neteisingas (pvz. +37061234567)',
    );
  });

  it('ilgis ribojamas DB stulpelio 20 simbolių riba (po kraštinių tarpų nukirpimo)', () => {
    const exactly20 = '+370 (612) 345-67 89';
    expect(exactly20).toHaveLength(20);
    expect(validateRegistration({ ...VALID, telefono_nr: exactly20 }, TODAY).telefono_nr).toBeUndefined();
    expect(validateRegistration({ ...VALID, telefono_nr: `${exactly20}0` }, TODAY).telefono_nr).toBeDefined();
  });
});

describe('validateRegistration: gimimo data', () => {
  it('17 metų ir 364 dienų klientas atmetamas, 18-ojo gimtadienio dieną – priimamas', () => {
    expect(validateRegistration({ ...VALID, gimimo_data: '2008-11-19' }, TODAY).gimimo_data).toBe(
      'Registruotis gali tik pilnamečiai (18+ metų)',
    );
    expect(validateRegistration({ ...VALID, gimimo_data: '2008-11-18' }, TODAY).gimimo_data).toBeUndefined();
  });

  it('vasario 29 d. gimęs tampa pilnamečiu kovo 1 d. nekeliamaisiais metais', () => {
    const value = { ...VALID, gimimo_data: '2008-02-29' };
    expect(validateRegistration(value, '2026-02-28').gimimo_data).toBe('Registruotis gali tik pilnamečiai (18+ metų)');
    expect(validateRegistration(value, '2026-03-01').gimimo_data).toBeUndefined();
  });

  it.each(['2026-13-01', '1995/01/01', '1995-1-1', '2025-02-29', '0999-12-31', ''])('neteisingas formatas %p', (gimimo_data) => {
    expect(validateRegistration({ ...VALID, gimimo_data }, TODAY).gimimo_data).toBe('Įveskite datą formatu MMMM-MM-DD');
  });

  it('ateities data turi savo paaiškinimą, ne formato klaidą', () => {
    expect(validateRegistration({ ...VALID, gimimo_data: '2026-11-19' }, TODAY).gimimo_data).toBe(
      'Gimimo data negali būti ateityje',
    );
    expect(validateRegistration({ ...VALID, gimimo_data: '2027-01-01' }, TODAY).gimimo_data).toBe(
      'Gimimo data negali būti ateityje',
    );
  });

  it('šiandienos gimimo data nėra ateitis, bet klientas – nepilnametis', () => {
    expect(validateRegistration({ ...VALID, gimimo_data: TODAY }, TODAY).gimimo_data).toBe(
      'Registruotis gali tik pilnamečiai (18+ metų)',
    );
  });

  it('1900 m. riba yra registracijos taisyklė: 1899-12-31 atmetama, 1900-01-01 priimama', () => {
    expect(validateRegistration({ ...VALID, gimimo_data: '1899-12-31' }, TODAY).gimimo_data).toBe(
      'Gimimo data negali būti ankstesnė nei 1900-01-01',
    );
    expect(validateRegistration({ ...VALID, gimimo_data: '1900-01-01' }, TODAY).gimimo_data).toBeUndefined();
  });

  it.each(['abc', '', '2026-11-18T01:00', '2026-02-30', '2026-1-5'])(
    'netinkama todayIso %p meta klaidą ir nepraleidžia nepilnamečio',
    (todayIso) => {
      expect(() => validateRegistration({ ...VALID, gimimo_data: '2020-01-01' }, todayIso)).toThrow(
        'Netinkama šiandienos data',
      );
    },
  );
});

describe('validateRegistration: slaptažodis', () => {
  function passwordError(slaptazodis: string) {
    return validateRegistration({ ...VALID, slaptazodis, slaptazodis2: slaptazodis }, TODAY).slaptazodis;
  }

  it('per trumpas slaptažodis', () => {
    expect(passwordError('abc')).toBe('Slaptažodis turi būti bent 8 simbolių');
    expect(passwordError('abcdefg')).toBe('Slaptažodis turi būti bent 8 simbolių');
    expect(passwordError('abcdefgh')).toBeUndefined();
  });

  it('minimalus ilgis skaičiuojamas kodo taškais: 4 emoji yra 4 simboliai, ne 8', () => {
    expect(passwordError('\u{1F600}\u{1F600}\u{1F600}\u{1F600}')).toBe('Slaptažodis turi būti bent 8 simbolių');
    expect(passwordError('\u{1F600}'.repeat(8))).toBeUndefined();
    expect(passwordError('ąčęėįšų')).toBe('Slaptažodis turi būti bent 8 simbolių');
    expect(passwordError('ąčęėįšųū')).toBeUndefined();
  });

  it('tarpai kraštuose skaičiuojami ir nenukerpami', () => {
    expect(passwordError('  abcd  ')).toBeUndefined();
    expect(passwordError('  abc  ')).toBe('Slaptažodis turi būti bent 8 simbolių');
  });

  it.each([
    ['a'.repeat(72), undefined],
    ['a'.repeat(73), 'Slaptažodis per ilgas'],
    ['ž'.repeat(36), undefined],
    ['ž'.repeat(37), 'Slaptažodis per ilgas'],
    ['\u{1F600}'.repeat(18), undefined],
    ['\u{1F600}'.repeat(18) + 'a', 'Slaptažodis per ilgas'],
    ['€'.repeat(24), undefined],
    ['€'.repeat(24) + 'a', 'Slaptažodis per ilgas'],
  ])('72 UTF-8 baitų riba (%#)', (slaptazodis, expected) => {
    expect(passwordError(slaptazodis)).toBe(expected);
  });

  it.each([
    ['vienišas aukštasis surogatas', 'Slaptas\uD800123'],
    ['vienišas žemasis surogatas', 'Slaptas\uDC00123'],
    ['apversta pora', 'Slaptas\uDE00\uD83D123'],
    ['aukštasis gale', 'Slaptas123\uD83D'],
  ])('%s – atmetamas kaip netinkami simboliai, validacija nesugriūna', (_name, slaptazodis) => {
    expect(passwordError(slaptazodis)).toBe('Laukelyje yra netinkamų simbolių');
  });

  it('pakartotas slaptažodis turi sutapti', () => {
    const errors = validateRegistration({ ...VALID, slaptazodis2: 'Kitas12345' }, TODAY);
    expect(errors.slaptazodis2).toBe('Slaptažodžiai nesutampa');
  });
});

describe('utf8ByteLength / codePointLength / hasLoneSurrogate', () => {
  it.each([
    ['ASCII', 'abc', 3, 3],
    ['lietuviškos raidės', 'ąčęėįšųūž', 18, 9],
    ['euro ženklas', '€', 3, 1],
    ['emoji', '\u{1F600}', 4, 1],
    ['ZWJ šeima', '\u{1F468}\u200D\u{1F469}\u200D\u{1F467}', 18, 5],
  ])('%s', (_name, text, bytes, codePoints) => {
    expect(utf8ByteLength(text)).toBe(bytes);
    expect(codePointLength(text)).toBe(codePoints);
    expect(hasLoneSurrogate(text)).toBe(false);
  });

  it.each([
    ['\uD800', 3],
    ['a\uDC00b', 5],
    ['\uDE00\uD83D', 6],
  ])('netaisyklinga seka %p: baitai suskaičiuojami be klaidos, bet seka pažymima kaip netinkama', (text, bytes) => {
    expect(() => utf8ByteLength(text)).not.toThrow();
    expect(utf8ByteLength(text)).toBe(bytes);
    expect(hasLoneSurrogate(text)).toBe(true);
  });
});