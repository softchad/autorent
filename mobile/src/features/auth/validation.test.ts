import {
  hasErrors,
  isValidEmail,
  validateLogin,
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