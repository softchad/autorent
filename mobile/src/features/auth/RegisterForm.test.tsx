import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { ApiError } from '@/api/errors';
import { RegisterPayload } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { RegisterForm, utcTodayIso } from './RegisterForm';

// Formos elgesio testai su useAuth mock'u. Tikras AuthProvider (register → fetchMe → saveToken)
// čia neveikia; tai nėra native klaviatūros, ekrano skaitytuvo ar įrenginio laikrodžio patikra.
jest.mock('@/auth/AuthContext');

const signUp = jest.fn<Promise<void>, [RegisterPayload]>();
const mockedUseAuth = jest.mocked(useAuth);

// Fiksuojamas tik Date; laikmačiai lieka tikri, kad RNTL waitFor veiktų įprastai.
function freezeClock(iso: string) {
  jest.useFakeTimers({
    doNotFake: [
      'hrtime',
      'nextTick',
      'performance',
      'queueMicrotask',
      'requestAnimationFrame',
      'cancelAnimationFrame',
      'requestIdleCallback',
      'cancelIdleCallback',
      'setImmediate',
      'clearImmediate',
      'setInterval',
      'clearInterval',
      'setTimeout',
      'clearTimeout',
    ],
    now: new Date(iso),
  });
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

const LABELS = {
  vardas: 'Vardas',
  pavarde: 'Pavardė',
  el_pastas: 'El. paštas',
  telefono_nr: 'Telefono numeris',
  gimimo_data: 'Gimimo data',
  slaptazodis: 'Slaptažodis',
  slaptazodis2: 'Pakartokite slaptažodį',
} as const;

type FormValues = Record<keyof typeof LABELS, string>;

const VALID: FormValues = {
  vardas: 'Jonas',
  pavarde: 'Jonaitis',
  el_pastas: 'jonas@example.com',
  telefono_nr: '+37061234567',
  gimimo_data: '1995-04-17',
  slaptazodis: 'Slaptas123!',
  slaptazodis2: 'Slaptas123!',
};

let consoleError: jest.SpyInstance;

beforeEach(() => {
  signUp.mockReset();
  mockedUseAuth.mockReturnValue({ signUp } as unknown as ReturnType<typeof useAuth>);
  freezeClock('2026-11-18T12:00:00Z');
  consoleError = jest.spyOn(console, 'error');
});

afterEach(() => {
  // Jokių „not wrapped in act“ ar būsenos keitimo po išmontavimo įspėjimų.
  expect(consoleError).not.toHaveBeenCalled();
  consoleError.mockRestore();
  jest.useRealTimers();
});

async function renderForm(props: Partial<{ onSuccess: () => void; onGoLogin: () => void }> = {}) {
  const onSuccess = props.onSuccess ?? jest.fn();
  const onGoLogin = props.onGoLogin ?? jest.fn();
  const view = await render(<RegisterForm onSuccess={onSuccess} onGoLogin={onGoLogin} />);
  return { ...view, onSuccess, onGoLogin };
}

async function fill(values: Partial<FormValues>) {
  for (const [field, value] of Object.entries(values) as [keyof FormValues, string][]) {
    await fireEvent.changeText(screen.getByLabelText(LABELS[field]), value);
  }
}

async function submit() {
  await fireEvent.press(screen.getByRole('button', { name: 'Sukurti paskyrą' }));
}

describe('utcTodayIso', () => {
  it('grąžina UTC kalendorinę dieną, ne vietinę', () => {
    // Vilniuje jau 19 d. 01:30, UTC – dar 18 d.
    expect(utcTodayIso(new Date('2026-11-19T01:30:00+02:00'))).toBe('2026-11-18');
    expect(utcTodayIso(new Date('2026-11-18T23:59:59.999Z'))).toBe('2026-11-18');
    expect(utcTodayIso(new Date('2026-11-19T00:00:00Z'))).toBe('2026-11-19');
  });
});

describe('RegisterForm: validacija ir sėkmė', () => {
  it('su tuščiais laukais serverio nekviečia ir rodo klaidas', async () => {
    await renderForm();
    await submit();

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getAllByText('Įveskite bent 2 simbolius')).toHaveLength(2);
    expect(screen.getByText('Įveskite el. pašto adresą')).toBeTruthy();
    expect(screen.getByText('Telefono numeris neteisingas (pvz. +37061234567)')).toBeTruthy();
  });

  it('siunčia tik API laukus: vardas, pavardė ir telefonas be kraštinių tarpų, slaptažodis nepakeistas', async () => {
    signUp.mockResolvedValue(undefined);
    const { onSuccess } = await renderForm();
    await fill({
      ...VALID,
      vardas: '  Jonas ',
      pavarde: ' Jonaitis  ',
      el_pastas: ' Jonas@Example.com ',
      telefono_nr: '  +370 (612) 345-67  ',
      slaptazodis: '  Slaptas 123!  ',
      slaptazodis2: '  Slaptas 123!  ',
    });
    await submit();

    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledTimes(1);
    const payload = signUp.mock.calls[0][0];
    // El. paštą apkerpa ir mažosiomis raidėmis paverčia api/auth register (jo testai – api/auth.test.ts).
    expect(payload).toEqual({
      vardas: 'Jonas',
      pavarde: 'Jonaitis',
      el_pastas: ' Jonas@Example.com ',
      telefono_nr: '+370 (612) 345-67',
      gimimo_data: '1995-04-17',
      slaptazodis: '  Slaptas 123!  ',
    });
    expect(payload).not.toHaveProperty('slaptazodis2');
  });

  it('nesutampantys slaptažodžiai – serverio nekviečia', async () => {
    await renderForm();
    await fill({ ...VALID, slaptazodis2: 'Kitas123!' });
    await submit();

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Slaptažodžiai nesutampa')).toBeTruthy();
  });

  it('išlaiko 024 Unicode ir baitų validaciją', async () => {
    await renderForm();
    await fill({ ...VALID, vardas: '😀', slaptazodis: 'Slaptas\uD800123', slaptazodis2: 'Slaptas\uD800123' });
    await submit();
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Įveskite bent 2 simbolius')).toBeTruthy();
    expect(screen.getByText('Laukelyje yra netinkamų simbolių')).toBeTruthy();

    const tooLong = 'ž'.repeat(37);
    await fill({ vardas: 'Jonas', slaptazodis: tooLong, slaptazodis2: tooLong });
    await submit();
    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Slaptažodis per ilgas')).toBeTruthy();
  });

  it('ateities gimimo data – savas paaiškinimas', async () => {
    await renderForm();
    await fill({ ...VALID, gimimo_data: '2026-11-19' });
    await submit();

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByText('Gimimo data negali būti ateityje')).toBeTruthy();
  });

  it('įrenginio data už palaikomų ribų – forma nelūžta ir serverio nekviečia', async () => {
    jest.setSystemTime(new Date('+010000-01-01T00:00:00Z'));
    await renderForm();
    await fill(VALID);
    await submit();

    expect(signUp).not.toHaveBeenCalled();
    expect(screen.getByTestId('register-error')).toHaveTextContent('Įvyko nenumatyta klaida.');
  });
});

describe('RegisterForm: amžius pagal UTC dieną (užfiksuotas laikrodis)', () => {
  async function birthDateError(nowIso: string, gimimo_data: string) {
    jest.setSystemTime(new Date(nowIso));
    signUp.mockResolvedValue(undefined);
    const view = await renderForm();
    await fill({ ...VALID, gimimo_data });
    await submit();
    const error = screen.queryByText('Registruotis gali tik pilnamečiai (18+ metų)');
    await view.unmount();
    return error ? 'nepilnametis' : 'priimta';
  }

  it('UTC dienos riba: Vilniuje jau 18-asis gimtadienis, UTC – dar ne', async () => {
    // 2026-11-19 01:00 Vilniaus laiku = 2026-11-18 23:00 UTC.
    expect(await birthDateError('2026-11-18T23:00:00Z', '2008-11-19')).toBe('nepilnametis');
    expect(await birthDateError('2026-11-19T00:00:00Z', '2008-11-19')).toBe('priimta');
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it('18-ojo gimtadienio dieną priimama, dieną anksčiau – ne', async () => {
    expect(await birthDateError('2026-11-18T00:00:00Z', '2008-11-18')).toBe('priimta');
    expect(await birthDateError('2026-11-18T23:59:59Z', '2008-11-19')).toBe('nepilnametis');
  });

  it('vasario 29 d. gimęs pilnamečiu tampa kovo 1 d. UTC', async () => {
    expect(await birthDateError('2026-02-28T23:59:59Z', '2008-02-29')).toBe('nepilnametis');
    expect(await birthDateError('2026-03-01T00:00:00Z', '2008-02-29')).toBe('priimta');
  });
});

describe('RegisterForm: serverio klaidos', () => {
  async function submitWithError(error: unknown) {
    signUp.mockRejectedValue(error);
    const view = await renderForm();
    await fill(VALID);
    await submit();
    await waitFor(() => expect(signUp).toHaveBeenCalledTimes(1));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Sukurti paskyrą' })).toBeEnabled());
    return view;
  }

  it('žinomas el. pašto konfliktas – lietuviška el. pašto lauko klaida, forma lieka', async () => {
    const { onSuccess } = await submitWithError(
      new ApiError('conflict', 409, 'Klientas su šiuo el. paštu jau užregistruotas'),
    );

    expect(
      screen.getByText('Šis el. paštas jau užregistruotas. Prisijunkite arba naudokite kitą adresą.'),
    ).toBeTruthy();
    expect(screen.queryByTestId('register-error')).toBeNull();
    expect(screen.queryByText('Klientas su šiuo el. paštu jau užregistruotas')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    expect(screen.getByLabelText('El. paštas').props.value).toBe('jonas@example.com');
  });

  it.each([['Kitas konfliktas'], [null]])('kitas 409 (%p) nėra vadinamas el. pašto konfliktu', async (detail) => {
    await submitWithError(new ApiError('conflict', 409, detail));

    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Serveris nepriėmė duomenų. Patikrinkite laukus ir bandykite dar kartą.',
    );
    expect(screen.queryByText(/jau užregistruotas/)).toBeNull();
  });

  it('422 su anglišku pydantic tekstu – bendras lietuviškas tekstas, ne el. pašto lauko klaida', async () => {
    const detail = 'value is not a valid email address: An email address cannot have two periods in a row.';
    await submitWithError(new ApiError('validation', 422, detail));

    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Serveris nepriėmė duomenų. Patikrinkite laukus ir bandykite dar kartą.',
    );
    expect(screen.queryByText(detail, { exact: false })).toBeNull();
    expect(screen.queryByText('El. pašto adresas neteisingas')).toBeNull();
  });

  it.each([
    ['Registruotis gali tik pilnamečiai (18+ metų) klientai', 'Registruotis gali tik pilnamečiai (18+ metų)'],
    ['Gimimo data negali būti ateityje', 'Gimimo data negali būti ateityje'],
  ])('422 su žinomu gimimo datos tekstu %p – gimimo datos lauko klaida', async (detail, expected) => {
    await submitWithError(new ApiError('validation', 422, detail));

    expect(screen.getByText(expected)).toBeTruthy();
    expect(screen.queryByTestId('register-error')).toBeNull();
  });

  it('429 su anglišku tekstu – lietuviškas tekstas', async () => {
    await submitWithError(new ApiError('rate_limited', 429, 'Rate limit exceeded: 10 per 1 minute'));

    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Per daug bandymų. Palaukite minutę ir bandykite dar kartą.',
    );
    expect(screen.queryByText(/Rate limit/)).toBeNull();
  });

  it.each([
    ['ryšys', new ApiError('network')],
    ['laiko limitas', new ApiError('timeout')],
    ['500', new ApiError('server', 500, 'Internal Server Error')],
    ['401 iš fetchMe', new ApiError('unauthorized', 401, 'Invalid token')],
    ['401 be tokeno', new ApiError('unauthorized', 401, 'Not authenticated')],
    ['blogas atsakymas', new ApiError('unknown')],
    ['saugyklos klaida', new Error('SecureStore write failed')],
  ])('%s – atsargus pranešimas, kad paskyra galėjo būti sukurta', async (_name, error) => {
    const { onSuccess } = await submitWithError(error);

    expect(screen.getByTestId('register-error')).toHaveTextContent(
      'Nepavyko užbaigti registracijos. Paskyra galėjo būti sukurta, todėl prieš bandydami dar kartą pabandykite prisijungti tuo pačiu el. paštu ir slaptažodžiu.',
    );
    expect(screen.queryByText(/Invalid token|Not authenticated|Internal Server Error|SecureStore/)).toBeNull();
    expect(screen.queryByText(/nesukurta|atšaukta/)).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
    // Jokio automatinio pakartotinio POST.
    expect(signUp).toHaveBeenCalledTimes(1);
  });

  it('nutrauktas veiksmas (AbortError) – jokios klaidos ir jokio nukreipimo', async () => {
    const { onSuccess } = await submitWithError(abortError());

    expect(screen.queryByTestId('register-error')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(onSuccess).not.toHaveBeenCalled();
  });
});

describe('RegisterForm: pateikimo apsauga', () => {
  it('dvigubas pateikimas (mygtukas ir klaviatūros „go“) – signUp vieną kartą; perėjimas į prisijungimą užrakintas', async () => {
    const pending = deferred();
    signUp.mockReturnValue(pending.promise);
    const { onSuccess, onGoLogin } = await renderForm();
    await fill(VALID);

    await submit();
    await fireEvent(screen.getByLabelText('Pakartokite slaptažodį'), 'submitEditing');
    await submit();
    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));

    expect(signUp).toHaveBeenCalledTimes(1);
    expect(onGoLogin).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sukurti paskyrą' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Prisijungti' })).toBeDisabled();

    await act(async () => {
      pending.resolve();
    });

    expect(onSuccess).toHaveBeenCalledTimes(1);
  });

  it('po klaidos galima pateikti dar kartą (tik vartotojo veiksmu)', async () => {
    signUp.mockRejectedValueOnce(new ApiError('rate_limited', 429)).mockResolvedValueOnce(undefined);
    const { onSuccess } = await renderForm();
    await fill(VALID);

    await submit();
    await waitFor(() => expect(screen.getByTestId('register-error')).toBeTruthy());
    expect(signUp).toHaveBeenCalledTimes(1);

    await submit();
    await waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
    expect(signUp).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['sėkmė', (d: ReturnType<typeof deferred>) => d.resolve()],
    ['klaida', (d: ReturnType<typeof deferred>) => d.reject(new ApiError('network'))],
  ])('pavėluotas rezultatas (%s) po išmontavimo – nei nukreipimo, nei įspėjimų', async (_name, finish) => {
    const pending = deferred();
    signUp.mockReturnValue(pending.promise);
    const { unmount, onSuccess } = await renderForm();
    await fill(VALID);
    await submit();

    await unmount();
    await act(async () => {
      finish(pending);
    });

    expect(onSuccess).not.toHaveBeenCalled();
  });

  it('„Prisijungti“ veikia, kai forma nepateikiama', async () => {
    const { onGoLogin } = await renderForm();
    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
    expect(onGoLogin).toHaveBeenCalledTimes(1);
  });
});
