import { ReactNode } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/StateViews';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { useAuth } from './AuthContext';

type Props = {
  children: ReactNode;
  // Paaiškinimas, kodėl šiam ekranui reikia prisijungti.
  message?: string;
  onLogin: () => void;
  onRegister: () => void;
};

// Rodo turinį tik prisijungusiam klientui. Tai patogumo priemonė – duomenis saugo serveris,
// kuris kiekvienoje užklausoje pats tikrina tokeną.
export function RequireAuth({ children, message = lt.requireAuth.message, onLogin, onRegister }: Props) {
  const { status, notice } = useAuth();

  if (status === 'loading') {
    return <LoadingView />;
  }
  if (status === 'signedIn') {
    return <>{children}</>;
  }
  return (
    <View style={styles.container} testID="require-auth">
      <View style={styles.card}>
        <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name="person-outline" size={30} color={colors.primary} />
        </View>
        <Text style={styles.title}>{lt.requireAuth.title}</Text>
        <Text style={styles.message}>{notice ?? message}</Text>
        <Button label={lt.requireAuth.login} onPress={onLogin} variant="accent" testID="require-auth-login" style={styles.button} />
        <Button
          label={lt.requireAuth.register}
          onPress={onRegister}
          variant="secondary"
          testID="require-auth-register"
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg },
  card: { padding: spacing.xl, gap: spacing.md, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  icon: { width: 64, height: 64, borderRadius: 22, backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.brand, justifyContent: 'center', alignItems: 'center', alignSelf: 'center', marginBottom: spacing.sm },
  title: { ...typography.heading, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center', marginBottom: spacing.sm },
  button: { alignSelf: 'stretch', borderRadius: radius.md, minHeight: 52 },
});
