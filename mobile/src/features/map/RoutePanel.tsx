import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { formatDistance, formatDuration, PickupRoute } from './usePickupRoute';

type Props = {
  route: PickupRoute;
  // Ar šioje platformoje rodomas žemėlapis; be jo maršruto mygtukas nerodomas.
  mapSupported?: boolean;
};

// Sąžiningas būsenos tekstas: maršrutas rodomas tik jei jį tikrai gavome iš maršrutų paslaugos.
export function routeNote(route: Pick<PickupRoute, 'phase' | 'route' | 'routingConfigured'>, mapSupported = true): string {
  if (!mapSupported) {
    return lt.route.webFallback;
  }
  switch (route.phase) {
    case 'shown':
      return route.route ? lt.route.shown(formatDistance(route.route.distanceMeters), formatDuration(route.route.durationSeconds)) : lt.route.unavailable;
    case 'located':
      return route.routingConfigured ? lt.route.unavailable : lt.route.notConfigured;
    case 'denied':
      return lt.route.denied;
    case 'failed':
      return lt.route.failed;
    case 'asking':
      return lt.route.asking;
    default:
      return route.routingConfigured ? lt.route.explanationWithService : lt.route.explanation;
  }
}

// Maršruto iki paėmimo vietos valdikliai ir būsena.
export function RoutePanel({ route, mapSupported = true }: Props) {
  const canAsk = mapSupported && (route.phase === 'idle' || route.phase === 'failed' || route.phase === 'asking');

  return (
    <View style={styles.panel} testID="route-panel">
      <Text style={styles.note} accessibilityLiveRegion="polite" testID="route-note">
        {routeNote(route, mapSupported)}
      </Text>
      {route.geocodeFailed ? (
        <View style={styles.state}>
          <Text style={styles.error} accessibilityRole="alert" testID="geocode-error">
            {lt.map.geocodeFailed}
          </Text>
          <Button label={lt.common.retry} onPress={route.retryGeocode} variant="secondary" testID="geocode-retry" />
        </View>
      ) : null}
      {canAsk ? (
        <Button
          label={lt.route.show}
          onPress={route.requestRoute}
          loading={route.phase === 'asking'}
          disabled={!route.point}
          icon="navigate-outline"
          testID="route-show"
        />
      ) : null}
      {/* Išorinė navigacija veikia visada – jai nereikia nei leidimo, nei maršrutų paslaugos. */}
      <Button label={lt.route.openExternal} onPress={route.openDirections} variant="secondary" icon="open-outline" testID="route-external" />
      {route.directionsFailed ? (
        <Text style={styles.error} accessibilityRole="alert" testID="route-external-failed">
          {lt.route.openFailed}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  panel: { marginTop: spacing.lg, paddingTop: spacing.lg, borderTopWidth: 1, borderTopColor: colors.neutralSoft, gap: spacing.md },
  note: { ...typography.caption },
  state: { gap: spacing.sm, alignItems: 'flex-start' },
  error: { ...typography.bodyStrong, color: colors.danger },
});
