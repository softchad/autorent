import { fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import { useAuth } from '@/auth/AuthContext';
import { draftToParams } from '@/features/booking/bookingDraft';
import { isValidIdempotencyKey } from '@/features/booking/idempotency';
import { BOOKING_DRAFT, BOOKING_RULES, makeCar, makeHold, makeQuote, makeReservation, makeTerms } from '@/testUtils/fixtures';
import ConfirmScreen from '../app/patvirtinimas';

// Integracija: tikri useHold, usePriceQuote, API funkcijos ir apiRequest; imituojamas tik fetch,
// maršrutizatorius ir prisijungimo būsena. Tikras tinklas nenaudojamas.

let mockParams: Record<string, string> = {};
const mockRouter = { back: jest.fn(), replace: jest.fn(), push: jest.fn(), canGoBack: jest.fn(() => true) };

jest.mock('expo-router', () => ({
  Stack: { Screen: () => null },
  useRouter: () => mockRouter,
  useLocalSearchParams: () => mockParams,
}));
jest.mock('react-native-svg', () => {
  const { View } = jest.requireActual('react-native');
  return { __esModule: true, default: View, Circle: View };
});
jest.mock('@/auth/AuthContext');

type Call = { method: string; path: string; headers: Record<string, string>; body: unknown };
const calls: Call[] = [];

function reply(status: number, body: unknown) {
  return Promise.resolve({
    ok: status >= 200 && status < 300,
    status,
    text: () => Promise.resolve(body === null ? '' : JSON.stringify(body)),
  } as Response);
}

// Kiekvienas atsakymas – tokios formos, kokią grąžina backend.
function fakeServer(url: string, init: RequestInit = {}) {
  const method = init.method ?? 'GET';
  const path = url.replace(/^https?:\/\/[^/]+\/api\/v1/, '').replace(/\?.*$/, '');
  calls.push({
    method,
    path,
    headers: (init.headers ?? {}) as Record<string, string>,
    body: typeof init.body === 'string' ? JSON.parse(init.body) : undefined,
  });
  const route = `${method} ${path}`;
  if (route === 'GET /public/cars/12') return reply(200, makeCar());
  if (route === 'GET /public/terms') return reply(200, makeTerms());
  if (route === 'GET /public/booking-rules') return reply(200, BOOKING_RULES);
  if (route === 'POST /customer/holds') return reply(201, makeHold());
  if (route === 'POST /public/quote') return reply(200, makeQuote());
  if (route === 'POST /customer/holds/77/confirm') return reply(201, makeReservation());
  return Promise.reject(new Error(`Netikėta užklausa: ${route}`));
}

const originalFetch = globalThis.fetch;
const fetchMock = jest.fn(fakeServer);

beforeEach(() => {
  calls.length = 0;
  mockParams = draftToParams(BOOKING_DRAFT);
  jest.mocked(useAuth).mockReturnValue({
    status: 'signedIn',
    customer: { kliento_id: 1 },
    notice: null,
    refreshCustomer: jest.fn().mockResolvedValue(undefined),
  } as unknown as ReturnType<typeof useAuth>);
  fetchMock.mockClear();
  globalThis.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  globalThis.fetch = originalFetch;
});

it('hold → quote → confirm → sėkmė per tikrus hook\'us ir API klientą', async () => {
  const view = await render(<ConfirmScreen />);

  await waitFor(() => expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy(), { timeout: 3000 });
  await fireEvent.press(screen.getByRole('checkbox'));
  await fireEvent.press(screen.getByTestId('confirm-submit'));

  await waitFor(() => expect(screen.getByTestId('booking-success')).toBeTruthy());
  expect(screen.getByText('Rezervacija Nr. 501')).toBeTruthy();
  expect(screen.getByLabelText('Iš viso: 228,00 €')).toBeTruthy();

  const hold = calls.find((call) => call.method === 'POST' && call.path === '/customer/holds');
  expect(hold?.body).toEqual({ automobilio_id: 12, date_from: '2026-12-01', date_to: '2026-12-05' });
  const quote = calls.find((call) => call.path === '/public/quote');
  expect(quote?.body).toEqual({ automobilio_id: 12, date_from: '2026-12-01', date_to: '2026-12-05', paslaugos: ['pilna_apsauga'] });

  const confirmCalls = calls.filter((call) => call.path === '/customer/holds/77/confirm');
  expect(confirmCalls).toHaveLength(1);
  expect(confirmCalls[0].body).toEqual({
    paslaugos: ['pilna_apsauga'],
    paemimo_valanda: 14,
    salygu_versija: '2026-11-24',
    sutinku_su_salygomis: true,
    tiketina_kaina: 228,
  });
  expect(isValidIdempotencyKey(confirmCalls[0].headers['Idempotency-Key'])).toBe(true);
  expect(calls.indexOf(hold!)).toBeLessThan(calls.indexOf(confirmCalls[0]));

  // Panaudotas laikymas neatlaisvinamas nei po sėkmės, nei išmontavus ekraną.
  await view.unmount();
  await new Promise((resolve) => setTimeout(resolve, 0));
  expect(calls.some((call) => call.method === 'DELETE')).toBe(false);
});
