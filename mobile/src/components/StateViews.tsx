import { Ionicons } from '@expo/vector-icons';
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { Button, IconName } from './Button';

export function LoadingView({
  message = lt.common.loading,
}: {
  message?: string;
}) {
  return (
    <View
      style={styles.center}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={message}
      testID="loading-view"
    >
      <ActivityIndicator size="large" color={colors.primary} />
      <Text style={styles.message}>{message}</Text>
    </View>
  );
}

// Apvalus ženklas virš būsenos teksto. Tik dekoracija, todėl nuo ekrano skaitytuvo paslėptas;
// būsenos tekstas ir mygtukai lieka prieinami.
function StateIcon({
  name,
  color,
  background,
}: {
  name: IconName;
  color: string;
  background: string;
}) {
  return (
    <View
      style={[styles.icon, { backgroundColor: background }]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="state-icon"
    >
      <Ionicons name={name} size={30} color={color} />
    </View>
  );
}

type ErrorProps = {
  message: string;
  // Jei nurodyta, rodomas pakartojimo mygtukas.
  onRetry?: () => void;
};

export function ErrorView({ message, onRetry }: ErrorProps) {
  return (
    <View style={styles.center} testID="error-view">
      <StateIcon
        name="alert-circle-outline"
        color={colors.danger}
        background={colors.dangerSoft}
      />

      <Text
        style={styles.errorTitle}
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
      >
        {message}
      </Text>

      {onRetry ? (
        <Button
          label={lt.common.retry}
          onPress={onRetry}
          variant="secondary"
          icon="refresh"
          testID="retry-button"
        />
      ) : null}
    </View>
  );
}

type EmptyProps = {
  title: string;
  message?: string;
  actionLabel?: string;
  onAction?: () => void;
  icon?: IconName;
};

export function EmptyView({
  title,
  message,
  actionLabel,
  onAction,
  icon = 'search-outline',
}: EmptyProps) {
  return (
    <View style={styles.center} testID="empty-view">
      <StateIcon
        name={icon}
        color={colors.primary}
        background={colors.primarySoft}
      />

      <Text style={styles.emptyTitle}>{title}</Text>

      {message ? (
        <Text style={styles.message}>{message}</Text>
      ) : null}

      {actionLabel && onAction ? (
        <Button
          label={actionLabel}
          onPress={onAction}
          testID="empty-action"
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  center: {
    flexGrow: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
    gap: spacing.md,
  },
  icon: {
    width: 68,
    height: 68,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  message: {
    ...typography.body,
    color: colors.textMuted,
    textAlign: 'center',
  },
  errorTitle: {
    ...typography.bodyStrong,
    color: colors.danger,
    textAlign: 'center',
  },
  emptyTitle: {
    ...typography.heading,
    textAlign: 'center',
  },
});