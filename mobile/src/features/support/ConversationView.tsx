import { ComponentRef, useEffect, useRef, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { fetchConversation, markConversationSeen, sendMessage } from '@/api/support';
import { SupportConversationDetail, SupportMessage } from '@/api/types';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/Button';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { formatDateShort } from '@/utils/format';
import { lastMessageId, messageTime, statusBadge, stripLikeServer, supportErrorMessage, validateMessage } from './supportLogic';

function MessageBubble({ message }: { message: SupportMessage }) {
  const mine = message.autoriaus_tipas === 'klientas';
  const author = mine ? lt.support.you : (message.autorius_vardas ?? lt.common.appName);
  const when = `${formatDateShort(message.sukurimo_data.slice(0, 10))}, ${messageTime(message.sukurimo_data)}`;

  return (
    <View
      style={[styles.bubble, mine ? styles.bubbleMine : styles.bubbleStaff]}
      accessible
      accessibilityLabel={`${author}, ${when}: ${message.tekstas}`}
      testID={`message-${message.zinutes_id}`}
    >
      <Text style={styles.author}>{author}</Text>
      <Text style={typography.body}>{message.tekstas}</Text>
      <Text style={styles.time}>{when}</Text>
    </View>
  );
}

type Props = {
  conversationId: number;
};

// Vienas pokalbis su pagalba: žinutės ir rašymo laukas apačioje.
// Kiekvienam pokalbio numeriui sukuriamas atskiras egzempliorius, todėl pasikeitus numeriui
// ankstesnio pokalbio duomenys, tekstas, klaidos ir vėluojantys atsakymai jo nebepaveikia.
export function ConversationView({ conversationId }: Props) {
  return <ConversationContent key={conversationId} conversationId={conversationId} />;
}

function ConversationContent({ conversationId }: Props) {
  const loaded = useAsync((signal) => fetchConversation(conversationId, signal), [conversationId]);
  // Po išsiųstos žinutės serveris grąžina visą atnaujintą pokalbį – jis rodomas vietoje pirmojo atsakymo.
  const [updated, setUpdated] = useState<SupportConversationDetail | null>(null);
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  // Sinchroniška apsauga nuo antro siuntimo, kol būsena dar neatnaujinta.
  const sendingRef = useRef(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);

  const conversation = updated ?? loaded.data;
  // Perskaitytu žymimas tik šiuo metu parodytas šio numerio pokalbis.
  const shownLastId = conversation && conversation.pokalbio_id === conversationId ? lastMessageId(conversation) : null;

  // Nepavykus nieko nerodome – žyma tiesiog liks.
  useEffect(() => {
    if (shownLastId !== null) {
      markConversationSeen(conversationId, shownLastId).catch(() => undefined);
    }
  }, [conversationId, shownLastId]);

  async function handleSend() {
    if (sendingRef.current) {
      return;
    }
    const problem = validateMessage(text);
    setSendError(problem);
    if (problem) {
      return;
    }
    const sent = text;
    sendingRef.current = true;
    setSending(true);
    try {
      setUpdated(await sendMessage(conversationId, stripLikeServer(sent)));
      // Išvalomas tik išsiųstas tekstas; pasikeitęs laukas neliečiamas.
      setText((current) => (current === sent ? '' : current));
    } catch (error) {
      // Tekstas lieka lauke, kad žinutės nereikėtų rašyti iš naujo. Automatiškai nekartojama.
      setSendError(supportErrorMessage(error));
    } finally {
      sendingRef.current = false;
      setSending(false);
    }
  }

  if (loaded.status === 'loading') {
    return <LoadingView />;
  }
  if (loaded.status === 'error' || !conversation) {
    return <ErrorView message={supportErrorMessage(loaded.error)} onRetry={loaded.reload} />;
  }
  const badge = statusBadge(conversation.busena);

  return (
    <KeyboardAvoidingView style={styles.fill} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={90}>
      <ScrollView
        ref={scrollRef}
        contentContainerStyle={styles.messages}
        // Atsiradus naujai žinutei sąrašas nuslenka į apačią.
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: false })}
        testID="conversation-messages"
      >
        <Text style={typography.heading} accessibilityRole="header">
          {conversation.tema}
        </Text>
        <Badge label={badge.label} tone={badge.tone} testID="conversation-status" />
        {conversation.rezervacija ? (
          <Text style={typography.caption}>
            {lt.support.aboutReservation(conversation.rezervacija.rezervacijos_id, `${conversation.rezervacija.marke} ${conversation.rezervacija.modelis}`)}
          </Text>
        ) : null}
        {conversation.zinutes.map((message) => (
          <MessageBubble key={message.zinutes_id} message={message} />
        ))}
        {conversation.sprendimo_santrauka ? (
          <View style={styles.resolution} testID="conversation-resolution">
            <Text style={typography.label}>{lt.support.resolution}</Text>
            <Text style={typography.body}>{conversation.sprendimo_santrauka}</Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.composer}>
        {sendError ? (
          <Text style={styles.error} accessibilityRole="alert" testID="composer-error">
            {sendError}
          </Text>
        ) : null}
        <View style={styles.composerRow}>
          <TextInput
            value={text}
            onChangeText={setText}
            // Kol žinutė siunčiama, lauko keisti negalima.
            editable={!sending}
            placeholder={lt.support.composerPlaceholder}
            placeholderTextColor={colors.textMuted}
            accessibilityLabel={lt.support.composerLabel}
            multiline
            keyboardAppearance="dark"
            selectionColor={colors.primary}
            style={styles.input}
            testID="composer-input"
          />
          <IconButton
            icon={sending ? 'hourglass-outline' : 'send'}
            accessibilityLabel={lt.support.send}
            onPress={() => void handleSend()}
            variant="accent"
            size={52}
            testID="composer-send"
          />
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  messages: { padding: spacing.lg, gap: spacing.md, flexGrow: 1 },
  bubble: { maxWidth: '86%', padding: spacing.md, borderRadius: radius.lg, gap: spacing.xs, borderWidth: 1 },
  // Kliento žinutės dešinėje (mėlynos), pagalbos – kairėje.
  bubbleMine: { alignSelf: 'flex-end', backgroundColor: colors.primarySoft, borderColor: colors.brand, borderBottomRightRadius: radius.sm },
  bubbleStaff: { alignSelf: 'flex-start', backgroundColor: colors.surface, borderColor: colors.border, borderBottomLeftRadius: radius.sm },
  author: { ...typography.label, color: colors.primary },
  time: { ...typography.caption, fontSize: 12, lineHeight: 16 },
  resolution: {
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.successSoft,
    borderWidth: 1,
    borderColor: colors.success,
    gap: spacing.xs,
  },
  composer: {
    padding: spacing.md,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    gap: spacing.sm,
  },
  composerRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing.sm },
  input: {
    ...typography.body,
    flex: 1,
    minHeight: MIN_TOUCH_SIZE + 8,
    maxHeight: 140,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.borderStrong,
    backgroundColor: colors.surface,
  },
  error: { ...typography.caption, color: colors.danger },
});
