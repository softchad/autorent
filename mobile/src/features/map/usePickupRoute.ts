import * as ExpoLocation from 'expo-location';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking } from 'react-native';
import { geocodeAddress } from '@/api/geocode';
import { fetchRoute, isRoutingConfigured, Route } from '@/api/routing';
import { Location } from '@/api/types';
import { useAsync } from '@/hooks/useAsync';
import { isValidCoordinate, LatLng } from './mapHtml';

// idle – klientas dar neprašė; asking – laukiama leidimo ar vietos; shown – maršrutas nubraižytas;
// located – vieta žinoma, bet maršruto nėra (paslauga nesukonfigūruota arba neatsakė); denied – leidimas nesuteiktas;
// failed – vietos ar maršruto gauti nepavyko.
export type RoutePhase = 'idle' | 'asking' | 'shown' | 'located' | 'denied' | 'failed';

type RouteState = { key: string; phase: RoutePhase; userPoint: LatLng | null; route: Route | null };

// Nuoroda į išorinę navigaciją: pagal koordinates, o jei jų nėra – pagal adresą.
export function directionsUrl(point: LatLng | null, address: string): string {
  if (point && isValidCoordinate(point.lat, point.lng)) {
    return `https://www.google.com/maps/dir/?api=1&destination=${point.lat},${point.lng}`;
  }
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`;
}

// 12 345 m → '12,3 km'; 850 m → '850 m'.
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)} m`;
  }
  return `${(meters / 1000).toFixed(1).replace('.', ',')} km`;
}

export function formatDuration(seconds: number): string {
  const minutes = Math.max(1, Math.round(seconds / 60));
  return minutes < 60 ? `${minutes} min.` : `${Math.floor(minutes / 60)} val. ${minutes % 60} min.`;
}

// Padalinio koordinatės, kliento vieta ir maršrutas automobilio ekranui.
export function usePickupRoute(location: Location | null) {
  const address = location?.adresas ?? '';
  // Būsena priklauso konkrečiai paėmimo vietai: pasikeitus vietai ankstesnė vieta ir maršrutas nerodomi.
  const key = location ? `${location.vietos_id}:${address}` : '';

  // Padalinio adresas verčiamas koordinatėmis per AutoRent serverį.
  const coordinates = useAsync<{ address: string; point: LatLng | null }>(async (signal) => ({
    address, point: address ? await geocodeAddress(address, signal) : null,
  }), [address]);
  const resolved = coordinates.data?.address === address ? coordinates.data.point : null;
  const point = resolved && isValidCoordinate(resolved.lat, resolved.lng) ? resolved : null;

  const [state, setState] = useState<RouteState>({ key, phase: 'idle', userPoint: null, route: null });
  const current: RouteState = state.key === key ? state : { key, phase: 'idle', userPoint: null, route: null };
  const [directionsFailedKey, setDirectionsFailedKey] = useState<string | null>(null);
  // Vykdomas maršruto prašymas; ref stabdo antrą paspaudimą dar prieš persipiešimą.
  const activeRequest = useRef<AbortController | null>(null);

  // Pasikeitus vietai ar išmontavus komponentą vykdomas prašymas atšaukiamas, o jo vėlyvi atsakymai ignoruojami.
  useEffect(() => () => {
    activeRequest.current?.abort();
    activeRequest.current = null;
  }, [key]);

  // Vietos prašoma tik klientui paspaudus „Rodyti maršrutą“ ir tik kol programėlė atidaryta, net jei leidimas suteiktas anksčiau.
  // Vieta niekur neišsaugoma ir AutoRent serveriui nesiunčiama; sukonfigūruotai maršrutų paslaugai siunčiamos kliento ir padalinio koordinatės.
  const requestRoute = useCallback(async () => {
    if (!point || activeRequest.current) {
      return;
    }
    const controller = new AbortController();
    activeRequest.current = controller;
    const isCurrent = () => activeRequest.current === controller && !controller.signal.aborted;
    const update = (next: Omit<RouteState, 'key'>) => {
      if (isCurrent()) {
        setState({ key, ...next });
      }
    };

    update({ phase: 'asking', userPoint: null, route: null });
    try {
      const permission = await ExpoLocation.requestForegroundPermissionsAsync();
      if (!isCurrent()) {
        return;
      }
      if (!permission.granted) {
        update({ phase: 'denied', userPoint: null, route: null });
        return;
      }
      // Vietos nustatymo atšaukti negalima, todėl pavėluotas rezultatas tiesiog ignoruojamas.
      const position = await ExpoLocation.getCurrentPositionAsync({ accuracy: ExpoLocation.Accuracy.Balanced });
      if (!isCurrent()) {
        return;
      }
      const user = { lat: position.coords.latitude, lng: position.coords.longitude };
      if (!isValidCoordinate(user.lat, user.lng)) {
        update({ phase: 'failed', userPoint: null, route: null });
        return;
      }
      const found = await fetchRoute(user, point, controller.signal);
      update({ phase: found ? 'shown' : 'located', userPoint: user, route: found });
    } catch {
      update({ phase: 'failed', userPoint: null, route: null });
    } finally {
      if (activeRequest.current === controller) {
        activeRequest.current = null;
      }
    }
  }, [point, key]);

  const openDirections = useCallback(() => {
    setDirectionsFailedKey(null);
    Linking.openURL(directionsUrl(point, address)).catch(() => setDirectionsFailedKey(key));
  }, [point, address, key]);

  return {
    point,
    loading: coordinates.status === 'loading',
    geocodeFailed: coordinates.status === 'error',
    retryGeocode: coordinates.reload,
    phase: current.phase,
    userPoint: current.userPoint,
    route: current.route,
    routingConfigured: isRoutingConfigured(),
    requestRoute,
    openDirections,
    directionsFailed: directionsFailedKey !== null && directionsFailedKey === key,
  };
}

export type PickupRoute = ReturnType<typeof usePickupRoute>;
