import { useEffect, useRef } from 'react';
import { ActivityIndicator, Animated, StyleSheet, Text, View } from 'react-native';
import { Quote } from '@/api/booking';
import { toUserMessage } from '@/api/errors';
import { Card } from '@/components/Card';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { formatDays, formatMoney } from '@/utils/format';
import { priceDifference, PriceState } from './priceRequest';

type Props = {
  state: PriceState<Quote>;
};

function Line({ label, amount, strong }: { label: string; amount: number; strong?: boolean }) {
  const textStyle = strong ? styles.totalText : typography.body;
  return (
    <View style={styles.line} accessible accessibilityLabel={`${label}: ${formatMoney(amount)}`}>
      <Text style={[textStyle, styles.lineLabel]}>{label}</Text>
      <Text style={textStyle}>{formatMoney(amount)}</Text>
    </View>
  );
}

// Tekstas apie kainos pokytį, pvz. „Kaina padidėjo 48,00 €“.
export function changeText(difference: number | null): string | null {
  if (difference === null || difference === 0) {
    return null;
  }
  const amount = formatMoney(Math.abs(difference));
  return difference > 0 ? lt.price.increased(amount) : lt.price.decreased(amount);
}

export function PriceBreakdown({ state }: Props) {
  const total = state.quote?.viso ?? null;
  const pulse = useRef(new Animated.Value(1)).current;
  const reduced = useReducedMotion();

  // Pasikeitus sumai ji trumpam išryškinama (sumažinto judesio režimu – ne).
  useEffect(() => {
    if (total === null || reduced) {
      pulse.setValue(1);
      return;
    }
    pulse.setValue(0.35);
    const animation = Animated.timing(pulse, { toValue: 1, duration: 400, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [total, pulse, reduced]);

  const quote = state.quote;
  const change = changeText(priceDifference(state));

  return (
    <Card testID="price-breakdown">
      <Text style={styles.title} accessibilityRole="header">
        {lt.price.title}
      </Text>

      {state.status === 'idle' ? <Text style={styles.note}>{lt.price.choosePeriod}</Text> : null}

      {state.status === 'loading' ? (
        <View style={styles.loading} accessibilityLabel={lt.price.calculating} testID="price-loading">
          <ActivityIndicator color={colors.primary} />
          <Text style={styles.note}>{lt.price.calculating}</Text>
        </View>
      ) : null}

      {state.status === 'error' ? (
        <Text style={styles.error} accessibilityRole="alert">
          {toUserMessage(state.error)}
        </Text>
      ) : null}

      {quote ? (
        <Animated.View style={{ opacity: pulse }}>
          <Line
            label={lt.price.rental(formatDays(quote.paru_skaicius), formatMoney(quote.kaina_parai))}
            amount={quote.nuomos_suma}
          />
          {quote.paslaugos.map((line) => (
            <Line
              key={line.kodas}
              label={lt.price.extra(line.pavadinimas, formatDays(quote.paru_skaicius), formatMoney(line.kaina_parai))}
              amount={line.suma}
            />
          ))}
          <View style={styles.divider} />
          <Line label={lt.price.total} amount={quote.viso} strong />
          {change ? (
            <Text style={styles.change} accessibilityLiveRegion="polite" testID="price-change">
              {change}
            </Text>
          ) : null}
        </Animated.View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, marginBottom: spacing.sm },
  line: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, marginBottom: spacing.xs },
  lineLabel: { flex: 1 },
  totalText: { ...typography.heading, color: colors.primary },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  loading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  note: { ...typography.caption, marginTop: spacing.xs },
  error: { ...typography.bodyStrong, color: colors.danger },
  change: { ...typography.bodyStrong, color: colors.warning, marginTop: spacing.xs },
});
