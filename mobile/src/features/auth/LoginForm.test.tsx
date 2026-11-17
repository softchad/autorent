import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { useAuth } from '@/auth/AuthContext';
import { LoginForm } from './LoginForm';

// Formos elgesio testai su useAuth mock'u. Tai nėra native klaviatūros ar ekrano skaitytuvo patikra.
jest.mock('@/auth/AuthContext');

const signIn = jest.fn<Promise<void>, [string, string]>();
const mockedUseAuth = jest.mocked(useAuth);

function mockAuth(notice: string | null = null) {
  mockedUseAuth.mockReturnValue({ signIn, notice } as unknown as ReturnType<typeof useAuth>);
}

function deferred() {
  let resolve!: () => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<void>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function abortError(): Error {
  const error = new Error('Veiksmą pakeitė naujesnis');
  error.name = 'AbortError';
  return error;
}

let consoleError: jest.SpyInstance;

beforeEach(() => {
  signIn.mockReset();
  mockAuth();
  consoleError = jest.spyOn(console, 'error');
});

afterEach(() => {
  // Jokių „not wrapped in act“ ar būsenos keitimo po išmontavimo įspėjimų.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
});

async function fill(email: string, password: string) {
  await fireEvent.changeText(screen.getByLabelText('El. paštas'), email);
  await fireEvent.changeText(screen.getByLabelText('Slaptažodis'), password);
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
}

describe('LoginForm', () => {
  it('su tuščiais laukais serverio nekviečia ir rodo klaidas', async () => {
    await render(<LoginForm onSuccess={jest.fn()} />);
    await submit();

    expect(signIn).not.toHaveBeenCalled();
    expect(screen.getByText('Įveskite el. pašto adresą')).toBeTruthy();
    expect(screen.getByText('Įveskite slaptažodį')).toBeTruthy();
  });

  it('sėkmingai prisijungus iškviečia onSuccess; slaptažodis perduodamas nepakeistas', async () => {
    signIn.mockResolvedValue(undefined);
    const onSuccess = jest.fn();
    await render(<LoginForm onSuccess={onSuccess} />);
    await fill('jonas@example.com', '  Slaptas 123!  ');
    await submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledWith('jonas@example.com', '  Slaptas 123!  ');
  });

  it('slaptažodžio laukas paslėptas', async () => {
    await render(<LoginForm onSuccess={jest.fn()} />);
    expect(screen.getByLabelText('Slaptažodis').props.secureTextEntry).toBe(true);
  });

  it('rodo paaiškinimą, kodėl vartotojas buvo atjungtas', async () => {
    mockAuth('Sesija baigėsi. Prisijunkite iš naujo.');
    await render(<LoginForm onSuccess={jest.fn()} />);
    expect(screen.getByTestId('login-notice')).toHaveTextContent('Sesija baigėsi. Prisijunkite iš naujo.');
  });
});

describe('serverio klaidos', () => {
  async function submitWithError(error: unknown) {
    signIn.mockRejectedValue(error);
    const onSuccess = jest.fn();
    await render(<LoginForm onSuccess={onSuccess} />);
    await fill('jonas@example.com', 'Slaptas123!');
    await submit();
    await waitFor(() => expect(signIn).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Prisijungti' })).toBeEnabled());
    return onSuccess;
  }

  it('neteisingi duomenys (žinomas login 401) – lietuviškas tekstas, forma lieka', async () => {
    const onSuccess = await submitWithError(
      new ApiError('unauthorized', 401, 'Neteisingas el. paštas arba slaptažodis'),
    );

    expect(screen.getByTestId('login-error')).toHaveTextContent('Neteisingas el. paštas arba slaptažodis.');
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByLabelText('El. paštas').props.value).toBe('jonas@example.com');
  });

  it.each(['Invalid token', 'Not authenticated', null])(
    'techninis 401 (%p) – rodomas bendras lietuviškas tekstas, ne serverio',
    async (detail) => {
      await submitWithError(new ApiError('unauthorized', 401, detail));

      expect(screen.getByTestId('login-error')).toHaveTextContent('Prisijungti nepavyko. Bandykite dar kartą.');
      if (detail) expect(screen.queryByText(detail, { exact: false })).toBeNull();
    },
  );

  it('422 su pydantic EmailStr tekstu – lietuviška el. pašto lauko klaida', async () => {
    const detail = 'value is not a valid email address: An email address cannot have two periods in a row.';
    await submitWithError(new ApiError('validation', 422, detail));

    expect(screen.getByText('El. pašto adresas neteisingas')).toBeTruthy();
    expect(screen.queryByText(detail, { exact: false })).toBeNull();
    expect(screen.queryByTestId('login-error')).toBeNull();
  });

  it.each([
    [new ApiError('network'), 'Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį.'],
    [new ApiError('timeout'), 'Serveris neatsakė laiku. Bandykite dar kartą.'],
    [new ApiError('server', 500, 'Internal Server Error'), 'Serverio klaida. Bandykite dar kartą.'],
    [
      new ApiError('rate_limited', 429, 'Rate limit exceeded: 5 per 1 minute'),
      'Per daug bandymų. Palaukite minutę ir bandykite dar kartą.',
    ],
    [new Error('Rašymo klaida'), 'Įvyko nenumatyta klaida.'],
  ])('%p – bendras lietuviškas tekstas', async (error, expected) => {
    await submitWithError(error);

    expect(screen.getByTestId('login-error')).toHaveTextContent(expected);
  });

  it('nutrauktas veiksmas (AbortError) – jokios klaidos ir jokio nukreipimo', async () => {
    const onSuccess = await submitWithError(abortError());

    expect(screen.queryByTestId('login-error')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('pateikimo apsauga', () => {
  it('dvigubas pateikimas (mygtukas ir klaviatūros „go“) – signIn kviečiamas vieną kartą', async () => {
    const pending = deferred();
    signIn.mockReturnValue(pending.promise);
    const onSuccess = jest.fn();
    await render(<LoginForm onSuccess={onSuccess} />);
    await fill('jonas@example.com', 'Slaptas123!');

    await submit();
    await fireEvent(screen.getByLabelText('Slaptažodis'), 'submitEditing');
    await submit();

    expect(signIn).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Prisijungti' })).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('po klaidos galima pateikti dar kartą', async () => {
    signIn.mockRejectedValueOnce(new ApiError('network')).mockResolvedValueOnce(undefined);
    const onSuccess = jest.fn();
    await render(<LoginForm onSuccess={onSuccess} />);
    await fill('jonas@example.com', 'Slaptas123!');

    await submit();
    await waitFor(() => expect(screen.getByTestId('login-error')).toBeTruthy());
    await submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signIn).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['sėkmė', (d: ReturnType<typeof deferred>) => d.resolve()],
    ['klaida', (d: ReturnType<typeof deferred>) => d.reject(new ApiError('network'))],
  ])('pavėluotas rezultatas (%s) po išmontavimo – nei nukreipimo, nei įspėjimų', async (_name, finish) => {
    const pending = deferred();
    signIn.mockReturnValue(pending.promise);
    const onSuccess = jest.fn();
    const { unmount } = await render(<LoginForm onSuccess={onSuccess} />);
    await fill('jonas@example.com', 'Slaptas123!');
    await submit();

    await unmount();
    await act(async () => {
      finish(pending);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('registracijos nuoroda', () => {
  it('be onGoRegister registracijos nuorodos nėra', async () => {
    await render(<LoginForm onSuccess={jest.fn()} />);

    expect(screen.queryByRole('button', { name: 'Registruotis' })).toBeNull();
    expect(screen.queryByText('Dar neturite paskyros?')).toBeNull();
  });

  it('su onGoRegister nuoroda rodoma ir veikia', async () => {
    const onGoRegister = jest.fn();
    await render(<LoginForm onSuccess={jest.fn()} onGoRegister={onGoRegister} />);

    await fireEvent.press(screen.getByRole('button', { name: 'Registruotis' }));
    expect(onGoRegister).toHaveBeenCalledTimes(1);
  });
});
