// UI pusės logika: kainą skaičiuoja tik serveris, o čia užtikrinama, kad ekrane niekada nebūtų
// parodyta kaina, apskaičiuota kitiems (senesniems) pasirinkimams.

export type QuoteInput = {
  carId: number;
  from: string;
  to: string;
  extras: string[];
};

// Vienodi pasirinkimai visada duoda tą patį raktą (paslaugų tvarka nesvarbi).
export function inputKey(input: QuoteInput): string {
  return [input.carId, input.from, input.to, [...input.extras].sort().join(',')].join('|');
}

export type PriceState<Quote extends { viso: number }> = {
  status: 'idle' | 'loading' | 'ready' | 'error';
  // Pasirinkimų, kuriems laukiame arba turime kainą, raktas.
  key: string | null;
  quote: Quote | null;
  error: unknown;
  // Paskutinė parodyta suma – pagal ją nustatoma, ar kaina pasikeitė.
  previousTotal: number | null;
  changed: boolean;
};

export type PriceAction<Quote> =
  | { type: 'input'; key: string | null }
  | { type: 'resolved'; key: string; quote: Quote }
  | { type: 'failed'; key: string; error: unknown };

export function initialPriceState<Quote extends { viso: number }>(): PriceState<Quote> {
  return { status: 'idle', key: null, quote: null, error: null, previousTotal: null, changed: false };
}

export function priceReducer<Quote extends { viso: number }>(
  state: PriceState<Quote>,
  action: PriceAction<Quote>,
): PriceState<Quote> {
  if (action.type === 'input') {
    if (action.key === state.key) {
      return state;
    }
    // Pasikeitus pasirinkimams sena kaina iškart nuimama; prisimenama tik jos suma palyginimui.
    const previousTotal = state.quote ? state.quote.viso : state.previousTotal;
    if (action.key === null) {
      return { ...initialPriceState<Quote>(), previousTotal };
    }
    return { status: 'loading', key: action.key, quote: null, error: null, previousTotal, changed: false };
  }

  // Atsakymas į seną užklausą (raktas nebesutampa) ignoruojamas.
  if (action.key !== state.key) {
    return state;
  }
  if (action.type === 'failed') {
    return { ...state, status: 'error', quote: null, error: action.error };
  }
  const changed = state.previousTotal !== null && state.previousTotal !== action.quote.viso;
  return { ...state, status: 'ready', quote: action.quote, error: null, changed };
}

// Sumos pokytis nuo anksčiau rodytos (teigiamas – pabrango). null, kai nėra su kuo lyginti.
export function priceDifference<Quote extends { viso: number }>(state: PriceState<Quote>): number | null {
  if (state.status !== 'ready' || !state.quote || state.previousTotal === null) {
    return null;
  }
  return Math.round((state.quote.viso - state.previousTotal) * 100) / 100;
}
