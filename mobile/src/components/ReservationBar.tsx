import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, overlays, radius, spacing, typography } from '@/theme';

type Props = {
  // Pagrindinis užrašas, pvz. „Rezervuoti dabar“.
  label: string;
  price: string;
  priceUnit: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityHint?: string;
  testID?: string;
};

// Rezervavimo juosta ekrano apačioje: kapsulė su kaina, užrašu ir oranžiniu apskritimu.
export function ReservationBar({ label, price, priceUnit, onPress, disabled, accessibilityHint, testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={`${label}. ${price} ${priceUnit}`}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: Boolean(disabled) }}
      testID={testID}
      style={({ pressed }) => [styles.bar, pressed && styles.pressed, disabled && styles.disabled]}
    >
      <View style={styles.priceBlock}>
        <Text style={styles.price}>{price}</Text>
        <Text style={typography.caption}>{priceUnit}</Text>
      </View>
      <Text style={styles.label} numberOfLines={1}>
        {label}
      </Text>
      <View style={styles.circle}>
        <Ionicons name="arrow-forward" size={24} color={colors.textOnAccent} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingLeft: spacing.xl,
    paddingRight: spacing.sm,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  priceBlock: { alignItems: 'flex-start' },
  price: { ...typography.bodyStrong },
  label: { ...typography.button, color: colors.text, flex: 1, textAlign: 'right' },
  circle: {
    width: 56,
    height: 56,
    borderRadius: radius.pill,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});