import { useEffect, useRef } from 'react';
import { AppState } from 'react-native';
import { isTokenExpired, msUntilExpiry } from './jwt';

// setTimeout didesnio nei ~24,8 paros laukimo nepalaiko; ilgesniam laikui tikriname pakartotinai.
export const MAX_TIMER_MS = 2_147_000_000;

export type ExpiryPlan = { expired: true } | { expired: false; delayMs: number };

// Nusprendžia, ką daryti su tokenu dabar: atjungti iškart ar po kiek laiko tikrinti vėl.
// Naudojama ta pati jwt.ts saugos atsarga; nebaigtinis laikas ar neperskaitomas exp – pasibaigęs.
export function planExpiryCheck(token: string, nowMs: number): ExpiryPlan {
  if (isTokenExpired(token, nowMs)) {
    return { expired: true };
  }
  return { expired: false, delayMs: Math.min(msUntilExpiry(token, nowMs), MAX_TIMER_MS) };
}

// Stebima sesija: id keičiasi su kiekviena nauja sesija, net jei tokeno tekstas toks pat.
export type WatchedSession = { token: string; id: number };

// Stebi tokeno galiojimą: laikmatis, kol programėlė atidaryta, ir papildomas patikrinimas grįžus iš fono
// (fone laikmačiai sustoja, todėl vien laikmačiu pasikliauti negalima).
// Vienai stebimai sesijai onExpired kviečiamas ne daugiau kaip kartą; pakeitus sesiją ar išmontavus
// laikmatis ir klausytojas išvalomi, o pavėluotas kvietimas nieko nedaro.
export function useSessionExpiry(
  session: WatchedSession | null,
  onExpired: (sessionId: number) => void,
): void {
  const onExpiredRef = useRef(onExpired);
  onExpiredRef.current = onExpired;

  const token = session?.token ?? null;
  const sessionId = session?.id ?? null;

  useEffect(() => {
    if (token === null || sessionId === null) {
      return;
    }
    let timer: ReturnType<typeof setTimeout> | undefined;
    let done = false;

    function check() {
      if (done) {
        return;
      }
      clearTimeout(timer);
      const plan = planExpiryCheck(token as string, Date.now());
      if (plan.expired) {
        done = true;
        onExpiredRef.current(sessionId as number);
        return;
      }
      timer = setTimeout(check, plan.delayMs);
    }

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        check();
      }
    });
    check();

    return () => {
      done = true;
      clearTimeout(timer);
      subscription.remove();
    };
  }, [token, sessionId]);
}
