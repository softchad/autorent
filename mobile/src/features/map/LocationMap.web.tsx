import { StyleSheet, Text, View } from 'react-native';
import { Location } from '@/api/types';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { LatLng } from './mapHtml';

// Ta pati sąsaja kaip native versijoje; žemėlapio duomenys čia nenaudojami.
type Props = {
  location: Location;
  point?: LatLng | null;
  loading?: boolean;
  userPoint?: LatLng | null;
  route?: LatLng[] | null;
  tilesUrl?: string;
  tilesAttribution?: string;
};

// Naršyklėje react-native-webview neveikia, todėl žemėlapis nerodomas ir WebView neimportuojamas.
export const MAP_SUPPORTED = false;

// Vietoje žemėlapio rodomas paėmimo vietos adresas; navigaciją galima atidaryti informacijos lape.
export function LocationMap({ location }: Props) {
  return (
    <View style={styles.placeholder} testID="map-web-fallback">
      <Text style={styles.note}>{lt.map.webUnavailable}</Text>
      <Text style={styles.address} selectable>
        {location.adresas}
      </Text>
    </View>
  );
}

// Be žemėlapio plytelių autorystė nerodoma.
export function MapAttribution(_props: { tilesUrl?: string; tilesAttribution?: string }) {
  return null;
}

const styles = StyleSheet.create({
  placeholder: { flex: 1, backgroundColor: colors.surfaceAlt, alignItems: 'center', paddingTop: 140, paddingHorizontal: spacing.xl, gap: spacing.sm },
  note: { ...typography.caption, textAlign: 'center' },
  address: { ...typography.bodyStrong, textAlign: 'center' },
});
