import { Pressable, StyleSheet, Text } from 'react-native';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';

type Props = {
  label: string;
  selected: boolean;
  onPress: () => void;
  testID?: string;
};

// Pasirenkamas „burbulas“ filtrams ir rikiavimui. Pasirinkimą rodo ir spalva, ir rėmelio storis.
export function Chip({ label, selected, onPress, testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={({ pressed }) => [styles.chip, selected && styles.selected, pressed && styles.pressed]}
    >
      <Text style={[styles.label, selected && styles.selectedLabel]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: MIN_TOUCH_SIZE,
    minWidth: MIN_TOUCH_SIZE,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  // Pasirinktas burbulas – mėlynas su žydru rėmeliu (oranžinė paliekama pagrindiniams veiksmams).
  selected: { backgroundColor: colors.brand, borderColor: colors.primary, borderWidth: 2 },
  pressed: { opacity: 0.85 },
  label: { ...typography.caption, color: colors.text, fontFamily: fonts.medium },
  selectedLabel: { color: colors.textOnBrand, fontFamily: fonts.semibold },
});