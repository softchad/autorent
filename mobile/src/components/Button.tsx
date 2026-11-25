import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';
import {
  colors,
  fonts,
  MIN_TOUCH_SIZE,
  overlays,
  radius,
  spacing,
  typography,
} from '@/theme';

// accent – oranžinis pagrindinis veiksmas; primary – mėlynas įprastas veiksmas.
export type ButtonVariant =
  | 'primary'
  | 'accent'
  | 'secondary'
  | 'danger'
  | 'ghost';

export type IconName = ComponentProps<typeof Ionicons>['name'];

type Props = {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  disabled?: boolean;
  loading?: boolean;
  // Piktograma dešinėje teksto pusėje.
  icon?: IconName;
  // Papildomas paaiškinimas ekrano skaitytuvui.
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
};

// Kiekvieno varianto fonas, paspausto mygtuko fonas ir teksto spalva.
const PALETTE: Record<
  ButtonVariant,
  { background: string; pressed: string; text: string }
> = {
  primary: {
    background: colors.brand,
    pressed: colors.brandPressed,
    text: colors.textOnBrand,
  },
  accent: {
    background: colors.accent,
    pressed: colors.accentPressed,
    text: colors.textOnAccent,
  },
  secondary: {
    background: colors.surface,
    pressed: colors.neutralSoft,
    text: colors.text,
  },
  danger: {
    background: colors.danger,
    pressed: colors.danger,
    text: colors.textOnPrimary,
  },
  ghost: {
    background: 'transparent',
    pressed: colors.neutralSoft,
    text: colors.primary,
  },
};

export function Button({
  label,
  onPress,
  variant = 'primary',
  disabled,
  loading,
  icon,
  accessibilityHint,
  testID,
  style,
}: Props) {
  // Kol vyksta veiksmas, mygtukas neaktyvus.
  const inactive = Boolean(disabled || loading);
  const palette = PALETTE[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{
        disabled: inactive,
        busy: Boolean(loading),
      }}
      testID={testID}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: pressed
            ? palette.pressed
            : palette.background,
        },
        variant === 'secondary' && styles.secondaryBorder,
        variant === 'accent' && styles.accent,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {variant === 'accent' ? (
        <LinearGradient
          colors={[colors.accentHighlight, colors.accent]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          pointerEvents="none"
          style={[styles.gradient, { borderRadius: style?.borderRadius ?? radius.md }]}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        <>
          <Text style={[typography.button, styles.text, variant === 'accent' && styles.accentText, { color: palette.text }]}>
            {label}
          </Text>
          {icon ? (
            <Ionicons name={icon} size={20} color={palette.text} />
          ) : null}
        </>
      )}
    </Pressable>
  );
}

type IconButtonProps = {
  icon: IconName;
  // Piktograma teksto neturi, todėl pavadinimas privalomas.
  accessibilityLabel: string;
  onPress: () => void;
  // glass – virš nuotraukos; surface – įprastas; accent – oranžinis.
  variant?: 'glass' | 'surface' | 'accent';
  size?: number;
  accessibilityHint?: string;
  testID?: string;
  style?: ViewStyle;
};

const ICON_PALETTE = {
  glass: {
    background: overlays.glass,
    border: overlays.glassBorder,
    icon: colors.text,
  },
  surface: {
    background: colors.surface,
    border: colors.borderStrong,
    icon: colors.text,
  },
  accent: {
    background: colors.accent,
    border: colors.accent,
    icon: colors.textOnAccent,
  },
};

// Apvalus mygtukas su piktograma.
export function IconButton({
  icon,
  accessibilityLabel,
  onPress,
  variant = 'surface',
  size = 48,
  accessibilityHint,
  testID,
  style,
}: IconButtonProps) {
  const palette = ICON_PALETTE[variant];

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      hitSlop={8}
      style={({ pressed }) => [
        styles.iconButton,
        {
          width: size,
          height: size,
          backgroundColor: palette.background,
          borderColor: palette.border,
        },
        pressed && styles.pressed,
        style,
      ]}
    >
      <Ionicons
        name={icon}
        size={Math.round(size * 0.46)}
        color={palette.icon}
      />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  gradient: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  accent: { minHeight: 56, borderRadius: radius.md },
  text: { textAlign: 'center', flexShrink: 1 },
  accentText: { fontFamily: fonts.bold, fontSize: 18, lineHeight: 26 },
  base: {
    minHeight: MIN_TOUCH_SIZE + 10,
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.md,
    borderRadius: radius.pill,
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  secondaryBorder: {
    borderWidth: 1,
    borderColor: colors.borderStrong,
  },
  // Paspaudus mygtukas šiek tiek sumažėja.
  pressed: {
    transform: [{ scale: 0.98 }],
  },
  inactive: {
    opacity: 0.45,
  },
  iconButton: {
    minWidth: MIN_TOUCH_SIZE,
    minHeight: MIN_TOUCH_SIZE,
    borderRadius: radius.pill,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
