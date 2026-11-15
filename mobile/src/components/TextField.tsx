import { useState } from 'react';
import {
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
} from 'react-native';
import {
  colors,
  MIN_TOUCH_SIZE,
  radius,
  spacing,
  typography,
} from '@/theme';

type Props = Omit<TextInputProps, 'style'> & {
  label: string;
  // Klaidos tekstas rodomas po lauku.
  error?: string | null;
  hint?: string;
};

export function TextField({
  label,
  error,
  hint,
  onFocus,
  onBlur,
  ...inputProps
}: Props) {
  const hasError = Boolean(error);

  // Aktyvus laukas paryškinamas žydru rėmeliu.
  const [focused, setFocused] = useState(false);

  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>

      <TextInput
        {...inputProps}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        accessibilityLabel={label}
        accessibilityHint={
          hasError ? (error ?? undefined) : hint
        }
        placeholderTextColor={colors.textMuted}
        selectionColor={colors.primary}
        keyboardAppearance="dark"
        style={[
          styles.input,
          focused && styles.inputFocused,
          hasError && styles.inputError,
        ]}
      />

      {hasError ? (
        <Text
          style={styles.error}
          accessibilityLiveRegion="polite"
          accessibilityRole="alert"
        >
          {error}
        </Text>
      ) : hint ? (
        <Text style={styles.hint}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing.lg,
  },
  label: {
    ...typography.label,
    marginBottom: spacing.sm,
  },
  input: {
    ...typography.body,
    minHeight: MIN_TOUCH_SIZE + 10,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceAlt,
  },
  inputFocused: {
    borderColor: colors.primary,
  },
  inputError: {
    borderColor: colors.danger,
    borderWidth: 2,
  },
  error: {
    ...typography.caption,
    color: colors.danger,
    marginTop: spacing.xs,
  },
  hint: {
    ...typography.caption,
    marginTop: spacing.xs,
  },
});