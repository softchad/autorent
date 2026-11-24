import { useEffect, useMemo, useRef } from 'react';
import { RefreshControl, SectionList, StyleSheet, Text } from 'react-native';
import { toUserMessage } from '@/api/errors';
import { fetchReservations } from '@/api/reservations';
import { CustomerReservation } from '@/api/types';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { groupReservations } from './grouping';
import { ReservationCard } from './ReservationCard';

type Props = {
  // Be jo kortelės nepaspaudžiamos.
  onOpen?: (reservation: CustomerReservation) => void;
  onBrowse: () => void;
  // Padidinus skaičių sąrašas užkraunamas iš naujo (pvz. grįžus į ekraną po atšaukimo).
  refreshKey?: number;
};

export function ReservationsView({ onOpen, onBrowse, refreshKey = 0 }: Props) {
  const reservations = useAsync((signal) => fetchReservations(signal), []);
  const { reload } = reservations;

  // To paties kliento sąrašas atnaujinamas fone: rodomos rezervacijos lieka, kol ateina naujos.
  const shownRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (shownRefreshKey.current !== refreshKey) {
      shownRefreshKey.current = refreshKey;
      reload();
    }
  }, [refreshKey, reload]);

  const sections = useMemo(() => {
    const { current, past } = groupReservations(reservations.data ?? []);
    return [
      { title: lt.reservations.current, data: current },
      { title: lt.reservations.past, data: past },
    ].filter((section) => section.data.length > 0);
  }, [reservations.data]);

  if (reservations.status === 'loading') {
    return <LoadingView />;
  }
  if (reservations.status === 'error') {
    return <ErrorView message={toUserMessage(reservations.error)} onRetry={reload} />;
  }
  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => String(item.rezervacijos_id)}
      renderItem={({ item }) => <ReservationCard reservation={item} onPress={onOpen ? () => onOpen(item) : undefined} />}
      renderSectionHeader={({ section }) => (
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {section.title}
        </Text>
      )}
      contentContainerStyle={styles.list}
      stickySectionHeadersEnabled={false}
      refreshControl={<RefreshControl refreshing={reservations.refreshing} onRefresh={reload} tintColor={colors.primary} />}
      ListHeaderComponent={
        reservations.error ? (
          // Atnaujinti nepavyko: rodomos anksčiau gautos rezervacijos ir paaiškinimas.
          <Text style={styles.refreshError} accessibilityRole="alert" testID="reservations-refresh-error">
            {toUserMessage(reservations.error)}
          </Text>
        ) : undefined
      }
      ListEmptyComponent={
        <EmptyView
          title={lt.reservations.emptyTitle}
          message={lt.reservations.emptyMessage}
          actionLabel={lt.reservations.browse}
          onAction={onBrowse}
        />
      }
      testID="reservation-list"
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm, marginTop: spacing.sm },
  refreshError: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
});
