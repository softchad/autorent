import { useEffect, useReducer } from 'react';
import { fetchQuote, Quote } from '@/api/booking';
import { isAbortError } from '@/api/client';
import { initialPriceState, inputKey, PriceAction, priceReducer, PriceState, QuoteInput } from './priceRequest';

// Kiek laukiama po paskutinio pasirinkimo pakeitimo, kol siunčiama užklausa.
export const QUOTE_DEBOUNCE_MS = 350;

// Gyva kaina: kaskart pasikeitus pasirinkimams prašo serverio naujo pasiūlymo.
// input = null reiškia, kad laikotarpis dar nepasirinktas.
export function usePriceQuote(input: QuoteInput | null, refreshKey = 0): PriceState<Quote> {
  const [state, dispatch] = useReducer(
    priceReducer as (state: PriceState<Quote>, action: PriceAction<Quote>) => PriceState<Quote>,
    undefined,
    () => initialPriceState<Quote>(),
  );
  const key = input ? inputKey(input) + (refreshKey ? `#${refreshKey}` : '') : null;

  useEffect(() => {
    dispatch({ type: 'input', key });
    if (!input || key === null) {
      return;
    }
    const controller = new AbortController();
    // abort gali būti nepaisomas, todėl po cleanup atsakymas būsenos nebekeičia.
    let active = true;

    // Greitai keičiant pasirinkimus (pvz. žymint paslaugas) siunčiama tik paskutinė užklausa,
    // o jau išsiųsta ankstesnė – nutraukiama.
    const timer = setTimeout(() => {
      fetchQuote(input, controller.signal)
        .then((quote) => {
          if (active) {
            dispatch({ type: 'resolved', key, quote });
          }
        })
        .catch((error: unknown) => {
          if (active && !isAbortError(error)) {
            dispatch({ type: 'failed', key, error });
          }
        });
    }, QUOTE_DEBOUNCE_MS);

    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
    };
    // input turinį visiškai atspindi key, todėl priklausomybė – tik key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  // Iki efekto įvykdymo grąžinama naujam raktui pritaikyta būsena, kad sena kaina nebūtų parodyta nė vieno render metu.
  return state.key === key ? state : priceReducer(state, { type: 'input', key });
}
