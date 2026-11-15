import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '@/theme';

export type BadgeTone = 'success' | 'warning' | 'danger' | 'info' | 'neutral';

// Kiekvienas tonas – teksto ir fono pora, kurios kontrastą tikrina paletės testas.
const TONES: Record<BadgeTone, { text: string; background: string }> = {
  success: { text: colors.success, background: colors.successSoft },
  warning: { text: colors.warning, background: colors.warningSoft },
  danger: { text: colors.danger, background: colors.dangerSoft },
  info: { text: colors.primary, background: colors.primarySoft },
  neutral: { text: colors.textMuted, background: colors.neutralSoft },
};

type Props = {
  label: string;
  tone?: BadgeTone;
  testID?: string;
};

// Būsena perteikiama tekstu, ne vien spalva (WCAG 1.4.1).
export function Badge({ label, tone = 'neutral', testID }: Props) {
  const palette = TONES[tone];
  return (
    <View style={[styles.badge, { backgroundColor: palette.background, borderColor: palette.text }]} testID={testID}>
      <Text style={[styles.label, { color: palette.text }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  label: { ...typography.caption, fontFamily: fonts.semibold },
});