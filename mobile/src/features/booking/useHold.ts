import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';
import { isAbortError } from '@/api/client';
import * as holdsApi from '@/api/holds';
import { Hold } from '@/api/holds';
import { clockOffsetMs, remainingMs } from './holdTimer';

// 'expired' – vietinis likęs laikas pasiekė nulį arba serveris grąžino ne aktyvią būseną; tikrą serverio būseną nurodo hold.busena.
export type HoldStatus = 'creating' | 'active' | 'expired' | 'error';

export type HoldState = {
  status: HoldStatus;
  hold: Hold | null;
  remainingMs: number;
  // Visa laikymo trukmė (žiedo užpildymui).
  totalMs: number;
  error: unknown;
};

type Result = HoldState & {
  retry: () => void;
  // Iškviečiama po sėkmingo patvirtinimo: laikymas panaudotas, jo nebereikia atlaisvinti išeinant.
  markUsed: () => void;
};

// Būsena priklauso vienai kartai: pasirinkimams ir bandymo numeriui.
type StoredState = HoldState & { key: string };

const TICK_MS = 500;

type Input = { carId: number; from: string; to: string };

function creatingState(key: string): StoredState {
  return { key, status: 'creating', hold: null, remainingMs: 0, totalMs: 0, error: null };
}

// Sukuria laikymą serveryje ir rodo jo likusį laiką. Išėjus iš ekrano ar pakeitus pasirinkimus laikymą bandoma atlaisvinti;
// nepavykus DELETE ar nutrūkus POST laikymas lieka serveryje iki jo galiojimo pabaigos.
export function useHold(input: Input): Result {
  const [attempt, setAttempt] = useState(0);
  const key = `${input.carId}|${input.from}|${input.to}|${attempt}`;
  const [state, setState] = useState<StoredState>(() => creatingState(key));

  // Laikrodžio pataisa ir laikymo duomenys laikomi ref, kad laikmatis visada matytų naujausias reikšmes.
  const offsetRef = useRef(0);
  // Dabartinės kartos laikymas.
  const holdRef = useRef<Hold | null>(null);
  const keyRef = useRef(key);
  const usedRef = useRef(false);
  const usedHoldIdRef = useRef<number | null>(null);
  const mountedRef = useRef(true);
  // Dabartinės kartos POST užbaigimas (laikymas arba null).
  const createSettledRef = useRef<Promise<Hold | null>>(Promise.resolve(null));
  // Atlaisvinimų eilė: naujas POST siunčiamas tik po ankstesnių DELETE (sėkmingų ar ne).
  const releasesRef = useRef<Promise<unknown>>(Promise.resolve());
  // Kelių tos pačios kartos GET atveju priimamas tik paskutinis išsiųstas.
  const fetchSeqRef = useRef(0);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Atlaisvinimo bandymas. Nepavykęs DELETE nekartojamas – laikymas tada baigsis serveryje savaime.
  const enqueueRelease = useCallback((holdId: number) => {
    releasesRef.current = releasesRef.current.then(() => holdsApi.releaseHold(holdId)).catch(() => {});
  }, []);

  // Pavėluotai sukurtas laikymas atlaisvinamas, jei jo nenaudoja veikianti naujesnė karta. Serveris tiems patiems
  // pasirinkimams gali grąžinti tą patį laikymą, todėl pirmiausia palaukiama, kol naujesnės kartos POST baigsis.
  const releaseIfUnused = useCallback(
    (hold: Hold) => {
      if (hold.laikymo_id === usedHoldIdRef.current) {
        return;
      }
      if (!mountedRef.current) {
        enqueueRelease(hold.laikymo_id);
        return;
      }
      const pending = createSettledRef.current;
      pending.then(() => {
        if (mountedRef.current && createSettledRef.current !== pending) {
          releaseIfUnused(hold);
          return;
        }
        if (mountedRef.current && holdRef.current?.laikymo_id === hold.laikymo_id) {
          return;
        }
        if (hold.laikymo_id !== usedHoldIdRef.current) {
          enqueueRelease(hold.laikymo_id);
        }
      });
    },
    [enqueueRelease],
  );

  // Serverio atsakymas → būsena. Kartu perskaičiuojama laikrodžio pataisa.
  const applyHold = useCallback((hold: Hold, isNew: boolean, holdKey: string) => {
    holdRef.current = hold;
    offsetRef.current = clockOffsetMs(hold.serverio_laikas, Date.now());
    const remaining = hold.busena === 'aktyvus' ? remainingMs(hold.galioja_iki, Date.now(), offsetRef.current) : 0;
    setState((current) =>
      current.key !== holdKey
        ? current
        : {
            key: holdKey,
            status: remaining > 0 ? 'active' : 'expired',
            hold,
            remainingMs: remaining,
            totalMs: isNew ? Math.max(remaining, hold.liko_sekundziu * 1000) : current.totalMs,
            error: null,
          },
    );
  }, []);

  // 1. Laikymo sukūrimas (ir pakartojimas paspaudus „Bandyti dar kartą“).
  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    keyRef.current = key;
    usedRef.current = false;
    holdRef.current = null;
    setState((current) => (current.key === key && current.status === 'creating' ? current : creatingState(key)));

    const created = releasesRef.current.then(() => (active ? holdsApi.createHold(input, controller.signal) : null));
    createSettledRef.current = created.then(
      (hold) => (active ? hold : null),
      () => null,
    );

    created.then(
      (hold) => {
        if (!hold) {
          return;
        }
        if (active) {
          applyHold(hold, true, key);
        } else {
          releaseIfUnused(hold);
        }
      },
      (error: unknown) => {
        if (active && !isAbortError(error)) {
          setState({ ...creatingState(key), status: 'error', error });
        }
      },
    );

    return () => {
      active = false;
      controller.abort();
      const hold = holdRef.current;
      holdRef.current = null;
      if (hold && !usedRef.current) {
        enqueueRelease(hold.laikymo_id);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, applyHold, enqueueRelease, releaseIfUnused]);

  // 2. Laikmatis: likęs laikas perskaičiuojamas iš serverio pabaigos laiko.
  useEffect(() => {
    if (state.status !== 'active') {
      return;
    }
    const timerKey = state.key;
    const timer = setInterval(() => {
      const hold = holdRef.current;
      if (!hold || keyRef.current !== timerKey) return;
      const remaining = remainingMs(hold.galioja_iki, Date.now(), offsetRef.current);
      setState((current) =>
        current.key === timerKey && current.status === 'active'
          ? { ...current, remainingMs: remaining, status: remaining > 0 ? 'active' : 'expired' }
          : current,
      );
    }, TICK_MS);
    return () => clearInterval(timer);
  }, [state.status, state.key]);

  // 3. Grįžus iš fono laikymo būsena pasitikrinama serveryje (fone laikmačiai neveikia).
  // Atsakymas priimamas tik tai pačiai kartai ir laikymui, jei jis nepanaudotas ir hook'as vis dar sumontuotas.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (appState) => {
      const hold = holdRef.current;
      if (appState !== 'active' || !hold || usedRef.current) {
        return;
      }
      const requestKey = keyRef.current;
      const seq = ++fetchSeqRef.current;
      holdsApi
        .fetchHold(hold.laikymo_id)
        .then((fresh) => {
          const current = holdRef.current;
          if (
            !mountedRef.current ||
            usedRef.current ||
            keyRef.current !== requestKey ||
            seq !== fetchSeqRef.current ||
            !current ||
            current.laikymo_id !== hold.laikymo_id ||
            fresh.laikymo_id !== hold.laikymo_id
          ) {
            return;
          }
          applyHold(fresh, false, requestKey);
        })
        .catch(() => {
          // Be ryšio lieka vietinis skaičiavimas pagal žinomą pabaigos laiką.
        });
    });
    return () => subscription.remove();
  }, [applyHold]);

  const retry = useCallback(() => setAttempt((count) => count + 1), []);
  const markUsed = useCallback(() => {
    usedRef.current = true;
    usedHoldIdRef.current = holdRef.current?.laikymo_id ?? null;
  }, []);

  // Iki efekto įvykdymo kitos kartos laikymas negrąžinamas.
  const visible = state.key === key ? state : creatingState(key);
  return {
    status: visible.status,
    hold: visible.hold,
    remainingMs: visible.remainingMs,
    totalMs: visible.totalMs,
    error: visible.error,
    retry,
    markUsed,
  };
}
