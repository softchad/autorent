import { act, renderHook } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import { useReducedMotion } from './useReducedMotion';

type Listener = (value: boolean) => void;

const isEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const addListener = AccessibilityInfo.addEventListener as jest.Mock;

// Leidžia testui pačiam nuspręsti, kada „nuskaitomas“ pradinis nustatymas.
function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

// Pakeičia AccessibilityInfo imitacija ir grąžina įrankius įvykiams siųsti.
function setup(initial: Promise<boolean>) {
  const remove = jest.fn();
  let listener: Listener | undefined;

  isEnabled.mockReset().mockReturnValue(initial);
  addListener.mockReset().mockImplementation((_name: string, handler: Listener) => {
    listener = handler;
    return { remove };
  });

  return {
    remove,
    emit: (value: boolean) => act(async () => listener?.(value)),
  };
}

describe('useReducedMotion', () => {
  it('kol nustatymas nenuskaitytas, laiko, kad judesys sumažintas', async () => {
    setup(new Promise<boolean>(() => {}));
    const { result } = await renderHook(() => useReducedMotion());

    expect(result.current).toBe(true);
  });

  it('nuskaito išjungtą nustatymą', async () => {
    setup(Promise.resolve(false));
    const { result } = await renderHook(() => useReducedMotion());

    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('nuskaito įjungtą nustatymą', async () => {
    setup(Promise.resolve(true));
    const { result } = await renderHook(() => useReducedMotion());

    await act(async () => {});
    expect(result.current).toBe(true);
  });

  it('klauso reduceMotionChanged ir seka pasikeitimus', async () => {
    const { emit } = setup(Promise.resolve(false));
    const { result } = await renderHook(() => useReducedMotion());
    await act(async () => {});

    expect(addListener).toHaveBeenCalledWith('reduceMotionChanged', expect.any(Function));
    expect(result.current).toBe(false);

    await emit(true);
    expect(result.current).toBe(true);

    await emit(false);
    expect(result.current).toBe(false);
  });

  it('pasikeitimo įvykis nėra perrašomas vėluojančiu pradiniu atsakymu', async () => {
    const initial = deferred<boolean>();
    const { emit } = setup(initial.promise);
    const { result } = await renderHook(() => useReducedMotion());

    await emit(true);
    await act(async () => initial.resolve(false));

    expect(result.current).toBe(true);
  });

  it('nepavykus nuskaityti, lieka sumažintas judesys', async () => {
    const initial = deferred<boolean>();
    setup(initial.promise);
    const { result } = await renderHook(() => useReducedMotion());

    await act(async () => initial.reject(new Error('nepavyko')));
    expect(result.current).toBe(true);
  });

  it('išmontuojant pašalina klausytoją, o vėlesni atsakymai nieko nekeičia', async () => {
    const errors = jest.spyOn(console, 'error').mockImplementation(() => {});
    const initial = deferred<boolean>();
    const { remove, emit } = setup(initial.promise);
    const { result, unmount } = await renderHook(() => useReducedMotion());

    expect(remove).not.toHaveBeenCalled();
    await unmount();
    expect(remove).toHaveBeenCalledTimes(1);

    await act(async () => initial.resolve(false));
    await emit(false);

    expect(result.current).toBe(true);
    expect(errors).not.toHaveBeenCalled();
    errors.mockRestore();
  });
});
