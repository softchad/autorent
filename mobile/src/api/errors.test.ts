import {
  ApiError,
  extractDetail,
  kindFromStatus,
  toUserMessage,
} from './errors';

describe('kindFromStatus', () => {
  it.each([
    [401, 'unauthorized'],
    [403, 'forbidden'],
    [404, 'not_found'],
    [409, 'conflict'],
    [400, 'validation'],
    [422, 'validation'],
    [429, 'rate_limited'],
    [500, 'server'],
    [503, 'server'],
    [418, 'unknown'],
  ])('statusas %i → %s', (status, kind) => {
    expect(kindFromStatus(status)).toBe(kind);
  });
});

describe('extractDetail', () => {
  it('paima tekstinį detail', () => {
    expect(
      extractDetail({ detail: 'Automobilis nerastas' }),
    ).toBe('Automobilis nerastas');
  });

  it('paima pirmą schemos klaidą be angliško priešdėlio', () => {
    const body = {
      detail: [
        {
          msg: 'Value error, Slaptažodis turi būti bent 8 simbolių ilgio',
        },
      ],
    };

    expect(extractDetail(body)).toBe(
      'Slaptažodis turi būti bent 8 simbolių ilgio',
    );
  });

  it('grąžina null, kai kūnas netinkamas', () => {
    expect(extractDetail(null)).toBeNull();
    expect(extractDetail('tekstas')).toBeNull();
    expect(extractDetail({ detail: [] })).toBeNull();
  });
});

describe('toUserMessage', () => {
  it('konflikto atveju rodo serverio tekstą', () => {
    const error = new ApiError(
      'conflict',
      409,
      'Automobilis jau užimtas pasirinktu laikotarpiu',
    );

    expect(toUserMessage(error)).toBe(
      'Automobilis jau užimtas pasirinktu laikotarpiu',
    );
  });

  it('serverio klaidos detalių nerodo', () => {
    const error = new ApiError('server', 500, 'Traceback ...');

    expect(toUserMessage(error)).toBe(
      'Serverio klaida. Bandykite dar kartą.',
    );
  });

  it('Invalid token pakeičia sesijos pranešimu', () => {
    const error = new ApiError(
      'unauthorized',
      401,
      'Invalid token',
    );

    expect(toUserMessage(error)).toBe(
      'Sesija baigėsi. Prisijunkite iš naujo.',
    );
  });

  it('neteisingo slaptažodžio tekstą palieka', () => {
    const error = new ApiError(
      'unauthorized',
      401,
      'Neteisingas el. paštas arba slaptažodis',
    );

    expect(toUserMessage(error)).toBe(
      'Neteisingas el. paštas arba slaptažodis',
    );
  });

  it('ne ApiError klaidai rodo bendrą pranešimą', () => {
    expect(toUserMessage(new Error('x'))).toBe(
      'Įvyko nenumatyta klaida.',
    );
  });
});