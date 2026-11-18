import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Button } from '@/components/Button';
import { LoadingView } from '@/components/StateViews';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
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
      <Text style={typography.heading}>{lt.requireAuth.title}</Text>
      <Text style={styles.message}>{notice ?? message}</Text>
      <Button label={lt.requireAuth.login} onPress={onLogin} testID="require-auth-login" style={styles.button} />
      <Button
        label={lt.requireAuth.register}
        onPress={onRegister}
        variant="secondary"
        testID="require-auth-register"
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, justifyContent: 'center', padding: spacing.xl, gap: spacing.md },
  message: { ...typography.body, color: colors.textMuted },
  button: { alignSelf: 'stretch' },
});
