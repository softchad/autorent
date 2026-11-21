// Žemėlapis rodomas WebView viduje su Leaflet – taip pat kaip svetainėje, be API rakto.

export type MapPoint = {
  lat: number;
  lng: number;
  title: string;
  address: string;
};

export type LatLng = { lat: number; lng: number };

export type MapOptions = {
  // Kliento buvimo vieta; rodoma tik jam pačiam leidus.
  userPoint?: LatLng | null;
  // Tikro maršruto taškai iš maršrutų paslaugos. Jei jų nėra, linija nebraižoma – išgalvotų maršrutų nerodome.
  route?: LatLng[] | null;
  tilesUrl?: string;
  attribution?: string;
};

// Konkreti Leaflet versija su SRI maišos reikšmėmis: naršyklė atmes failą, jei CDN jis būtų pakeistas.
const LEAFLET_VERSION = '1.9.4';
const LEAFLET_CSS_SRI = 'sha256-p4NxAoJBhIIN+hmNHrzRCf9tD/miZyoHS5obTRR9BMY=';
const LEAFLET_JS_SRI = 'sha256-20nQCchB9co0qIjJZRGuk2/Z9VM+kNiyxNV1lvTlZBo=';

// OpenStreetMap plyteles patamsinamos CSS filtru; autorystes nuoroda lieka matoma.
export const DEFAULT_TILES_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const DEFAULT_ATTRIBUTION = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap contributors</a>';

// Spalvos sutampa su programėlės tema (theme/colors.ts): fonas, oranžinis žymeklis, žydras maršrutas.
const MAP_BACKGROUND = '#0B121F';
const MARKER_COLOR = '#FF7A1A';
const ROUTE_COLOR = '#5CC8F0';

export function isValidCoordinate(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

// Duomenys į <script> įterpiami kaip JSON; „<“ pakeičiamas, kad tekstas negalėtų užbaigti script žymos.
export function toSafeScriptJson(value: unknown): string {
  // Pavojingi simboliai pakeičiami JavaScript kodais (pvz. „<“ → BACKSLASH + "u003c").
  const BACKSLASH = String.fromCharCode(92);
  const escapeCode = (charCode: number) => BACKSLASH + 'u' + charCode.toString(16).padStart(4, '0');
  // 0x3c – „<“; 0x2028 ir 0x2029 – eilutės skyrikliai, galintys nutraukti JavaScript eilutę.
  let json = JSON.stringify(value);
  for (const charCode of [0x3c, 0x2028, 0x2029]) {
    json = json.split(String.fromCharCode(charCode)).join(escapeCode(charCode));
  }
  return json;
}

// Leaflet autorystę įrašo kaip HTML, todėl pasirinktinis tekstas užkoduojamas ir rodomas tik kaip tekstas.
export function escapeHtml(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Paprastas plytelių šablono patikrinimas, ne pilnas URL validatorius. Priimama tik:
// https://, domeno vardas iš raidžių, skaitmenų ir brūkšnelių žymių (žymė gali būti {s}), paskutinė žymė – bent dvi raidės;
// be IP adresų ir be naudotojo vardo ar slaptažodžio; neprivalomas prievadas; kelias tik iš leistinų ASCII simbolių
// (be tarpų, kabučių, @, # ir valdymo simbolių). Šablono vietos – tik {s}, {z}, {x}, {y}, {r}; {z}, {x} ir {y} privalomos.
const TILES_URL_PATTERN = /^https:\/\/(?:(?:[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?|\{s\})\.)+[A-Za-z]{2,}(?::\d{1,5})?\/[A-Za-z0-9\-._~/?&=%+,;:!$*(){}]*$/;
const TILE_PLACEHOLDERS = ['{s}', '{z}', '{x}', '{y}', '{r}'];
const REQUIRED_TILE_PLACEHOLDERS = ['{z}', '{x}', '{y}'];

export function isValidTilesUrl(url: string): boolean {
  if (!TILES_URL_PATTERN.test(url)) {
    return false;
  }
  const placeholders: string[] = url.match(/\{[^{}]*\}/g) ?? [];
  const withoutPlaceholders = url.replace(/\{[^{}]*\}/g, '');
  return (
    !/[{}]/.test(withoutPlaceholders) &&
    placeholders.every((placeholder) => TILE_PLACEHOLDERS.includes(placeholder)) &&
    REQUIRED_TILE_PLACEHOLDERS.every((placeholder) => placeholders.includes(placeholder))
  );
}

function validUserPoint(point: LatLng | null | undefined): LatLng | null {
  return point && isValidCoordinate(point.lat, point.lng) ? { lat: point.lat, lng: point.lng } : null;
}

// Maršrutas naudojamas tik visas: jei bent vienas taškas netinkamas, linija nebraižoma, kad nebūtų sujungta per tarpą.
function validRoute(route: LatLng[] | null | undefined): LatLng[] {
  const points = route ?? [];
  return points.every((point) => isValidCoordinate(point.lat, point.lng)) ? points.map(({ lat, lng }) => ({ lat, lng })) : [];
}

// Pasirinktinės plytelės naudojamos tik su tinkamu adresu ir netuščia autoryste; kitaip – numatytosios OSM plytelės su jų autoryste.
export function usesCustomTiles(options: Pick<MapOptions, 'tilesUrl' | 'attribution'>): boolean {
  return Boolean(options.tilesUrl && options.tilesUrl !== DEFAULT_TILES_URL && isValidTilesUrl(options.tilesUrl) && options.attribution?.trim());
}

function tileSource(options: MapOptions): { tilesUrl: string; attribution: string } {
  if (usesCustomTiles(options)) {
    return { tilesUrl: options.tilesUrl!, attribution: escapeHtml(options.attribution!.trim()) };
  }
  return { tilesUrl: DEFAULT_TILES_URL, attribution: DEFAULT_ATTRIBUTION };
}

export function buildMapHtml(point: MapPoint, options: MapOptions = {}): string {
  if (!isValidCoordinate(point.lat, point.lng)) {
    throw new Error('Netinkamos koordinatės');
  }
  const { tilesUrl, attribution } = tileSource(options);
  const data = toSafeScriptJson({
    point,
    user: validUserPoint(options.userPoint),
    route: validRoute(options.route),
    tilesUrl,
    darkTiles: tilesUrl === DEFAULT_TILES_URL,
    attribution,
  });
  const cdn = `https://unpkg.com/leaflet@${LEAFLET_VERSION}/dist`;

  return `<!DOCTYPE html>
<html lang="lt">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<link rel="stylesheet" href="${cdn}/leaflet.css" integrity="${LEAFLET_CSS_SRI}" crossorigin="">
<style>
  html, body, #map { height: 100%; margin: 0; background: ${MAP_BACKGROUND}; }
  .dark-tiles { filter: invert(100%) hue-rotate(180deg) brightness(0.8) saturate(0.35); }
  .pin { width: 22px; height: 22px; border-radius: 50%; background: ${MARKER_COLOR}; border: 4px solid #F7F7F7; box-shadow: 0 0 0 6px rgba(255, 122, 26, 0.28); }
  .me { width: 16px; height: 16px; border-radius: 50%; background: ${ROUTE_COLOR}; border: 3px solid #F7F7F7; }
  .leaflet-control-attribution { background: rgba(11, 18, 31, 0.78) !important; color: #8FA2BF !important; font-size: 10px; }
  .leaflet-control-attribution a { color: #8FA2BF !important; }
</style>
</head>
<body>
<div id="map"></div>
<div id="map-error" role="status" style="display:none;position:absolute;top:72px;left:20px;right:20px;padding:12px;background:#101827;color:#F7F7F7;border-radius:12px;z-index:1000;font:14px sans-serif">Nepavyko parodyti žemėlapio. Paėmimo adresą rasite automobilio informacijoje.</div>
<script src="${cdn}/leaflet.js" integrity="${LEAFLET_JS_SRI}" crossorigin=""></script>
<script>
  var data = ${data};
  var point = data.point;
  if (typeof L === 'undefined') { document.getElementById('map-error').style.display = 'block'; } else {
  var map = L.map('map', { zoomControl: false }).setView([point.lat, point.lng], 15);
  map.attributionControl.setPosition('topright');
  L.tileLayer(data.tilesUrl, { maxZoom: 19, subdomains: 'abcd', attribution: data.attribution, className: data.darkTiles ? 'dark-tiles' : '' }).on('tileerror', function () { document.getElementById('map-error').style.display = 'block'; }).addTo(map);
  var pin = L.divIcon({ className: '', html: '<div class="pin"></div>', iconSize: [30, 30], iconAnchor: [15, 15] });
  L.marker([point.lat, point.lng], { icon: pin, title: point.title }).addTo(map);
  var bounds = [[point.lat, point.lng]];
  if (data.user) {
    var me = L.divIcon({ className: '', html: '<div class="me"></div>', iconSize: [22, 22], iconAnchor: [11, 11] });
    L.marker([data.user.lat, data.user.lng], { icon: me }).addTo(map);
    bounds.push([data.user.lat, data.user.lng]);
  }
  if (data.route.length > 1) {
    var line = data.route.map(function (p) { return [p.lat, p.lng]; });
    L.polyline(line, { color: '${ROUTE_COLOR}', weight: 5, opacity: 0.9 }).addTo(map);
    bounds = bounds.concat(line);
  }
  if (bounds.length > 1) {
    // Apačioje paliekama daugiau vietos – ten ekrane yra automobilio kortelė ir informacijos lapas.
    map.fitBounds(bounds, { paddingTopLeft: [40, 90], paddingBottomRight: [40, 260] });
  }
  }
</script>
</body>
</html>`;
}
