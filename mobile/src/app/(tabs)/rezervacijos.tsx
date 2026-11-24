import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, Text } from 'react-native';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Screen } from '@/components/Screen';
import { ReservationsView } from '@/features/reservations/ReservationsView';
import { lt } from '@/i18n/lt';
import { spacing, typography } from '@/theme';

export default function ReservationsTab() {
  const router = useRouter();
  const { goLogin, goRegister } = useAuthNavigation();
  const [refreshKey, setRefreshKey] = useState(0);
  useFocusEffect(useCallback(() => {
    setRefreshKey((key) => key + 1);
  }, []));

  return (
    <Screen scroll={false} padded={false} topInset grid testID="screen-reservations">
      <Text style={styles.title} accessibilityRole="header">{lt.reservations.title}</Text>
      <RequireAuth message={lt.reservations.signedOutMessage} onLogin={goLogin} onRegister={goRegister}>
        <RequireCustomer>
          <ReservationsView
            refreshKey={refreshKey}
            onBrowse={() => router.navigate('/')}
          />
        </RequireCustomer>
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.title, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
});
