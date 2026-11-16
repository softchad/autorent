import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import * as authApi from '@/api/auth';
import { setAuthToken } from '@/api/client';
import { ApiError } from '@/api/errors';
import { Customer, RegisterPayload } from '@/api/types';
import { lt } from '@/i18n/lt';
import { isTokenExpired } from './jwt';
import { clearToken, loadToken, saveToken } from './tokenStorage';

export type AuthStatus = 'loading' | 'signedOut' | 'signedIn';

type AuthState = {
  status: AuthStatus;
  // null, kol profilis dar neatsiųstas (pvz. programėlė atidaryta be ryšio).
  customer: Customer | null;
  // Vienkartinis paaiškinimas vartotojui, pvz. kodėl jis buvo atjungtas.
  notice: string | null;
};

type AuthContextValue = AuthState & {
  // Klaidą perduoda ekranui. Pasenęs bandymas (pvz. po signOut) atmetamas AbortError.
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (payload: RegisterPayload) => Promise<void>;
  // Nepavykus ištrinti tokeno, atmetama ir sesija lieka nepakeista.
  signOut: (notice?: string) => Promise<void>;
  // 401 – sesija baigiama (resolve); kitos klaidos perduodamos, sesija lieka.
  refreshCustomer: () => Promise<void>;
  clearNotice: () => void;
};

const AuthContext = createContext<AuthContextValue | null>(null);

const SIGNED_OUT: AuthState = { status: 'signedOut', customer: null, notice: null };

// Tas pats klaidos pavadinimas kaip api/client isAbortError.
function supersededError(): Error {
  const error = new Error('Veiksmą pakeitė naujesnis');
  error.name = 'AbortError';
  return error;
}

function isUnauthorized(error: unknown): boolean {
  return error instanceof ApiError && error.kind === 'unauthorized';
}

/*
 * Sesijos taisyklės:
 * - sessionRef keičiasi kaskart, kai keičiasi įsipareigota sesija (prisijungta, atsijungta, išmontuota).
 *   Profilio ir 401 atsakymai taikomi tik tai sesijai, kuriai buvo išsiųsti.
 * - attemptRef keičiasi prasidėjus signIn/signUp, po signOut ir išmontavus.
 *   Pasenęs prisijungimo bandymas nieko nebekeičia ir atmetamas AbortError.
 * - Saugyklos rašymai vyksta vienas po kito (storageQueue), kad senas saveToken
 *   negalėtų įvykti po naujesnio clearToken.
 * - Nauja sesija įsipareigojama tik gavus profilį ir išsaugojus tokeną; kitaip niekas nepasikeičia.
 * - Prisijungiant profilis tikrinamas su nauju tokenu tik toje užklausoje (fetchMe(token)).
 *   Bendras API kliento tokenas keičiamas tik įsipareigojant sesiją, todėl kitos užklausos
 *   iki tol naudoja ankstesnės sesijos tokeną.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ status: 'loading', customer: null, notice: null });

  const mountedRef = useRef(true);
  const sessionRef = useRef(0);
  const attemptRef = useRef(0);
  // Įsipareigotos sesijos tokenas (null – neprisijungęs); jis pat nustatytas ir API klientui.
  const committedTokenRef = useRef<string | null>(null);
  const storageQueueRef = useRef<Promise<unknown>>(Promise.resolve());

  const safeSetState = useCallback((next: AuthState | ((current: AuthState) => AuthState)) => {
    if (mountedRef.current) setState(next);
  }, []);

  const commitToken = useCallback((token: string | null) => {
    committedTokenRef.current = token;
    setAuthToken(token);
  }, []);

  const inStorageQueue = useCallback(<T,>(task: () => Promise<T>): Promise<T> => {
    const run = storageQueueRef.current.then(task, task);
    storageQueueRef.current = run.catch(() => undefined);
    return run;
  }, []);

  // Sesija baigiama atmintyje (UI ir API tokenas sutampa).
  const endSessionInMemory = useCallback(
    (notice: string | null) => {
      sessionRef.current += 1;
      commitToken(null);
      safeSetState({ ...SIGNED_OUT, notice });
    },
    [commitToken, safeSetState],
  );

  // Automatinis atjungimas: tokenas lokaliai laikomas pasibaigusiu (exp su 30 s saugos atsarga)
  // arba serveris į profilio užklausą atsakė 401. Sesija atmintyje baigiama iškart, o saugykla
  // valoma geriausiomis pastangomis – trynimo klaida nuryjama, kad automatinis kelias neliktų
  // neapdorotas. Ribos: saugos atsarga nereiškia, kad serveris tokeną jau atmeta, o neištrintas
  // tokenas nėra atšauktas – JWT serveryje neatšaukiamas ir galioja iki savo exp. Programėlė jo
  // vėl nenaudos: paleidus iš naujo jis bus lokaliai pasibaigęs arba gaus 401 ir bus trinamas dar kartą.
  const expireSession = useCallback(
    async (session: number) => {
      if (sessionRef.current !== session) return;
      endSessionInMemory(lt.auth.sessionExpired);
      await inStorageQueue(async () => {
        // Jei per tą laiką įsipareigota nauja sesija, jos tokeno netriname.
        if (committedTokenRef.current === null) await clearToken();
      }).catch(() => undefined);
    },
    [endSessionInMemory, inStorageQueue],
  );

  const signOut = useCallback(
    async (notice?: string) => {
      await inStorageQueue(async () => {
        // Klaida perduodama kvietėjui; būsena ir API tokenas lieka nepakeisti.
        await clearToken();
        attemptRef.current += 1;
        endSessionInMemory(notice ?? null);
      });
    },
    [endSessionInMemory, inStorageQueue],
  );

  const refreshCustomer = useCallback(async () => {
    const session = sessionRef.current;
    if (committedTokenRef.current === null) return;

    let customer: Customer;
    try {
      customer = await authApi.fetchMe();
    } catch (error) {
      if (sessionRef.current !== session) return;
      if (isUnauthorized(error)) {
        await expireSession(session);
        return;
      }
      throw error;
    }

    if (sessionRef.current !== session) return;
    safeSetState((current) => (current.status === 'signedIn' ? { ...current, customer } : current));
  }, [expireSession, safeSetState]);

  const startSession = useCallback(
    async (requestToken: () => Promise<string>) => {
      attemptRef.current += 1;
      const attempt = attemptRef.current;
      const isCurrent = () => attemptRef.current === attempt;

      try {
        const token = await requestToken();
        if (!isCurrent()) throw supersededError();

        // Profilis tikrinamas nauju tokenu tik šioje užklausoje; bendras tokenas dar nekeičiamas.
        const customer = await authApi.fetchMe(token);
        if (!isCurrent()) throw supersededError();

        await inStorageQueue(async () => {
          if (!isCurrent()) throw supersededError();
          await saveToken(token);
          if (!isCurrent()) {
            // Kol rašėme, prasidėjo naujesnis veiksmas: saugykloje grąžiname įsipareigotą būseną.
            const committed = committedTokenRef.current;
            await (committed === null ? clearToken() : saveToken(committed)).catch(() => undefined);
            throw supersededError();
          }
          // Tik dabar keičiamas bendras API kliento tokenas.
          sessionRef.current += 1;
          commitToken(token);
          safeSetState({ status: 'signedIn', customer, notice: null });
        });
      } catch (error) {
        // Bendras tokenas nebuvo keistas; tik „loading“ neturi užstrigti.
        if (isCurrent()) {
          safeSetState((current) => (current.status === 'loading' ? SIGNED_OUT : current));
        }
        throw error;
      }
    },
    [commitToken, inStorageQueue, safeSetState],
  );

  const signIn = useCallback(
    (email: string, password: string) => startSession(() => authApi.login(email, password)),
    [startSession],
  );

  const signUp = useCallback(
    (payload: RegisterPayload) => startSession(() => authApi.register(payload)),
    [startSession],
  );

  // Atidarius programėlę: atkuriame sesiją iš saugyklos, jei tokenas dar galioja.
  useEffect(() => {
    mountedRef.current = true;
    const attempt = attemptRef.current;

    async function restoreSession() {
      let token: string | null;
      try {
        token = await loadToken();
      } catch {
        token = null;
      }
      // Kol skaitėme, vartotojas jau prisijungė ar atsijungė.
      if (attemptRef.current !== attempt) return;

      if (!token) {
        safeSetState(SIGNED_OUT);
        return;
      }
      if (isTokenExpired(token, Date.now())) {
        await expireSession(sessionRef.current);
        return;
      }

      sessionRef.current += 1;
      commitToken(token);
      safeSetState({ status: 'signedIn', customer: null, notice: null });
      // Be ryšio sesija lieka, profilis bus užkrautas vėliau.
      await refreshCustomer().catch(() => undefined);
    }

    void restoreSession();
    return () => {
      mountedRef.current = false;
      attemptRef.current += 1;
      sessionRef.current += 1;
    };
  }, [commitToken, expireSession, refreshCustomer, safeSetState]);

  const clearNotice = useCallback(() => {
    safeSetState((current) => ({ ...current, notice: null }));
  }, [safeSetState]);

  const value = useMemo(
    () => ({ ...state, signIn, signUp, signOut, refreshCustomer, clearNotice }),
    [state, signIn, signUp, signOut, refreshCustomer, clearNotice],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuth galima naudoti tik AuthProvider viduje');
  }
  return value;
}
