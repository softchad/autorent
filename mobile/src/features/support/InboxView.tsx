import { useEffect, useRef } from 'react';
import { FlatList, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchConversations } from '@/api/support';
import { SupportConversation } from '@/api/types';
import { Badge } from '@/components/Badge';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { EmptyView, ErrorView, LoadingView } from '@/components/StateViews';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDateShort } from '@/utils/format';
import { statusBadge, supportErrorMessage } from './supportLogic';

type RowProps = {
  conversation: SupportConversation;
  onPress: () => void;
};

function ConversationRow({ conversation, onPress }: RowProps) {
  const badge = statusBadge(conversation.busena);
  const date = formatDateShort(conversation.atnaujinimo_data.slice(0, 10));
  const unread = conversation.neperskaityta ? `${lt.support.unread}. ` : '';

  return (
    <Card
      onPress={onPress}
      accessibilityLabel={`${unread}${conversation.tema}. ${badge.label}. ${date}`}
      accessibilityHint={lt.support.openHint}
      testID={`conversation-${conversation.pokalbio_id}`}
    >
      <View style={styles.rowTop}>
        {/* Neperskaitytas pokalbis žymimas ir tašku, ir paryškintu tekstu. */}
        {conversation.neperskaityta ? <View style={styles.dot} testID={`conversation-unread-${conversation.pokalbio_id}`} /> : null}
        <Text style={[styles.subject, conversation.neperskaityta && styles.subjectUnread]} numberOfLines={1}>
          {conversation.tema}
        </Text>
        <Text style={typography.caption}>{date}</Text>
      </View>
      {conversation.paskutine_zinute ? (
        <Text style={styles.preview} numberOfLines={2}>
          {conversation.paskutine_zinute}
        </Text>
      ) : null}
      <Badge label={badge.label} tone={badge.tone} />
    </Card>
  );
}

type Props = {
  onOpen: (conversation: SupportConversation) => void;
  onNew: () => void;
  // Pasikeitus skaičiui sąrašas atnaujinamas (pvz. grįžus iš pokalbio).
  refreshKey?: number;
};

// Pašto dėžutė: kliento pokalbiai su AutoRent pagalba, naujausi viršuje (tvarką nustato serveris).
// Kito kliento sąrašo komponentas negauna: paskyros ekranas jį montuoja iš naujo pasikeitus klientui.
export function InboxView({ onOpen, onNew, refreshKey = 0 }: Props) {
  const conversations = useAsync((signal) => fetchConversations(signal), []);
  const { reload } = conversations;

  // To paties kliento sąrašas atnaujinamas fone: rodomi pokalbiai lieka, kol ateina nauji.
  const shownRefreshKey = useRef(refreshKey);
  useEffect(() => {
    if (shownRefreshKey.current !== refreshKey) {
      shownRefreshKey.current = refreshKey;
      reload();
    }
  }, [refreshKey, reload]);

  if (conversations.status === 'loading') {
    return <LoadingView />;
  }
  if (conversations.status === 'error') {
    return <ErrorView message={supportErrorMessage(conversations.error)} onRetry={reload} />;
  }
  return (
    <FlatList
      data={conversations.data ?? []}
      keyExtractor={(item) => String(item.pokalbio_id)}
      renderItem={({ item }) => <ConversationRow conversation={item} onPress={() => onOpen(item)} />}
      contentContainerStyle={styles.list}
      refreshControl={<RefreshControl refreshing={conversations.refreshing} onRefresh={reload} tintColor={colors.primary} />}
      ListHeaderComponent={
        <>
          {conversations.error ? (
            // Atnaujinti nepavyko: rodomi anksčiau gauti pokalbiai ir paaiškinimas.
            <Text style={styles.refreshError} accessibilityRole="alert" testID="inbox-refresh-error">
              {supportErrorMessage(conversations.error)}
            </Text>
          ) : null}
          <Button label={lt.support.newConversation} onPress={onNew} icon="create-outline" testID="inbox-new" style={styles.newButton} />
        </>
      }
      ListEmptyComponent={<EmptyView title={lt.support.emptyTitle} message={lt.support.emptyMessage} icon="mail-outline" />}
      testID="inbox-list"
    />
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.lg, flexGrow: 1 },
  newButton: { marginBottom: spacing.lg },
  refreshError: { ...typography.caption, color: colors.danger, marginBottom: spacing.md },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.xs },
  dot: { width: 10, height: 10, borderRadius: radius.pill, backgroundColor: colors.accent },
  subject: { ...typography.body, flex: 1 },
  subjectUnread: { ...typography.bodyStrong },
  preview: { ...typography.caption, marginBottom: spacing.md },
});
