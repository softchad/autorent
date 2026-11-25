import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, fonts, radius, spacing, typography } from '@/theme';

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

// Rezervavimo juosta ekrano apačioje: kaina ir pagrindinis veiksmas.
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
      <LinearGradient colors={[colors.accentHighlight, colors.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.action}>
        <Text style={styles.label}>{label}</Text>
        <Ionicons name="arrow-forward" size={24} color={colors.textOnAccent} />
      </LinearGradient>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: {
    minHeight: 72,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  pressed: { transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
  priceBlock: { alignItems: 'flex-start', paddingHorizontal: spacing.sm },
  price: { ...typography.price },
  label: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26, color: colors.textOnAccent, flexShrink: 1, textAlign: 'center' },
  action: {
    flex: 1,
    minHeight: 56,
    flexDirection: 'row',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: colors.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
