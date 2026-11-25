import { StyleSheet, Text, View } from 'react-native';
import { colors, fonts, spacing, typography } from '@/theme';
import { stepAccessibilityLabel, StepState, TimelineStep } from './timeline';

type Props = {
  steps: TimelineStep[];
};

const DOT_COLORS: Record<StepState, string> = {
  done: colors.success,
  current: colors.primary,
  upcoming: colors.border,
  failed: colors.danger,
};

// Simbolis taške papildo spalvą: būsena suprantama ir nespalvotai.
const DOT_SYMBOLS: Record<StepState, string> = {
  done: '✓',
  current: '●',
  upcoming: '',
  failed: '✕',
};

// Vertikali laiko juosta: taškas su linija kairėje, žingsnio tekstas dešinėje.
export function StatusTimeline({ steps }: Props) {
  return (
    <View testID="status-timeline">
      {steps.map((step, index) => {
        const isLast = index === steps.length - 1;
        return (
          <View
            key={step.key}
            style={styles.row}
            accessible
            accessibilityLabel={stepAccessibilityLabel(step)}
            testID={`timeline-step-${step.key}`}
          >
            <View style={styles.rail}>
              <View style={[styles.dot, { backgroundColor: DOT_COLORS[step.state] }, step.state === 'current' && styles.dotCurrent]}>
                <Text style={styles.symbol}>{DOT_SYMBOLS[step.state]}</Text>
              </View>
              {!isLast ? <View style={[styles.line, step.state === 'done' && styles.lineDone]} /> : null}
            </View>
            <View style={styles.text}>
              <Text style={[typography.body, step.state === 'current' && styles.currentLabel, step.state === 'upcoming' && styles.upcomingLabel]}>
                {step.label}
              </Text>
              {step.detail ? <Text style={typography.caption}>{step.detail}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const DOT_SIZE = 24;

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: spacing.md },
  rail: { alignItems: 'center', width: DOT_SIZE },
  dot: { width: DOT_SIZE, height: DOT_SIZE, borderRadius: DOT_SIZE / 2, alignItems: 'center', justifyContent: 'center' },
  dotCurrent: { borderWidth: 3, borderColor: colors.primarySoft },
  symbol: { color: colors.textOnPrimary, fontSize: 12, fontFamily: fonts.bold },
  line: { flex: 1, width: 2, minHeight: spacing.xl, backgroundColor: colors.border },
  lineDone: { backgroundColor: colors.success },
  text: { flex: 1, paddingBottom: spacing.lg },
  currentLabel: { fontFamily: fonts.bold, color: colors.primary },
  upcomingLabel: { color: colors.textMuted },
});
