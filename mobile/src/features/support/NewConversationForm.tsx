import { useEffect, useRef, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { createConversation } from '@/api/support';
import { SupportConversationDetail } from '@/api/types';
import { Button, IconName } from '@/components/Button';
import { TextField } from '@/components/TextField';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { stripLikeServer, SUPPORT_CATEGORIES, SupportCategory, supportErrorMessage, validateMessage, validateSubject } from './supportLogic';

type Props = {
  onCreated: (conversation: SupportConversationDetail) => void;
};

const categoryIcons: Record<SupportCategory, IconName> = {
  rezervacija: 'calendar-outline',
  atsiemimas_grazinimas: 'key-outline',
  automobilis: 'car-sport-outline',
  saskaita: 'receipt-outline',
  paskyra: 'person-outline',
  kita: 'chatbubble-ellipses-outline',
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
    <View style={styles.form}>
      <LinearGradient colors={[colors.primarySoft, colors.surfaceAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
        <View style={styles.heroIcon}>
          <Ionicons name="chatbubbles-outline" size={28} color={colors.primary} accessible={false} />
        </View>
        <Text style={styles.title} accessibilityRole="header">{lt.support.newHeading}</Text>
        <Text style={styles.intro}>{lt.support.newIntro}</Text>
      </LinearGradient>
      <View style={styles.section}>
        <Text style={styles.sectionTitle} accessibilityRole="header">{lt.support.category}</Text>
        <View style={styles.categories}>
          {SUPPORT_CATEGORIES.map((code) => (
            <Pressable
              key={code}
              accessibilityRole="button"
              accessibilityLabel={lt.support.categories[code]}
              accessibilityState={{ selected: category === code }}
              onPress={() => setCategory(code)}
              testID={`support-category-${code}`}
              style={({ pressed }) => [styles.category, category === code && styles.categorySelected, pressed && styles.pressed]}
            >
              <Ionicons name={categoryIcons[code]} size={20} color={colors.primary} accessible={false} />
              <Text style={[styles.categoryLabel, category === code && styles.categoryLabelSelected]}>{lt.support.categories[code]}</Text>
              {category === code ? <Ionicons name="checkmark-circle" size={16} color={colors.primary} accessible={false} /> : null}
            </Pressable>
          ))}
        </View>
      </View>
      <View style={styles.section}>
        <TextField
          label={lt.support.subject}
          value={subject}
          onChangeText={setSubject}
          error={errors.subject}
          editable={!submitting}
          placeholder={lt.support.subjectPlaceholder}
          testID="support-subject"
        />
        <TextField
          label={lt.support.message}
          value={message}
          onChangeText={setMessage}
          error={errors.message}
          editable={!submitting}
          multiline
          numberOfLines={5}
          minHeight={140}
          textAlignVertical="top"
          placeholder={lt.support.composerPlaceholder}
          testID="support-message"
        />
        {serverError ? (
          <Text style={styles.serverError} accessibilityRole="alert" testID="support-error">
            {serverError}
          </Text>
        ) : null}
        <Button label={lt.support.submit} variant="accent" onPress={() => void handleSubmit()} loading={submitting} icon="send" testID="support-submit" />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  form: { gap: spacing.lg },
  hero: { padding: spacing.xl, borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand, gap: spacing.md },
  heroIcon: { width: 52, height: 52, borderRadius: radius.md, backgroundColor: colors.background, borderWidth: 1, borderColor: colors.brand, alignItems: 'center', justifyContent: 'center' },
  title: { ...typography.title, fontSize: 28, lineHeight: 36 },
  intro: { ...typography.body, color: colors.textMuted },
  section: { padding: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surfaceAlt },
  sectionTitle: { ...typography.bodyStrong, marginBottom: spacing.md },
  categories: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  category: { flexGrow: 1, flexBasis: '45%', flexDirection: 'row', alignItems: 'center', minHeight: 52, padding: spacing.sm, gap: spacing.sm, borderRadius: radius.md, borderWidth: 1, borderColor: colors.borderStrong, backgroundColor: colors.surface },
  categorySelected: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  categoryLabel: { ...typography.caption, color: colors.textMuted, flex: 1 },
  categoryLabelSelected: { color: colors.text },
  pressed: { opacity: 0.8 },
  serverError: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
});
