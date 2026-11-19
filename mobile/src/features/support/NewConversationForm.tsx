import { useEffect, useRef, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { createConversation } from '@/api/support';
import { SupportConversationDetail } from '@/api/types';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { TextField } from '@/components/TextField';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { stripLikeServer, SUPPORT_CATEGORIES, SupportCategory, supportErrorMessage, validateMessage, validateSubject } from './supportLogic';

type Props = {
  onCreated: (conversation: SupportConversationDetail) => void;
};

// Naujos užklausos pagalbai forma: tema, kategorija ir pirmoji žinutė.
export function NewConversationForm({ onCreated }: Props) {
  const [subject, setSubject] = useState('');
  const [category, setCategory] = useState<SupportCategory>('kita');
  const [message, setMessage] = useState('');
  const [errors, setErrors] = useState<{ subject: string | null; message: string | null }>({ subject: null, message: null });
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  // Sinchroniška apsauga nuo antro pateikimo, kol būsena dar neatnaujinta.
  const submittingRef = useRef(false);
  // Išmontavus (pvz. pasikeitus paskyrai) pavėluotas atsakymas nebenaviguoja.
  const mountedRef = useRef(true);
  useEffect(
    () => () => {
      mountedRef.current = false;
    },
    [],
  );

  async function handleSubmit() {
    if (submittingRef.current) {
      return;
    }
    const found = { subject: validateSubject(subject), message: validateMessage(message) };
    setErrors(found);
    setServerError(null);
    if (found.subject || found.message) {
      return;
    }
    submittingRef.current = true;
    setSubmitting(true);
    try {
      const created = await createConversation({
        tema: stripLikeServer(subject),
        kategorija: category,
        pranesimas: stripLikeServer(message),
      });
      if (mountedRef.current) {
        onCreated(created);
      }
    } catch (error) {
      // Automatiškai nekartojama: pokalbis galėjo būti sukurtas.
      setServerError(supportErrorMessage(error));
    } finally {
      submittingRef.current = false;
      setSubmitting(false);
    }
  }

  return (
    <View>
      <Text style={styles.intro}>{lt.support.newIntro}</Text>
      <TextField
        label={lt.support.subject}
        value={subject}
        onChangeText={setSubject}
        error={errors.subject}
        editable={!submitting}
        testID="support-subject"
      />
      <Text style={styles.label}>{lt.support.category}</Text>
      <View style={styles.categories}>
        {SUPPORT_CATEGORIES.map((code) => (
          <Chip
            key={code}
            label={lt.support.categories[code]}
            selected={category === code}
            onPress={() => setCategory(code)}
            testID={`support-category-${code}`}
          />
        ))}
      </View>
      <TextField
        label={lt.support.message}
        value={message}
        onChangeText={setMessage}
        error={errors.message}
        editable={!submitting}
        multiline
        testID="support-message"
      />
      {serverError ? (
        <Text style={styles.serverError} accessibilityRole="alert" testID="support-error">
          {serverError}
        </Text>
      ) : null}
      <Button label={lt.support.submit} onPress={() => void handleSubmit()} loading={submitting} icon="send" testID="support-submit" />
    </View>
  );
}

const styles = StyleSheet.create({
  intro: { ...typography.body, color: colors.textMuted, marginBottom: spacing.lg },
  label: { ...typography.label, marginBottom: spacing.sm },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  serverError: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
});
