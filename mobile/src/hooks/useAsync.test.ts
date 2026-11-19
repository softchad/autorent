import { act, renderHook } from '@testing-library/react-native';
import { useAsync } from './useAsync';

type Deferred<T> = { promise: Promise<T>; resolve: (value: T) => void; reject: (error: unknown) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Užklausa, kuri signalo nepaiso: pažadas lieka valdomas testo.
function controlledLoad() {
  const calls: { key: string; signal: AbortSignal; request: Deferred<string> }[] = [];
  const load = (key: string) => (signal: AbortSignal) => {
    const request = deferred<string>();
    calls.push({ key, signal, request });
    return request.promise;
  };
  return { calls, load };
}

async function settle(action: () => void) {
  await act(async () => {
    action();
    await Promise.resolve();
  });
}

describe('useAsync', () => {
  it('parodo įkeltus duomenis', async () => {
    const { calls, load } = controlledLoad();
    const { result } = await renderHook(() => useAsync(load('a'), ['a']));
    expect(result.current.status).toBe('loading');
    await settle(() => calls[0].request.resolve('A'));
    expect(result.current).toMatchObject({ status: 'success', data: 'A', error: null });
  });

  it('sinchroniškai išmesta load klaida tampa klaidos būsena', async () => {
    const failure = new Error('sinchroninė');
    const { result } = await renderHook(() =>
      useAsync<string>(() => {
        throw failure;
      }, []),
    );
    await act(async () => {
      await Promise.resolve();
    });
    expect(result.current).toMatchObject({ status: 'error', data: null, error: failure });
  });

  it('pasikeitus priklausomybėms seni duomenys nerodomi net pirmame atvaizdavime', async () => {
    const { calls, load } = controlledLoad();
    const seen: (string | null)[] = [];
    const { rerender } = await renderHook(
      ({ id }: { id: string }) => {
        const state = useAsync(load(id), [id]);
        seen.push(state.data === null ? null : `${id}:${state.data}`);
        return state;
      },
      { initialProps: { id: 'a' } },
    );
    await settle(() => calls[0].request.resolve('A'));
    seen.length = 0;

    await rerender({ id: 'b' });
    // Nė viename „b“ atvaizdavime nėra „a“ duomenų.
    expect(seen.every((entry) => entry === null)).toBe(true);
    expect(calls[0].signal.aborted).toBe(true);
  });

  it('pavėluotas senos priklausomybės atsakymas (signalo nepaisantis) nepakeičia naujos', async () => {
    const { calls, load } = controlledLoad();
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useAsync(load(id), [id]), {
      initialProps: { id: 'a' },
    });
    await rerender({ id: 'b' });
    await settle(() => calls[1].request.resolve('B'));
    await settle(() => calls[0].request.resolve('A-vėlai'));
    expect(result.current).toMatchObject({ status: 'success', data: 'B' });
  });

  it('pavėluota senos priklausomybės klaida nepakeičia naujos būsenos', async () => {
    const { calls, load } = controlledLoad();
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useAsync(load(id), [id]), {
      initialProps: { id: 'a' },
    });
    await rerender({ id: 'b' });
    await settle(() => calls[0].request.reject(new Error('sena')));
    expect(result.current.status).toBe('loading');
    await settle(() => calls[1].request.resolve('B'));
    expect(result.current).toMatchObject({ status: 'success', data: 'B', error: null });
  });

  it('išmontavus užklausa nutraukiama, o vėlesnis rezultatas būsenos nebekeičia', async () => {
    const { calls, load } = controlledLoad();
    const { result, unmount } = await renderHook(() => useAsync(load('a'), ['a']));
    const before = result.current;
    await unmount();
    expect(calls[0].signal.aborted).toBe(true);
    await settle(() => calls[0].request.resolve('A-vėlai'));
    expect(result.current).toBe(before);
  });

  it('nepavykęs tos pačios tapatybės atnaujinimas palieka rodomus duomenis ir pateikia klaidą', async () => {
    const { calls, load } = controlledLoad();
    const { result } = await renderHook(() => useAsync(load('a'), ['a']));
    await settle(() => calls[0].request.resolve('A'));

    await settle(() => result.current.reload());
    expect(result.current).toMatchObject({ status: 'success', data: 'A', refreshing: true });
    const failure = new Error('ryšys');
    await settle(() => calls[1].request.reject(failure));
    expect(result.current).toMatchObject({ status: 'success', data: 'A', error: failure, refreshing: false });

    await settle(() => result.current.reload());
    await settle(() => calls[2].request.resolve('A2'));
    expect(result.current).toMatchObject({ status: 'success', data: 'A2', error: null });
  });

  it('po atnaujinimo klaidos pasikeitus priklausomybėms seni duomenys nelieka', async () => {
    const { calls, load } = controlledLoad();
    const { result, rerender } = await renderHook(({ id }: { id: string }) => useAsync(load(id), [id]), {
      initialProps: { id: 'a' },
    });
    await settle(() => calls[0].request.resolve('A'));
    await settle(() => result.current.reload());
    await settle(() => calls[1].request.reject(new Error('ryšys')));

    await rerender({ id: 'b' });
    expect(result.current).toMatchObject({ status: 'loading', data: null, error: null });
    await settle(() => calls[2].request.reject(new Error('b klaida')));
    expect(result.current).toMatchObject({ status: 'error', data: null });
  });
});
