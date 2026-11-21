import { useMemo, useState } from 'react';
import { Linking, StyleSheet, Text, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Location } from '@/api/types';
import { MAP_TILES_ATTRIBUTION, MAP_TILES_URL } from '@/config/env';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { buildMapHtml, isValidCoordinate, LatLng, usesCustomTiles } from './mapHtml';

type Props = {
  location: Location;
  // Padalinio koordinatės; null – dar ieškomos arba nerastos.
  point: LatLng | null;
  loading?: boolean;
  // Kliento vieta ir maršrutas atsiranda tik klientui paprašius (žr. usePickupRoute).
  userPoint?: LatLng | null;
  route?: LatLng[] | null;
  tilesUrl?: string;
  tilesAttribution?: string;
};

// Šioje platformoje žemėlapis rodomas WebView viduje.
export const MAP_SUPPORTED = true;

const OSM_COPYRIGHT_URL = 'https://www.openstreetmap.org/copyright';
// Tik žemėlapio autorystės nuorodos atidaromos išorinėje naršyklėje.
const EXTERNAL_LINKS = [OSM_COPYRIGHT_URL, 'https://leafletjs.com', 'https://leafletjs.com/'];

// Dokumento navigacija: leidžiamas tik pats sugeneruotas puslapis (source.html be baseUrl įkeliamas kaip about:blank).
// Tai ne resursų filtras: Leaflet failai ir plytelės kraunami be šio patikrinimo, jų adresus riboja mapHtml.
export function isAllowedMapUrl(url: string): boolean {
  return url === 'about:blank';
}

export function handleMapNavigation(request: { url: string; isTopFrame?: boolean }): boolean {
  if (EXTERNAL_LINKS.includes(request.url)) {
    Linking.openURL(request.url).catch(() => {});
    return false;
  }
  return request.isTopFrame !== false && isAllowedMapUrl(request.url);
}

// Tamsus žemėlapis per visą ekraną su padalinio žymekliu. Pasikeitus taškams puslapis sugeneruojamas iš naujo.
export function LocationMap({
  location,
  point,
  loading = false,
  userPoint,
  route,
  tilesUrl = MAP_TILES_URL,
  tilesAttribution = MAP_TILES_ATTRIBUTION,
}: Props) {
  const html = useMemo(() => {
    if (!point || !isValidCoordinate(point.lat, point.lng)) {
      return null;
    }
    return buildMapHtml(
      { lat: point.lat, lng: point.lng, title: location.pavadinimas, address: location.adresas },
      { userPoint, route, tilesUrl, attribution: tilesAttribution },
    );
  }, [point, userPoint, route, location.pavadinimas, location.adresas, tilesUrl, tilesAttribution]);
  // WebView klaida galioja tik tam puslapiui, kuriam ji įvyko.
  const [failedHtml, setFailedHtml] = useState<string | null>(null);

  // Žemėlapis – papildoma informacija: jo nepavykus parodyti, adresas vis tiek matomas tekstu.
  if (!html || failedHtml === html) {
    return (
      <View style={styles.placeholder} testID={loading && !html ? 'map-loading' : 'map-unavailable'}>
        <Text style={styles.note}>{loading && !html ? lt.map.loading : lt.map.unavailable}</Text>
      </View>
    );
  }
  return (
    <View style={styles.fill}>
      <WebView
        source={{ html }}
        originWhitelist={['*']}
        javaScriptEnabled
        domStorageEnabled={false}
        cacheEnabled
        applicationNameForUserAgent="AutoRent/1.0"
        setSupportMultipleWindows={false}
        onShouldStartLoadWithRequest={handleMapNavigation}
        onError={() => setFailedHtml(html)}
        onRenderProcessGone={() => setFailedHtml(html)}
        onContentProcessDidTerminate={() => setFailedHtml(html)}
        style={styles.web}
        testID="location-map"
      />
    </View>
  );
}

// Žemėlapio autorystė tekstu informacijos lape: pasiekiama ekrano skaitytuvui ir neuždengia autorystės pačiame žemėlapyje.
export function MapAttribution({ tilesUrl = MAP_TILES_URL, tilesAttribution = MAP_TILES_ATTRIBUTION }: { tilesUrl?: string; tilesAttribution?: string }) {
  if (usesCustomTiles({ tilesUrl, attribution: tilesAttribution })) {
    return (
      <Text style={styles.attribution} testID="map-attribution">
        {lt.map.attribution(tilesAttribution!.trim())}
      </Text>
    );
  }
  return (
    <Text
      style={[styles.attribution, styles.link]}
      accessibilityRole="link"
      onPress={() => Linking.openURL(OSM_COPYRIGHT_URL).catch(() => {})}
      testID="map-attribution"
    >
      {lt.map.attribution(lt.map.osmAttribution)}
    </Text>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  web: { flex: 1, backgroundColor: colors.background },
  placeholder: { flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', paddingTop: 140, paddingHorizontal: spacing.xl },
  note: { ...typography.caption, textAlign: 'center' },
  attribution: { ...typography.caption },
  link: { textDecorationLine: 'underline' },
});
