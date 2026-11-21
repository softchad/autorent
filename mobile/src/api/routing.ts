import { ROUTING_URL } from '@/config/env';
import { isValidCoordinate } from '@/features/map/mapHtml';

export type RoutePoint = { lat: number; lng: number };

export type Route = {
  points: RoutePoint[];
  distanceMeters: number;
  durationSeconds: number;
};

const TIMEOUT_MS = 12000;

// Ar sukonfigūruota maršrutų paslauga. Jei ne – maršrutas nebraižomas, siūloma išorinė navigacija.
export function isRoutingConfigured(baseUrl: string | null = ROUTING_URL): boolean {
  return Boolean(baseUrl);
}

// OSRM formato adresas: koordinatės rašomos „ilguma,platuma“.
export function buildRouteUrl(baseUrl: string, from: RoutePoint, to: RoutePoint): string {
  const pair = (point: RoutePoint) => `${point.lng.toFixed(6)},${point.lat.toFixed(6)}`;
  return `${baseUrl}/route/v1/driving/${pair(from)};${pair(to)}?overview=full&geometries=geojson`;
}

function isNonNegativeNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0;
}

// Atsakymas ateina iš išorinės paslaugos, todėl prieš naudojant patikrinama jo forma.
// Grąžina null, jei paslauga praneša klaidą (code ne „Ok“), maršruto nėra arba bent viena reikšmė netinkama.
// Netinkama geometrija neatkuriama: vienas blogas taškas atmeta visą maršrutą.
export function parseRoute(body: unknown): Route | null {
  if (!body || typeof body !== 'object' || (body as { code?: unknown }).code !== 'Ok') {
    return null;
  }
  const routes = (body as { routes?: unknown }).routes;
  const first = Array.isArray(routes) ? (routes[0] as { geometry?: { coordinates?: unknown }; distance?: unknown; duration?: unknown } | null) : null;
  const coordinates = first?.geometry?.coordinates;
  if (!first || !Array.isArray(coordinates) || !isNonNegativeNumber(first.distance) || !isNonNegativeNumber(first.duration)) {
    return null;
  }
  const points: RoutePoint[] = [];
  for (const item of coordinates) {
    if (!Array.isArray(item) || typeof item[0] !== 'number' || typeof item[1] !== 'number' || !isValidCoordinate(item[1], item[0])) {
      return null;
    }
    points.push({ lat: item[1], lng: item[0] });
  }
  return points.length >= 2 ? { points, distanceMeters: first.distance, durationSeconds: first.duration } : null;
}

function abortError(): Error {
  const error = new Error('Užklausa atšaukta');
  error.name = 'AbortError';
  return error;
}

// Maršrutas automobiliu tarp dviejų taškų. Paslaugai siunčiamos naudotojo ir padalinio koordinatės; tokenas ir kitos antraštės nesiunčiami.
// Paslaugos klaida, ryšio sutrikimas ar laiko limitas grąžina null; kvietėjo atšaukimas meta AbortError.
export async function fetchRoute(
  from: RoutePoint,
  to: RoutePoint,
  signal?: AbortSignal,
  baseUrl: string | null = ROUTING_URL,
): Promise<Route | null> {
  if (!baseUrl) {
    return null;
  }
  if (signal?.aborted) {
    throw abortError();
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  const onCallerAbort = () => controller.abort();
  signal?.addEventListener('abort', onCallerAbort);
  try {
    const response = await fetch(buildRouteUrl(baseUrl, from, to), { signal: controller.signal });
    // OSRM klaidos atsakymas (pvz. NoRoute) turi JSON kūną, bet maršruto jame nėra.
    const body: unknown = await response.json().catch(() => null);
    if (signal?.aborted) {
      throw abortError();
    }
    return response.ok ? parseRoute(body) : null;
  } catch {
    if (signal?.aborted) {
      throw abortError();
    }
    return null;
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', onCallerAbort);
  }
}
