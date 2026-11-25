import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import * as ExpoLocation from 'expo-location';
import { Linking } from 'react-native';
import { ApiError } from '@/api/errors';
import * as geocodeApi from '@/api/geocode';
import * as routingApi from '@/api/routing';
import { Location } from '@/api/types';
import { lt } from '@/i18n/lt';
import { DEFAULT_TILES_URL, escapeHtml } from './mapHtml';
import { handleMapNavigation, isAllowedMapUrl, LocationMap, MAP_SUPPORTED, MapAttribution } from './LocationMap';
import * as WebMap from './LocationMap.web';
import { RoutePanel, routeNote } from './RoutePanel';
import { directionsUrl, formatDistance, formatDuration, PickupRoute, usePickupRoute } from './usePickupRoute';

jest.mock('@/api/geocode');
jest.mock('@/api/routing');
jest.mock('expo-location', () => ({
  requestForegroundPermissionsAsync: jest.fn(),
  getForegroundPermissionsAsync: jest.fn(),
  getCurrentPositionAsync: jest.fn(),
  Accuracy: { Balanced: 3 },
}));
jest.mock('react-native-webview', () => {
  const { View } = jest.requireActual('react-native');
  return { WebView: (props: object) => <View {...props} /> };
});

const geocodeAddress = jest.mocked(geocodeApi.geocodeAddress);
const fetchRoute = jest.mocked(routingApi.fetchRoute);
const isRoutingConfigured = jest.mocked(routingApi.isRoutingConfigured);
const requestPermission = jest.mocked(ExpoLocation.requestForegroundPermissionsAsync);
const getPermission = jest.mocked(ExpoLocation.getForegroundPermissionsAsync);
const getPosition = jest.mocked(ExpoLocation.getCurrentPositionAsync);

const LOCATION: Location = { vietos_id: 1, pavadinimas: 'Vilnius Centras', adresas: 'Gedimino pr. 1, Vilnius', miestas: 'Vilnius' };
const LOCATION_2: Location = { vietos_id: 2, pavadinimas: 'Kaunas', adresas: 'Laisvės al. 1, Kaunas', miestas: 'Kaunas' };
const POINT = { lat: 54.6862, lng: 25.2859 };
const POINT_2 = { lat: 54.8972, lng: 23.8861 };
const USER = { lat: 54.7, lng: 25.3 };
const ROUTE = { points: [USER, POINT], distanceMeters: 2400, durationSeconds: 420 };
const CUSTOM_TILES = 'https://tiles.example.com/{z}/{x}/{y}.png';

const granted = { granted: true } as ExpoLocation.LocationPermissionResponse;
const notGranted = { granted: false } as ExpoLocation.LocationPermissionResponse;
const position = (coords: { lat: number; lng: number }) => ({ coords: { latitude: coords.lat, longitude: coords.lng } }) as ExpoLocation.LocationObject;

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => {
    resolve = done;
  });
  return { promise, resolve };
}

function htmlData(html: string) {
  return JSON.parse(/var data = (.*);/.exec(html)![1]);
}

beforeEach(() => {
  getPermission.mockReset().mockResolvedValue(granted);
  geocodeAddress.mockReset().mockImplementation(async (address: string) => (address === LOCATION.adresas ? POINT : POINT_2));
  fetchRoute.mockReset().mockResolvedValue(ROUTE);
  isRoutingConfigured.mockReset().mockReturnValue(true);
  requestPermission.mockReset().mockResolvedValue(granted);
  getPosition.mockReset().mockResolvedValue(position(USER));
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('LocationMap', () => {
  it('turint koordinates rodo žemėlapį be image apvalkalo, kuris paslėptų autorystės nuorodas', async () => {
    await render(<LocationMap location={LOCATION} point={POINT} />);
    expect(screen.getByTestId('location-map').props.source.html).toContain('"lat":54.6862');
    expect(screen.queryByRole('image')).toBeNull();
  });

  it('kol koordinatės ieškomos, rodo krovimo tekstą, o neradus – paaiškinimą', async () => {
    const view = await render(<LocationMap location={LOCATION} point={null} loading />);
    expect(screen.getByTestId('map-loading')).toBeTruthy();
    await view.rerender(<LocationMap location={LOCATION} point={null} />);
    expect(screen.getByTestId('map-unavailable')).toBeTruthy();
    expect(screen.queryByTestId('location-map')).toBeNull();
  });

  it('netinkamų koordinačių nerodo', async () => {
    await render(<LocationMap location={LOCATION} point={{ lat: 999, lng: 25 }} />);
    expect(screen.getByTestId('map-unavailable')).toBeTruthy();
  });

  it('maršrutas į žemėlapį patenka tik kai jis perduotas', async () => {
    const view = await render(<LocationMap location={LOCATION} point={POINT} />);
    expect(screen.getByTestId('location-map').props.source.html).toContain('"route":[]');
    await view.rerender(<LocationMap location={LOCATION} point={POINT} userPoint={USER} route={ROUTE.points} />);
    expect(screen.getByTestId('location-map').props.source.html).toContain('"route":[{"lat":54.7,"lng":25.3}');
  });

  it('pasirinktinės plytelės perduodamos kartu su užkoduota autoryste', async () => {
    const attribution = '<img src=x onerror=alert(1)> Tiekėjas';
    await render(<LocationMap location={LOCATION} point={POINT} tilesUrl={CUSTOM_TILES} tilesAttribution={attribution} />);
    const data = htmlData(screen.getByTestId('location-map').props.source.html);
    expect(data.tilesUrl).toBe(CUSTOM_TILES);
    expect(data.attribution).toBe(escapeHtml(attribution));
  });

  it('pasirinktinės plytelės be autorystės pakeičiamos numatytosiomis OSM', async () => {
    await render(<LocationMap location={LOCATION} point={POINT} tilesUrl={CUSTOM_TILES} />);
    const data = htmlData(screen.getByTestId('location-map').props.source.html);
    expect(data.tilesUrl).toBe(DEFAULT_TILES_URL);
    expect(data.attribution).toContain('OpenStreetMap contributors');
  });

  it('WebView klaidos atveju rodomas paaiškinimas, o naujas puslapis bandomas iš naujo', async () => {
    const view = await render(<LocationMap location={LOCATION} point={POINT} />);
    expect(screen.getByTestId('location-map').props.domStorageEnabled).toBe(false);
    await act(() => screen.getByTestId('location-map').props.onError({ nativeEvent: {} }));
    expect(screen.getByTestId('map-unavailable')).toBeTruthy();
    expect(screen.getByText(lt.map.unavailable)).toBeTruthy();

    await view.rerender(<LocationMap location={LOCATION} point={POINT} userPoint={USER} route={ROUTE.points} />);
    expect(screen.getByTestId('location-map')).toBeTruthy();
  });

  it('WebView naudoja navigacijos filtrą', async () => {
    await render(<LocationMap location={LOCATION} point={POINT} />);
    expect(screen.getByTestId('location-map').props.onShouldStartLoadWithRequest).toBe(handleMapNavigation);
  });
});

describe('WebView dokumento navigacija', () => {
  it('leidžia tik sugeneruotą about:blank puslapį', () => {
    expect(isAllowedMapUrl('about:blank')).toBe(true);
    expect(isAllowedMapUrl('about:blank#x')).toBe(false);
    expect(isAllowedMapUrl('about:srcdoc')).toBe(false);
    expect(isAllowedMapUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isAllowedMapUrl('https://evil.example/phishing')).toBe(false);
  });

  it('svetimų nuorodų neatidaro ir neleidžia joms įsikelti', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined);
    expect(handleMapNavigation({ url: 'https://evil.example' })).toBe(false);
    expect(handleMapNavigation({ url: 'data:text/html,x' })).toBe(false);
    expect(handleMapNavigation({ url: 'about:srcdoc' })).toBe(false);
    expect(handleMapNavigation({ url: 'about:blank', isTopFrame: false })).toBe(false);
    expect(openURL).not.toHaveBeenCalled();
    expect(handleMapNavigation({ url: 'about:blank', isTopFrame: true })).toBe(true);
    expect(handleMapNavigation({ url: 'about:blank' })).toBe(true);
  });

  it('autorystės nuorodas atidaro išorinėje naršyklėje, o ne WebView viduje', () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined);
    expect(handleMapNavigation({ url: 'https://www.openstreetmap.org/copyright' })).toBe(false);
    expect(handleMapNavigation({ url: 'https://leafletjs.com/' })).toBe(false);
    expect(openURL.mock.calls.map(([url]) => url)).toEqual(['https://www.openstreetmap.org/copyright', 'https://leafletjs.com/']);
  });
});

describe('MapAttribution', () => {
  it('numatytoji OSM autorystė pasiekiama kaip nuoroda', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined);
    await render(<MapAttribution tilesUrl={undefined} tilesAttribution={undefined} />);
    const link = screen.getByRole('link', { name: lt.map.attribution(lt.map.osmAttribution) });
    await fireEvent.press(link);
    expect(openURL).toHaveBeenCalledWith('https://www.openstreetmap.org/copyright');
  });

  it('pasirinktinė autorystė rodoma kaip paprastas tekstas', async () => {
    const attribution = '<b>Tiekėjas</b>';
    await render(<MapAttribution tilesUrl={CUSTOM_TILES} tilesAttribution={attribution} />);
    expect(screen.getByText(lt.map.attribution(attribution))).toBeTruthy();
    expect(screen.queryByRole('link')).toBeNull();
  });

  it('netinkamos pasirinktinės plytelės rodo OSM autorystę', async () => {
    await render(<MapAttribution tilesUrl="https://tiles.example.com/map.png" tilesAttribution="Tiekėjas" />);
    expect(screen.getByRole('link', { name: lt.map.attribution(lt.map.osmAttribution) })).toBeTruthy();
  });
});

describe('LocationMap web versija', () => {
  it('neimportuoja react-native-webview', () => {
    jest.isolateModules(() => {
      jest.doMock('react-native-webview', () => {
        throw new Error('WebView web versijoje neturi būti importuojamas');
      });
      expect(() => require('./LocationMap.web')).not.toThrow();
    });
  });

  it('vietoje žemėlapio rodo paėmimo vietos adresą', async () => {
    await render(<WebMap.LocationMap location={LOCATION} point={POINT} />);
    expect(screen.getByTestId('map-web-fallback')).toBeTruthy();
    expect(screen.getByText(LOCATION.adresas)).toBeTruthy();
    expect(screen.queryByTestId('location-map')).toBeNull();
    expect(WebMap.MAP_SUPPORTED).toBe(false);
    expect(MAP_SUPPORTED).toBe(true);
  });

  it('be žemėlapio plytelių autorystės nerodo', async () => {
    const view = await render(<WebMap.MapAttribution />);
    expect(view.toJSON()).toBeNull();
  });
});

describe('directionsUrl', () => {
  it('su koordinatėmis nurodo tikslą, be jų – ieško pagal adresą', () => {
    expect(directionsUrl(POINT, LOCATION.adresas)).toBe('https://www.google.com/maps/dir/?api=1&destination=54.6862,25.2859');
    expect(directionsUrl(null, LOCATION.adresas)).toBe('https://www.google.com/maps/search/?api=1&query=Gedimino%20pr.%201%2C%20Vilnius');
    expect(directionsUrl({ lat: 999, lng: 0 }, 'A')).toContain('query=A');
  });
});

describe('atstumo ir trukmės formatai', () => {
  it('formatDistance', () => {
    expect(formatDistance(850)).toBe('850 m');
    expect(formatDistance(12345)).toBe('12,3 km');
  });

  it('formatDuration', () => {
    expect(formatDuration(20)).toBe('1 min.');
    expect(formatDuration(420)).toBe('7 min.');
    expect(formatDuration(4500)).toBe('1 val. 15 min.');
  });
});

describe('usePickupRoute', () => {
  async function ready(location: Location = LOCATION) {
    const hook = await renderHook((props: { location: Location | null }) => usePickupRoute(props.location), { initialProps: { location } });
    await waitFor(() => expect(hook.result.current.point).not.toBeNull());
    return hook;
  }

  it('anksčiau suteiktas leidimas nesukelia automatinio GPS ar maršruto kvietimo', async () => {
    const { result, rerender } = await ready();
    await rerender({ location: LOCATION_2 });
    await waitFor(() => expect(result.current.point).toEqual(POINT_2));

    expect(result.current.phase).toBe('idle');
    expect(getPermission).not.toHaveBeenCalled();
    expect(requestPermission).not.toHaveBeenCalled();
    expect(getPosition).not.toHaveBeenCalled();
    expect(fetchRoute).not.toHaveBeenCalled();
    expect(geocodeAddress).toHaveBeenCalledWith('Gedimino pr. 1, Vilnius', expect.anything());
  });

  it('gavus leidimą parodo kliento vietą ir tikrą maršrutą', async () => {
    const { result } = await ready();
    await act(() => result.current.requestRoute());
    expect(result.current.phase).toBe('shown');
    expect(result.current.userPoint).toEqual(USER);
    expect(result.current.route).toEqual(ROUTE);
    expect(fetchRoute).toHaveBeenCalledWith(USER, POINT, expect.any(AbortSignal));
  });

  it('atsisakius leidimo vietos neskaito ir maršruto neieško', async () => {
    requestPermission.mockResolvedValue(notGranted);
    const { result } = await ready();
    await act(() => result.current.requestRoute());
    expect(result.current.phase).toBe('denied');
    expect(getPosition).not.toHaveBeenCalled();
    expect(fetchRoute).not.toHaveBeenCalled();
    expect(result.current.userPoint).toBeNull();
  });

  it('kai maršrutų paslauga maršruto negrąžina, linija nebraižoma (jokio išgalvoto maršruto)', async () => {
    fetchRoute.mockResolvedValue(null);
    const { result } = await ready();
    await act(() => result.current.requestRoute());
    expect(result.current.phase).toBe('located');
    expect(result.current.route).toBeNull();
    expect(result.current.userPoint).toEqual(USER);
  });

  it('vietos nustatymo klaida ar netinkamos GPS koordinatės parodomos kaip nepavykęs bandymas', async () => {
    getPosition.mockRejectedValueOnce(new Error('GPS išjungtas')).mockResolvedValueOnce(position({ lat: NaN, lng: 25 }));
    const { result } = await ready();
    await act(() => result.current.requestRoute());
    expect(result.current.phase).toBe('failed');
    await act(() => result.current.requestRoute());
    expect(result.current.phase).toBe('failed');
    expect(result.current.userPoint).toBeNull();
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('dvigubas paspaudimas sukuria tik vieną prašymą net prieš persipiešimą', async () => {
    const { result } = await ready();
    const requestRoute = result.current.requestRoute;
    await act(async () => {
      await Promise.all([requestRoute(), requestRoute()]);
    });
    expect(requestPermission).toHaveBeenCalledTimes(1);
    expect(getPosition).toHaveBeenCalledTimes(1);
    expect(fetchRoute).toHaveBeenCalledTimes(1);

    // Pasibaigus prašymui galima bandyti dar kartą.
    await act(() => result.current.requestRoute());
    expect(fetchRoute).toHaveBeenCalledTimes(2);
  });

  it('pasikeitus vietai senas maršrutas, kliento taškas ir būsena nerodomi net pirmame atvaizdavime', async () => {
    const renders: Array<{ address: string; phase: string; point: unknown; userPoint: unknown; route: unknown }> = [];
    let latest: PickupRoute | undefined;
    function Probe({ location }: { location: Location }) {
      const pickup = usePickupRoute(location);
      latest = pickup;
      renders.push({ address: location.adresas, phase: pickup.phase, point: pickup.point, userPoint: pickup.userPoint, route: pickup.route });
      return null;
    }

    const view = await render(<Probe location={LOCATION} />);
    await waitFor(() => expect(latest?.point).toEqual(POINT));
    await act(() => latest!.requestRoute());
    expect(latest?.phase).toBe('shown');

    const before = renders.length;
    await view.rerender(<Probe location={LOCATION_2} />);
    await waitFor(() => expect(latest?.point).toEqual(POINT_2));

    const after = renders.slice(before);
    expect(after.length).toBeGreaterThan(0);
    for (const snapshot of after) {
      expect(snapshot).toMatchObject({ address: LOCATION_2.adresas, phase: 'idle', userPoint: null, route: null });
      expect(snapshot.point).not.toEqual(POINT);
    }
  });

  it('pavėluotas maršruto atsakymas po vietos pakeitimo atmetamas, o užklausa atšaukiama', async () => {
    const pending = deferred<typeof ROUTE | null>();
    fetchRoute.mockReturnValue(pending.promise);
    const { result, rerender } = await ready();

    let request: Promise<void> = Promise.resolve();
    await act(async () => {
      request = result.current.requestRoute();
    });
    await waitFor(() => expect(fetchRoute).toHaveBeenCalledTimes(1));
    const signal = fetchRoute.mock.calls[0][2] as AbortSignal;

    await rerender({ location: LOCATION_2 });
    expect(signal.aborted).toBe(true);
    await act(async () => {
      pending.resolve(ROUTE);
      await request;
    });

    expect(result.current.phase).toBe('idle');
    expect(result.current.route).toBeNull();
    expect(result.current.userPoint).toBeNull();
  });

  it('pavėluotas leidimo atsakymas po vietos pakeitimo GPS nebeskaito', async () => {
    const pending = deferred<ExpoLocation.LocationPermissionResponse>();
    requestPermission.mockReturnValue(pending.promise);
    const { result, rerender } = await ready();

    let request: Promise<void> = Promise.resolve();
    await act(async () => {
      request = result.current.requestRoute();
    });
    expect(result.current.phase).toBe('asking');
    await rerender({ location: LOCATION_2 });
    expect(result.current.phase).toBe('idle');

    await act(async () => {
      pending.resolve(granted);
      await request;
    });
    expect(getPosition).not.toHaveBeenCalled();
    expect(fetchRoute).not.toHaveBeenCalled();
    expect(result.current.phase).toBe('idle');
  });

  it('pavėluotas GPS rezultatas po išmontavimo ignoruojamas ir maršruto neprašoma', async () => {
    const pending = deferred<ExpoLocation.LocationObject>();
    getPosition.mockReturnValue(pending.promise);
    const { result, unmount } = await ready();

    let request: Promise<void> = Promise.resolve();
    await act(async () => {
      request = result.current.requestRoute();
    });
    await waitFor(() => expect(getPosition).toHaveBeenCalledTimes(1));
    await unmount();

    await act(async () => {
      pending.resolve(position(USER));
      await request;
    });
    expect(fetchRoute).not.toHaveBeenCalled();
  });

  it('išmontavus atšaukia vykdomą maršruto užklausą', async () => {
    fetchRoute.mockReturnValue(deferred<null>().promise);
    const { result, unmount } = await ready();
    await act(async () => {
      void result.current.requestRoute();
    });
    await waitFor(() => expect(fetchRoute).toHaveBeenCalledTimes(1));
    const signal = fetchRoute.mock.calls[0][2] as AbortSignal;
    await unmount();
    expect(signal.aborted).toBe(true);
  });

  it('geokodavimo klaidą galima pakartoti', async () => {
    geocodeAddress.mockReset().mockRejectedValueOnce(new ApiError('server', 503)).mockResolvedValue(POINT);
    const { result } = await renderHook(() => usePickupRoute(LOCATION));
    await waitFor(() => expect(result.current.geocodeFailed).toBe(true));
    expect(result.current.point).toBeNull();

    await act(() => result.current.retryGeocode());
    await waitFor(() => expect(result.current.point).toEqual(POINT));
    expect(result.current.geocodeFailed).toBe(false);
    expect(geocodeAddress).toHaveBeenCalledTimes(2);
  });

  it('nerandant padalinio koordinačių maršruto prašyti negalima, bet navigaciją atidaryti galima pagal adresą', async () => {
    geocodeAddress.mockRejectedValue(new ApiError('not_found', 404, 'Koordinatės nerastos'));
    const openURL = jest.spyOn(Linking, 'openURL').mockClear().mockResolvedValue(undefined);
    const { result } = await renderHook(() => usePickupRoute(LOCATION));
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(() => result.current.requestRoute());
    expect(requestPermission).not.toHaveBeenCalled();
    await act(async () => result.current.openDirections());
    expect(openURL).toHaveBeenCalledWith(expect.stringContaining('query=Gedimino'));
    expect(result.current.directionsFailed).toBe(false);
  });

  it('nepavykus atidaryti navigacijos klaida nenutylima', async () => {
    const openURL = jest.spyOn(Linking, 'openURL').mockClear().mockRejectedValueOnce(new Error('nėra programos')).mockResolvedValue(undefined);
    const { result } = await ready();
    await act(async () => result.current.openDirections());
    await waitFor(() => expect(result.current.directionsFailed).toBe(true));

    await act(async () => result.current.openDirections());
    expect(result.current.directionsFailed).toBe(false);
    expect(openURL).toHaveBeenCalledTimes(2);
  });
});

describe('RoutePanel', () => {
  function makeRoute(overrides: Partial<PickupRoute> = {}): PickupRoute {
    return {
      point: POINT,
      loading: false,
      geocodeFailed: false,
      retryGeocode: jest.fn(),
      phase: 'idle',
      userPoint: null,
      route: null,
      routingConfigured: true,
      requestRoute: jest.fn(),
      openDirections: jest.fn(),
      directionsFailed: false,
      ...overrides,
    };
  }

  it('trumpai nurodo koordinačių perdavimą ir leidžia prašyti maršruto', async () => {
    const route = makeRoute();
    await render(<RoutePanel route={route} />);
    expect(screen.queryByText('Parodykime kelią iki tavo automobilio.')).toBeNull();
    expect(screen.getByText(lt.route.explanationWithService)).toBeTruthy();
    expect(lt.route.explanationWithService).toContain('maršrutų paslaugai');
    await fireEvent.press(screen.getByRole('button', { name: lt.route.show }));
    expect(route.requestRoute).toHaveBeenCalledTimes(1);
  });

  it('be maršrutų paslaugos nemini koordinačių siuntimo', () => {
    expect(routeNote({ phase: 'idle', route: null, routingConfigured: false })).toBe(lt.route.explanation);
    expect(lt.route.explanation).not.toContain('paslaug');
  });

  it('išorinė navigacija pasiekiama visada – ir atsisakius leidimo', async () => {
    const route = makeRoute({ phase: 'denied' });
    await render(<RoutePanel route={route} />);
    expect(screen.getByText(lt.route.denied)).toBeTruthy();
    expect(screen.queryByTestId('route-show')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: lt.route.openExternal }));
    expect(route.openDirections).toHaveBeenCalledTimes(1);
  });

  it('nepavykus atidaryti navigacijos rodo pranešimą', async () => {
    await render(<RoutePanel route={makeRoute({ directionsFailed: true })} />);
    expect(screen.getByRole('alert')).toHaveTextContent(lt.route.openFailed);
  });

  it('geokodavimo klaidai siūlo pakartoti', async () => {
    const route = makeRoute({ point: null, geocodeFailed: true });
    await render(<RoutePanel route={route} />);
    expect(screen.getByRole('alert')).toHaveTextContent(lt.map.geocodeFailed);
    await fireEvent.press(screen.getByRole('button', { name: lt.common.retry }));
    expect(route.retryGeocode).toHaveBeenCalledTimes(1);
  });

  it('web versijoje maršruto mygtuko nerodo, bet palieka išorinę navigaciją', async () => {
    const route = makeRoute();
    await render(<RoutePanel route={route} mapSupported={false} />);
    expect(screen.getByText(lt.route.webFallback)).toBeTruthy();
    expect(screen.queryByTestId('route-show')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: lt.route.openExternal }));
    expect(route.openDirections).toHaveBeenCalledTimes(1);
  });

  it('routeNote sąžiningai pasako, kas parodyta', () => {
    expect(routeNote({ phase: 'shown', route: ROUTE, routingConfigured: true })).toBe('Maršrutas automobiliu: 2,4 km, apie 7 min.');
    expect(routeNote({ phase: 'located', route: null, routingConfigured: true })).toBe(lt.route.unavailable);
    expect(routeNote({ phase: 'located', route: null, routingConfigured: false })).toBe(lt.route.notConfigured);
    expect(routeNote({ phase: 'failed', route: null, routingConfigured: true })).toBe(lt.route.failed);
  });
});
