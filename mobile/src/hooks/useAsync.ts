import { DependencyList, useCallback, useEffect, useState } from 'react';

export type AsyncState<T> = {
  // 'error' – duomenų nėra; jei atnaujinimas nepavyko jau rodant duomenis, lieka 'success' su error.
  status: 'loading' | 'success' | 'error';
  data: T | null;
  error: unknown;
  // true – kai duomenys jau rodomi ir atnaujinami fone (pvz. patraukus sąrašą žemyn).
  refreshing: boolean;
};

export type AsyncResult<T> = AsyncState<T> & { reload: () => void };

type StoredState<T> = AsyncState<T> & {
  // Priklausomybės, kurioms gauti šie duomenys.
  deps: DependencyList;
};

function sameDeps(a: DependencyList, b: DependencyList): boolean {
  return a.length === b.length && a.every((value, index) => Object.is(value, b[index]));
}

function loadingFor<T>(deps: DependencyList): StoredState<T> {
  return { status: 'loading', data: null, error: null, refreshing: false, deps };
}

// Paleidžia užklausą, kai pasikeičia priklausomybės (pvz. pokalbio numeris), ir saugo jos būseną.
// - Pasikeitus priklausomybėms ankstesni duomenys nerodomi nė vieno atvaizdavimo metu.
// - reload() atnaujina tų pačių priklausomybių duomenis; nepavykus rodyti duomenys paliekami.
// - Išmontavus ar pasikeitus priklausomybėms užklausa nutraukiama, o jos rezultatas ignoruojamas,
//   net jei load signalo nepaiso.
export function useAsync<T>(load: (signal: AbortSignal) => Promise<T>, deps: DependencyList): AsyncResult<T> {
  const [state, setState] = useState<StoredState<T>>(() => loadingFor<T>(deps));
  const [reloadCount, setReloadCount] = useState(0);

  useEffect(() => {
    let active = true;
    const controller = new AbortController();
    const requestDeps = deps;

    setState((current) =>
      sameDeps(current.deps, requestDeps) && current.data !== null
        ? { ...current, refreshing: true }
        : loadingFor<T>(requestDeps),
    );

    let request: Promise<T>;
    try {
      request = load(controller.signal);
    } catch (error) {
      request = Promise.reject(error);
    }

    request.then(
      (data) => {
        if (active) {
          setState({ status: 'success', data, error: null, refreshing: false, deps: requestDeps });
        }
      },
      (error: unknown) => {
        if (!active) {
          return;
        }
        setState((current) =>
          sameDeps(current.deps, requestDeps) && current.data !== null
            ? { ...current, error, refreshing: false }
            : { status: 'error', data: null, error, refreshing: false, deps: requestDeps },
        );
      },
    );

    return () => {
      active = false;
      controller.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, reloadCount]);

  const reload = useCallback(() => setReloadCount((count) => count + 1), []);

  // Kol efektas dar nepaleido naujos užklausos, kitų priklausomybių duomenys nerodomi.
  const visible = sameDeps(state.deps, deps) ? state : loadingFor<T>(deps);
  return {
    status: visible.status,
    data: visible.data,
    error: visible.error,
    refreshing: visible.refreshing,
    reload,
  };
}
