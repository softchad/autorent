import { act, renderHook, waitFor } from '@testing-library/react-native';
import { AppState } from 'react-native';
import { ApiError } from '@/api/errors';
import * as holdsApi from '@/api/holds';
import { Hold } from '@/api/holds';
import { useHold } from './useHold';

jest.mock('@/api/holds');
const api = jest.mocked(holdsApi);

const INPUT = { carId: 12, from: '2026-12-01', to: '2026-12-05' };
const START = Date.parse('2026-11-28T09:00:00Z');

// Serverio atsakymas momentu „now“ (serverio laiku) laikymui, kuris baigiasi 09:10.
function holdAt(serverNowMs: number, overrides: Partial<Hold> = {}): Hold {
  const expires = START + 600_000;
  return {
    laikymo_id: 77,
    automobilio_id: 12,
    pradzia: INPUT.from,
    pabaiga: INPUT.to,
    busena: 'aktyvus',
    galioja_iki: new Date(expires).toISOString(),
    serverio_laikas: new Date(serverNowMs).toISOString(),
    liko_sekundziu: Math.max(0, Math.ceil((expires - serverNowMs) / 1000)),
    ...overrides,
  };
}

let appStateListener: (state: string) => void = () => {};

beforeEach(() => {
  jest.useFakeTimers();
  jest.setSystemTime(START);
  api.createHold.mockReset().mockResolvedValue(holdAt(START));
  api.fetchHold.mockReset();
  api.releaseHold.mockReset().mockResolvedValue(null);
  jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
    appStateListener = listener as (state: string) => void;
    return { remove: jest.fn() } as unknown as ReturnType<typeof AppState.addEventListener>;
  });
});

afterEach(() => {
  jest.useRealTimers();
  jest.restoreAllMocks();
});

async function advance(ms: number) {
  await act(async () => {
    jest.advanceTimersByTime(ms);
  });
}

describe('useHold', () => {
  it('sukuria laikymą ir pradeda skaičiuoti nuo 10 minučių', async () => {
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(api.createHold).toHaveBeenCalledWith(INPUT, expect.anything());
    expect(result.current.remainingMs).toBe(600_000);
    expect(result.current.totalMs).toBe(600_000);
  });

  it('laikui einant likęs laikas mažėja', async () => {
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    await advance(240_000);
    expect(result.current.remainingMs).toBe(360_000);
  });

  it('pasibaigus laikui būsena tampa „expired“', async () => {
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    await advance(600_500);
    expect(result.current.status).toBe('expired');
    expect(result.current.remainingMs).toBe(0);
  });

  it('naudoja serverio laiką, kai telefono laikrodis atsilieka 5 minutėmis', async () => {
    // Telefonas rodo 08:55, serveris – 09:00.
    jest.setSystemTime(START - 300_000);
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(result.current.remainingMs).toBe(600_000);
    await advance(600_500);
    expect(result.current.status).toBe('expired');
  });

  it('grįžus iš fono būsena patikrinama serveryje', async () => {
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));

    // Programėlė 7 minutes buvo fone: laikmatis nesuveikė, bet laikas praėjo.
    jest.setSystemTime(START + 420_000);
    api.fetchHold.mockResolvedValue(holdAt(START + 420_000));
    await act(async () => appStateListener('active'));

    expect(api.fetchHold).toHaveBeenCalledWith(77);
    expect(result.current.remainingMs).toBe(180_000);
    expect(result.current.totalMs).toBe(600_000);
  });

  it('jei grįžus serveris praneša, kad laikymas baigėsi – rodo „expired“', async () => {
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    jest.setSystemTime(START + 900_000);
    api.fetchHold.mockResolvedValue(holdAt(START + 900_000, { busena: 'pasibaiges', liko_sekundziu: 0 }));
    await act(async () => appStateListener('active'));
    expect(result.current.status).toBe('expired');
  });

  it('serverio atsisakymą (pvz. automobilį laiko kitas klientas) perduoda kaip klaidą', async () => {
    api.createHold.mockRejectedValue(new ApiError('conflict', 409, 'Šį automobilį šiuo metu rezervuoja kitas klientas.'));
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('error'));
    expect(result.current.error).toMatchObject({ kind: 'conflict' });
  });

  it('retry bando sukurti laikymą iš naujo', async () => {
    api.createHold.mockRejectedValueOnce(new ApiError('network'));
    const { result } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('error'));
    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current.status).toBe('active'));
    expect(api.createHold).toHaveBeenCalledTimes(2);
  });

  it('išėjus iš ekrano nepatvirtinus laikymas atlaisvinamas', async () => {
    const { result, unmount } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    await unmount();
    expect(api.releaseHold).toHaveBeenCalledWith(77);
  });

  it('po patvirtinimo (markUsed) laikymas neatlaisvinamas', async () => {
    const { result, unmount } = await renderHook(() => useHold(INPUT));
    await waitFor(() => expect(result.current.status).toBe('active'));
    await act(async () => result.current.markUsed());
    await unmount();
    expect(api.releaseHold).not.toHaveBeenCalled();
  });
});

describe('useHold – pasenę atsakymai', () => {
  const OTHER = { carId: 13, from: '2026-12-01', to: '2026-12-05' };

  function deferred<T>() {
    let resolve!: (value: T) => void;
    let reject!: (error: unknown) => void;
    const promise = new Promise<T>((res, rej) => {
      resolve = res;
      reject = rej;
    });
    return { promise, resolve, reject };
  }

  // Leidžia įvykti visiems laukiantiems pažadams (užklausų eilei ir atsakymams).
  async function flush() {
    await act(async () => {
      for (let i = 0; i < 10; i += 1) await Promise.resolve();
    });
  }

  type Props = { value: typeof INPUT };
  const renderInput = (value = INPUT) =>
    renderHook(({ value: current }: Props) => useHold(current), { initialProps: { value } });

  it('pavėluota ankstesnių pasirinkimų POST sėkmė nerodoma ir, nenaudojama, atlaisvinama', async () => {
    const late = deferred<Hold>();
    api.createHold
      .mockImplementationOnce(() => late.promise)
      .mockResolvedValueOnce(holdAt(START, { laikymo_id: 88, automobilio_id: 13 }));
    const { result, rerender } = await renderInput();
    await flush();
    await rerender({ value: OTHER });
    await waitFor(() => expect(result.current.hold?.laikymo_id).toBe(88));

    late.resolve(holdAt(START));
    await flush();

    expect(result.current).toMatchObject({ status: 'active', hold: { laikymo_id: 88 } });
    expect(api.releaseHold).toHaveBeenCalledWith(77);
    expect(api.releaseHold).not.toHaveBeenCalledWith(88);
  });

  it('pavėluota ankstesnių pasirinkimų POST klaida naujos būsenos neperrašo', async () => {
    const late = deferred<Hold>();
    api.createHold
      .mockImplementationOnce(() => late.promise)
      .mockResolvedValueOnce(holdAt(START, { laikymo_id: 88, automobilio_id: 13 }));
    const { result, rerender } = await renderInput();
    await flush();
    await rerender({ value: OTHER });
    await waitFor(() => expect(result.current.status).toBe('active'));

    late.reject(new ApiError('network'));
    await flush();

    expect(result.current).toMatchObject({ status: 'active', hold: { laikymo_id: 88 }, error: null });
  });

  it('po išmontavimo pavėluotai sukurtas laikymas atlaisvinamas', async () => {
    const late = deferred<Hold>();
    api.createHold.mockImplementationOnce(() => late.promise);
    const { unmount } = await renderInput();
    await flush();
    await unmount();

    late.resolve(holdAt(START));
    await flush();

    expect(api.releaseHold).toHaveBeenCalledWith(77);
  });

  it('jau pirmame render pakeitus pasirinkimus ankstesnio laikymo nėra', async () => {
    api.createHold.mockResolvedValueOnce(holdAt(START)).mockImplementationOnce(() => new Promise(() => undefined));
    // Būsena užrašoma pačio render metu – dar prieš efektus.
    const rendered: { status: string; hold: Hold | null }[] = [];
    const { rerender } = await renderHook(
      ({ value }: Props) => {
        const current = useHold(value);
        rendered.push({ status: current.status, hold: current.hold });
        return current;
      },
      { initialProps: { value: INPUT } },
    );
    await waitFor(() => expect(rendered[rendered.length - 1].hold?.laikymo_id).toBe(77));

    rendered.length = 0;
    await rerender({ value: OTHER });

    expect(rendered[0]).toEqual({ status: 'creating', hold: null });
  });

  it.each([
    ['pakeitus pasirinkimus', 'input'],
    ['po retry', 'retry'],
    ['po markUsed', 'markUsed'],
  ])('pasenęs AppState GET %s laikymo neatgaivina', async (_name, action) => {
    api.createHold.mockResolvedValueOnce(holdAt(START)).mockImplementationOnce(() => new Promise(() => undefined));
    const stale = deferred<Hold>();
    api.fetchHold.mockImplementationOnce(() => stale.promise);
    const { result, rerender } = await renderInput();
    await waitFor(() => expect(result.current.status).toBe('active'));
    await act(async () => appStateListener('active'));

    if (action === 'input') {
      await rerender({ value: OTHER });
    } else if (action === 'retry') {
      await act(async () => result.current.retry());
    } else {
      await act(async () => result.current.markUsed());
      jest.setSystemTime(START + 60_000);
    }
    const before = result.current;

    stale.resolve(holdAt(START + 60_000, { busena: 'pasibaiges', liko_sekundziu: 0 }));
    await flush();

    if (action === 'markUsed') {
      expect(result.current.status).toBe('active');
      expect(result.current.hold).toBe(before.hold);
    } else {
      expect(result.current).toMatchObject({ status: 'creating', hold: null });
    }
  });

  it('iš kelių tos pačios kartos GET priimamas tik paskutinis išsiųstas', async () => {
    const first = deferred<Hold>();
    const second = deferred<Hold>();
    api.fetchHold.mockImplementationOnce(() => first.promise).mockImplementationOnce(() => second.promise);
    const { result } = await renderInput();
    await waitFor(() => expect(result.current.status).toBe('active'));
    await act(async () => appStateListener('active'));
    await act(async () => appStateListener('active'));

    second.resolve(holdAt(START + 120_000));
    await flush();
    first.resolve(holdAt(START + 900_000, { busena: 'pasibaiges', liko_sekundziu: 0 }));
    await flush();

    expect(result.current.status).toBe('active');
  });

  async function returnToFirstSelection() {
    const firstA = deferred<Hold>();
    const secondA = deferred<Hold>();
    api.createHold
      .mockImplementationOnce(() => firstA.promise)
      .mockImplementationOnce(() => new Promise(() => undefined))
      .mockImplementationOnce(() => secondA.promise);
    const hook = await renderInput();
    await flush();
    await hook.rerender({ value: OTHER });
    await flush();
    await hook.rerender({ value: INPUT });
    await flush();
    expect(api.createHold).toHaveBeenCalledTimes(3);
    return { ...hook, firstA, secondA };
  }

  it('A → B → A: pirmasis A, atsakęs prieš antrąjį, to paties laikymo neatšaukia', async () => {
    const { result, firstA, secondA } = await returnToFirstSelection();
    firstA.resolve(holdAt(START));
    await flush();
    secondA.resolve(holdAt(START));
    await flush();

    expect(result.current).toMatchObject({ status: 'active', hold: { laikymo_id: 77 } });
    expect(api.releaseHold).not.toHaveBeenCalled();
  });

  it('A → B → A: pirmasis A, atsakęs paskutinis, naujesnio atsakymo neperrašo ir laikymo neatšaukia', async () => {
    const { result, firstA, secondA } = await returnToFirstSelection();
    secondA.resolve(holdAt(START));
    await flush();
    // Senesnis atsakymas apie tą patį laikymą: serverio laikas užfiksuotas 30 s anksčiau.
    firstA.resolve(holdAt(START - 30_000));
    await flush();

    expect(result.current).toMatchObject({ status: 'active', hold: { laikymo_id: 77 }, remainingMs: 600_000 });
    expect(api.releaseHold).not.toHaveBeenCalled();
  });

  it('naujas POST siunčiamas tik po ankstesnio laikymo DELETE', async () => {
    const release = deferred<null>();
    api.releaseHold.mockImplementationOnce(() => release.promise);
    api.createHold.mockResolvedValueOnce(holdAt(START)).mockResolvedValueOnce(holdAt(START, { laikymo_id: 88, automobilio_id: 13 }));
    const { result, rerender } = await renderInput();
    await waitFor(() => expect(result.current.status).toBe('active'));

    await rerender({ value: OTHER });
    await flush();
    expect(api.releaseHold).toHaveBeenCalledWith(77);
    expect(api.createHold).toHaveBeenCalledTimes(1);

    release.resolve(null);
    await waitFor(() => expect(result.current.hold?.laikymo_id).toBe(88));
    expect(api.createHold).toHaveBeenCalledTimes(2);
  });

  it('nepavykus DELETE naujas POST vis tiek siunčiamas, o tas pats laikymas nebeatšaukiamas', async () => {
    api.releaseHold.mockRejectedValueOnce(new ApiError('network'));
    // Serveris po nepavykusio atlaisvinimo grąžina tą patį aktyvų laikymą.
    api.createHold.mockResolvedValueOnce(holdAt(START)).mockResolvedValueOnce(holdAt(START));
    const { result } = await renderInput();
    await waitFor(() => expect(result.current.status).toBe('active'));

    await act(async () => result.current.retry());
    await waitFor(() => expect(result.current).toMatchObject({ status: 'active', hold: { laikymo_id: 77 } }));
    await flush();

    expect(api.createHold).toHaveBeenCalledTimes(2);
    expect(api.releaseHold).toHaveBeenCalledTimes(1);
  });
});
