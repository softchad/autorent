import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { describeLoginError } from './loginErrors';
import { FieldErrors, hasErrors, LoginValues, validateLogin } from './validation';

type Props = {
  onSuccess: () => void;
  // Registracijos nuoroda rodoma tik tada, kai perduotas šis veiksmas.
  onGoRegister?: () => void;
};

export function LoginForm({ onSuccess, onGoRegister }: Props) {
  const { signIn, notice } = useAuth();
  const [values, setValues] = useState<LoginValues>({ email: '', password: '' });
  const [errors, setErrors] = useState<FieldErrors<keyof LoginValues>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Būsena atsinaujina tik po atvaizdavimo, todėl antrą pateikimą tame pačiame cikle stabdo ref.
  const submittingRef = useRef(false);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  // Įvykių apdorojimui Promise negrąžinamas; klaidos sugaunamos submitLogin viduje.
  function handleSubmit() {
    void submitLogin();
  }

  async function submitLogin() {
    if (submittingRef.current) {
      return;
    }

    const found = validateLogin(values);
    setErrors(found);
    setServerError(null);
    if (hasErrors(found)) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await signIn(values.email, values.password);
      if (mountedRef.current) {
        onSuccess();
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const failure = describeLoginError(error);
      if (failure?.field) {
        setErrors({ [failure.field]: failure.message });
      } else if (failure) {
        setServerError(failure.message);
      }
    } finally {
      submittingRef.current = false;
      if (mountedRef.current) {
        setSubmitting(false);
      }
    }
  }

  return (
    <View style={styles.form}>
      {notice ? (
        <Text style={styles.notice} accessibilityRole="alert" testID="login-notice">
          {notice}
        </Text>
      ) : null}
      <TextField
        label={lt.login.email}
        value={values.email}
        onChangeText={(email) => setValues((current) => ({ ...current, email }))}
        error={errors.email}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="email"
        textContentType="emailAddress"
        returnKeyType="next"
        testID="login-email"
      />
      <TextField
        label={lt.login.password}
        value={values.password}
        onChangeText={(password) => setValues((current) => ({ ...current, password }))}
        error={errors.password}
        secureTextEntry
        autoCapitalize="none"
        autoCorrect={false}
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={handleSubmit}
        testID="login-password"
      />
      {serverError ? (
        <Text style={styles.serverError} accessibilityRole="alert" testID="login-error">
          {serverError}
        </Text>
      ) : null}
      <Button label={lt.login.submit} onPress={handleSubmit} variant="accent" loading={submitting} testID="login-submit" />
      {onGoRegister ? (
        <View style={styles.registerRow}>
          <Text style={typography.caption}>{lt.login.noAccount}</Text>
          <Button
            label={lt.login.goRegister}
            onPress={onGoRegister}
            variant="ghost"
            style={styles.switchButton}
            disabled={submitting}
            testID="login-go-register"
          />
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  form: { backgroundColor: colors.surfaceAlt, borderRadius: radius.card, borderWidth: 1, borderColor: colors.border, padding: spacing.lg },
  notice: {
    ...typography.body,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: 8,
    marginBottom: spacing.lg,
  },
  serverError: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
  registerRow: { marginTop: spacing.lg, paddingTop: spacing.md, borderTopWidth: 1, borderTopColor: colors.border, flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: spacing.xs },
  switchButton: { minHeight: 44, paddingHorizontal: spacing.sm, paddingVertical: spacing.sm },
});
