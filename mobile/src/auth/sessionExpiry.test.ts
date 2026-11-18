import { act, renderHook } from '@testing-library/react-native';
import { AppState, AppStateStatus } from 'react-native';
import { makeToken } from '@/testUtils/makeToken';
import { EXPIRY_SAFETY_MS } from './jwt';
import { MAX_TIMER_MS, planExpiryCheck, useSessionExpiry, WatchedSession } from './sessionExpiry';

// AppState čia – imitacija su rankiniu 'change' įvykiu. Tai nėra native fono ar laikmačių sustabdymo patikra.
const NOW = Date.UTC(2026, 10, 18, 9, 0, 0);
const tokenExpiringIn = (ms: number) => makeToken({ exp: (NOW + ms) / 1000 });
const MINUTE = 60_000;
const DAY = 86_400_000;

describe('planExpiryCheck', () => {
  it('galiojančiam tokenui grąžina laukimo laiką iki pabaigos su jwt saugos atsarga', () => {
    expect(planExpiryCheck(tokenExpiringIn(60 * MINUTE), NOW)).toEqual({
      expired: false,
      delayMs: 60 * MINUTE - EXPIRY_SAFETY_MS,
    });
  });

  it('pasibaigusį, saugos atsargoje esantį ar sugadintą tokeną laiko pasibaigusiu', () => {
    expect(planExpiryCheck(tokenExpiringIn(-1000), NOW)).toEqual({ expired: true });
    expect(planExpiryCheck(tokenExpiringIn(EXPIRY_SAFETY_MS), NOW)).toEqual({ expired: true });
    expect(planExpiryCheck('sugadintas', NOW)).toEqual({ expired: true });
  });

  it.each([NaN, Infinity, -Infinity])('nebaigtinis dabarties laikas (%p) – pasibaigęs', (nowMs) => {
    expect(planExpiryCheck(tokenExpiringIn(60 * MINUTE), nowMs)).toEqual({ expired: true });
  });

  it('labai ilgą laukimą apriboja iki laikmačio maksimumo', () => {
    const plan = planExpiryCheck(tokenExpiringIn(60 * DAY), NOW);
    expect(plan).toEqual({ expired: false, delayMs: MAX_TIMER_MS });
  });
});

describe('useSessionExpiry', () => {
  let appStateListeners: ((state: AppStateStatus) => void)[];
  let removed: number;

  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(NOW);
    appStateListeners = [];
    removed = 0;
    jest.spyOn(AppState, 'addEventListener').mockImplementation((_type, listener) => {
      appStateListeners.push(listener as (state: AppStateStatus) => void);
      return {
        remove: () => {
          removed += 1;
        },
      } as unknown as ReturnType<typeof AppState.addEventListener>;
    });
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  const session = (ms: number, id = 1): WatchedSession => ({ token: tokenExpiringIn(ms), id });

  async function emitAppState(state: AppStateStatus) {
    await act(async () => {
      for (const listener of appStateListeners) listener(state);
    });
  }

  async function advance(ms: number) {
    await act(async () => {
      jest.advanceTimersByTime(ms);
    });
  }

  it('atėjus galiojimo pabaigai (su saugos atsarga) vieną kartą iškviečia onExpired su sesijos id', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(session(10 * MINUTE, 7), onExpired));

    await advance(10 * MINUTE - EXPIRY_SAFETY_MS - 1);
    expect(onExpired).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledWith(7);
  });

  it('jau pasibaigusį tokeną praneša iškart', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(session(-5000), onExpired));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('be sesijos nieko nedaro ir klausytojo neregistruoja', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(null, onExpired));
    await advance(60 * MINUTE);
    expect(onExpired).not.toHaveBeenCalled();
    expect(appStateListeners).toHaveLength(0);
  });

  it('grįžus į active patikrina iš naujo; kitos būsenos nieko nedaro', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(session(10 * MINUTE), onExpired));

    // Imituojama: laikas praėjo, o laikmatis dar nesuveikė.
    jest.setSystemTime(NOW + 20 * MINUTE);
    await emitAppState('background');
    expect(onExpired).not.toHaveBeenCalled();
    await emitAppState('active');
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('laikmatis ir active sutampa – pranešama vieną kartą', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(session(10 * MINUTE), onExpired));

    await advance(10 * MINUTE);
    await emitAppState('active');
    await emitAppState('active');
    await advance(DAY);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('active anksčiau nei laikmatis – laikmatis išvalomas, pranešama vieną kartą', async () => {
    const onExpired = jest.fn();
    await renderHook(() => useSessionExpiry(session(10 * MINUTE), onExpired));

    jest.setSystemTime(NOW + 11 * MINUTE);
    await emitAppState('active');
    await advance(DAY);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('ilga delsa: suveikus ribiniam laikmačiui perskaičiuojama ir planuojama vėl', async () => {
    const onExpired = jest.fn();
    const total = 60 * DAY;
    await renderHook(() => useSessionExpiry(session(total), onExpired));

    await advance(MAX_TIMER_MS);
    expect(onExpired).not.toHaveBeenCalled();

    await advance(total - EXPIRY_SAFETY_MS - MAX_TIMER_MS - 1);
    expect(onExpired).not.toHaveBeenCalled();
    await advance(1);
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('nebaigtinis laikas tikrinimo metu – sesija laikoma pasibaigusia', async () => {
    const onExpired = jest.fn();
    jest.spyOn(Date, 'now').mockReturnValue(NaN);
    await renderHook(() => useSessionExpiry(session(60 * MINUTE), onExpired));
    expect(onExpired).toHaveBeenCalledTimes(1);
  });

  it('nauja sesija su tuo pačiu tokeno tekstu atpažįstama: senas laikmatis išvalomas, pranešama nauju id', async () => {
    const onExpired = jest.fn();
    const token = tokenExpiringIn(10 * MINUTE);
    const hook = await renderHook(({ s }: { s: WatchedSession }) => useSessionExpiry(s, onExpired), {
      initialProps: { s: { token, id: 1 } },
    });

    // Pirmoji sesija jau pasibaigė ir pranešė.
    jest.setSystemTime(NOW + 10 * MINUTE);
    await emitAppState('active');
    expect(onExpired).toHaveBeenCalledWith(1);

    // Ta pati tokeno eilutė, bet nauja sesija – stebima iš naujo.
    await hook.rerender({ s: { token, id: 2 } });
    expect(onExpired).toHaveBeenCalledTimes(2);
    expect(onExpired).toHaveBeenLastCalledWith(2);
    expect(removed).toBe(1);
  });

  it('pakeitus sesiją senas laikmatis nebeveikia, nauja stebima savo laiku', async () => {
    const onExpired = jest.fn();
    const hook = await renderHook(({ s }: { s: WatchedSession }) => useSessionExpiry(s, onExpired), {
      initialProps: { s: session(10 * MINUTE, 1) },
    });

    await hook.rerender({ s: session(60 * MINUTE, 2) });
    await advance(10 * MINUTE);
    expect(onExpired).not.toHaveBeenCalled();

    await advance(50 * MINUTE);
    expect(onExpired).toHaveBeenCalledTimes(1);
    expect(onExpired).toHaveBeenCalledWith(2);
  });

  it('naujas onExpired callback nepersiplanuoja laikmačio, bet kviečiamas naujausias', async () => {
    const first = jest.fn();
    const second = jest.fn();
    const s = session(10 * MINUTE);
    const hook = await renderHook(({ cb }: { cb: (id: number) => void }) => useSessionExpiry(s, cb), {
      initialProps: { cb: first },
    });

    await hook.rerender({ cb: second });
    expect(appStateListeners).toHaveLength(1);
    await advance(10 * MINUTE);
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('išmontavus laikmatis ir klausytojas išvalomi; pavėluotas active nieko nedaro', async () => {
    const onExpired = jest.fn();
    const hook = await renderHook(() => useSessionExpiry(session(10 * MINUTE), onExpired));

    await hook.unmount();
    expect(removed).toBe(1);

    // Net jei platforma dar iškviestų seną klausytoją – jis nieko nedaro.
    jest.setSystemTime(NOW + DAY);
    for (const listener of appStateListeners) listener('active');
    await advance(DAY);
    expect(onExpired).not.toHaveBeenCalled();
  });

  it('sesija pakeista į null – stebėjimas nutraukiamas', async () => {
    const onExpired = jest.fn();
    const hook = await renderHook(({ s }: { s: WatchedSession | null }) => useSessionExpiry(s, onExpired), {
      initialProps: { s: session(10 * MINUTE) as WatchedSession | null },
    });

    await hook.rerender({ s: null });
    expect(removed).toBe(1);
    await advance(DAY);
    expect(onExpired).not.toHaveBeenCalled();
  });
});
