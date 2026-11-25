import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Screen } from '@/components/Screen';
import { InboxView } from '@/features/support/InboxView';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';

export default function MessagesTab() {
  const router = useRouter();
  const { goLogin, goRegister } = useAuthNavigation();
  const [refreshKey, setRefreshKey] = useState(0);
  const focused = useRef(false);
  useFocusEffect(useCallback(() => {
    if (focused.current) setRefreshKey((key) => key + 1);
    focused.current = true;
  }, []));

  return (
    <Screen scroll={false} padded={false} topInset grid testID="screen-messages">
      <RequireAuth message={lt.support.signedOutMessage} onLogin={goLogin} onRegister={goRegister}>
        <View style={styles.header}>
          <View style={styles.heading}>
            <Text style={typography.title} accessibilityRole="header">{lt.tabs.messages}</Text>
            <Text style={typography.caption}>{lt.support.service}</Text>
          </View>
          <View style={styles.icon} accessible={false}>
            <Ionicons name="chatbubbles-outline" size={26} color={colors.primary} />
          </View>
        </View>
        <RequireCustomer>
          <InboxView
            refreshKey={refreshKey}
            onOpen={(conversation) => router.push({ pathname: '/pokalbis/[id]', params: { id: String(conversation.pokalbio_id) } })}
            onNew={() => router.push('/pokalbis/naujas')}
          />
        </RequireCustomer>
      </RequireAuth>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.lg, paddingTop: spacing.lg },
  heading: { flex: 1, gap: spacing.xs },
  icon: { width: 52, height: 52, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
});
