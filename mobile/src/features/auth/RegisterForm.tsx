import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, TextInputProps, View } from 'react-native';
import { toUserMessage } from '@/api/errors';
import { RegisterPayload } from '@/api/types';
import { useAuth } from '@/auth/AuthContext';
import { Button } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { toIsoDate } from '@/utils/isoDate';
import { describeRegisterError } from './registerErrors';
import { FieldErrors, hasErrors, RegisterValues, validateRegistration } from './validation';

type Props = {
  onSuccess: () => void;
  onGoLogin: () => void;
};

type FieldConfig = {
  name: keyof RegisterValues;
  label: string;
  hint?: string;
  input: Partial<TextInputProps>;
};

// Laukų aprašas vienoje vietoje – forma žemiau juos tiesiog išvardija.
const FIELDS: FieldConfig[] = [
  { name: 'vardas', label: lt.register.vardas, input: { autoComplete: 'given-name', textContentType: 'givenName' } },
  {
    name: 'pavarde',
    label: lt.register.pavarde,
    input: { autoComplete: 'family-name', textContentType: 'familyName' },
  },
  {
    name: 'el_pastas',
    label: lt.register.el_pastas,
    input: {
      keyboardType: 'email-address',
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'email',
      textContentType: 'emailAddress',
    },
  },
  {
    name: 'telefono_nr',
    label: lt.register.telefono_nr,
    hint: lt.register.telefonoHint,
    input: { keyboardType: 'phone-pad', autoComplete: 'tel', textContentType: 'telephoneNumber' },
  },
  {
    name: 'gimimo_data',
    label: lt.register.gimimo_data,
    hint: lt.register.gimimoHint,
    input: { keyboardType: 'numbers-and-punctuation', autoCapitalize: 'none', maxLength: 10 },
  },
  {
    name: 'slaptazodis',
    label: lt.register.slaptazodis,
    hint: lt.register.slaptazodisHint,
    input: {
      secureTextEntry: true,
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
  },
  {
    name: 'slaptazodis2',
    label: lt.register.slaptazodis2,
    input: {
      secureTextEntry: true,
      autoCapitalize: 'none',
      autoCorrect: false,
      autoComplete: 'new-password',
      textContentType: 'newPassword',
    },
  },
];

const EMPTY: RegisterValues = {
  vardas: '',
  pavarde: '',
  el_pastas: '',
  telefono_nr: '',
  gimimo_data: '',
  slaptazodis: '',
  slaptazodis2: '',
};

// Backend amžių skaičiuoja pagal UTC kalendorinę dieną, todėl ir klientas naudoja UTC, ne vietinę datą.
// Tai tik išankstinė patikra: įrenginio laikrodis gali būti netikslus, galutinai tikrina serveris.
export function utcTodayIso(now: Date): string {
  return toIsoDate(now.getUTCFullYear(), now.getUTCMonth() + 1, now.getUTCDate());
}

// Siunčiami tik API laukai. Vardas, pavardė ir telefonas – be kraštinių tarpų (serveris telefono
// nenukerpa). El. paštą normalizuoja api/auth register, slaptažodis siunčiamas nepakeistas.
function toPayload(values: RegisterValues): RegisterPayload {
  return {
    vardas: values.vardas.trim(),
    pavarde: values.pavarde.trim(),
    el_pastas: values.el_pastas,
    telefono_nr: values.telefono_nr.trim(),
    gimimo_data: values.gimimo_data,
    slaptazodis: values.slaptazodis,
  };
}

export function RegisterForm({ onSuccess, onGoLogin }: Props) {
  const { signUp } = useAuth();
  const [values, setValues] = useState<RegisterValues>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors<keyof RegisterValues>>({});
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

  // Įvykių apdorojimui Promise negrąžinamas; klaidos sugaunamos submitRegistration viduje.
  function handleSubmit() {
    void submitRegistration();
  }

  async function submitRegistration() {
    if (submittingRef.current) {
      return;
    }

    let found: FieldErrors<keyof RegisterValues>;
    try {
      found = validateRegistration(values, utcTodayIso(new Date()));
    } catch (error) {
      // Įrenginio data už palaikomų ribų – forma nelūžta.
      setServerError(toUserMessage(error));
      return;
    }
    setErrors(found);
    setServerError(null);
    if (hasErrors(found)) {
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    try {
      await signUp(toPayload(values));
      if (mountedRef.current) {
        onSuccess();
      }
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const failure = describeRegisterError(error);
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
    <View>
      <Text style={styles.intro}>{lt.register.intro}</Text>
      {FIELDS.map((field, index) => {
        const last = index === FIELDS.length - 1;
        return (
          <TextField
            key={field.name}
            label={field.label}
            hint={field.hint}
            value={values[field.name]}
            onChangeText={(text) => setValues((current) => ({ ...current, [field.name]: text }))}
            error={errors[field.name]}
            returnKeyType={last ? 'go' : 'next'}
            onSubmitEditing={last ? handleSubmit : undefined}
            testID={`register-${field.name}`}
            {...field.input}
          />
        );
      })}
      {serverError ? (
        <Text style={styles.serverError} accessibilityRole="alert" testID="register-error">
          {serverError}
        </Text>
      ) : null}
      <Button label={lt.register.submit} onPress={handleSubmit} loading={submitting} testID="register-submit" />
      <View style={styles.loginRow}>
        <Text style={typography.body}>{lt.register.haveAccount}</Text>
        <Button
          label={lt.register.goLogin}
          onPress={onGoLogin}
          variant="secondary"
          disabled={submitting}
          testID="register-go-login"
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  serverError: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
  loginRow: { marginTop: spacing.xl, gap: spacing.sm },
});
