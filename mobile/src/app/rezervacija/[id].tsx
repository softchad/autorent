import { Stack, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { toUserMessage } from '@/api/errors';
import { fetchReservation } from '@/api/reservations';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { ReservationDetailView } from '@/features/reservations/ReservationDetailView';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';

function ReservationLoader({ reservationId }: { reservationId: number }) {
  const reservation = useAsync((signal) => fetchReservation(reservationId, signal), [reservationId]);
  const focused = useRef(false);
  const { reload } = reservation;
  useFocusEffect(useCallback(() => {
    if (focused.current) reload();
    focused.current = true;
  }, [reload]));

  if (reservation.status === 'loading') return <LoadingView />;
  if (!reservation.data) return <ErrorView message={toUserMessage(reservation.error)} onRetry={reload} />;
  return (
    <>
      {reservation.error ? (
        <View style={styles.refreshError}>
          <Text style={styles.errorText} accessibilityRole="alert">{toUserMessage(reservation.error)}</Text>
          <Button label={lt.common.retry} onPress={reload} variant="secondary" />
        </View>
      ) : null}
      {reservation.refreshing ? <Text style={styles.refreshing} accessibilityLiveRegion="polite">{lt.common.loading}</Text> : null}
      <ReservationDetailView reservation={reservation.data} />
    </>
  );
}

export default function ReservationScreen() {
  const { goLogin, goRegister } = useAuthNavigation();
  const rawId = useLocalSearchParams<{ id?: string | string[] }>().id;
  const reservationId = typeof rawId === 'string' && /^\d+$/.test(rawId) ? Number(rawId) : NaN;
  const valid = Number.isSafeInteger(reservationId) && reservationId > 0;
  return (
    <Screen grid testID="screen-reservation">
      <Stack.Screen options={{ title: lt.reservationDetail.title }} />
      <RequireAuth message={lt.reservations.signedOutMessage} onLogin={goLogin} onRegister={goRegister}>
        {valid ? (
          <RequireCustomer>
            <ReservationLoader key={reservationId} reservationId={reservationId} />
          </RequireCustomer>
        ) : <ErrorView message={lt.reservationDetail.invalid} />}
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  refreshError: { gap: spacing.sm, marginBottom: spacing.lg },
  errorText: { ...typography.caption, color: colors.danger },
  refreshing: { ...typography.caption, marginBottom: spacing.sm },
});
