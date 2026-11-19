import { Stack, useLocalSearchParams } from 'expo-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Screen } from '@/components/Screen';
import { ErrorView } from '@/components/StateViews';
import { ConversationView } from '@/features/support/ConversationView';
import { parseConversationId } from '@/features/support/supportLogic';
import { lt } from '@/i18n/lt';

export default function ConversationScreen() {
  const params = useLocalSearchParams<{ id: string }>();
  const { goLogin, goRegister } = useAuthNavigation();
  // Numeris ateina iš maršruto, todėl prieš naudojant patikrinamas.
  const conversationId = parseConversationId(params.id);

  return (
    <Screen scroll={false} padded={false} testID="screen-conversation">
      <Stack.Screen options={{ title: lt.support.conversationTitle }} />
      <RequireAuth onLogin={goLogin} onRegister={goRegister}>
        {conversationId !== null ? (
          // Pokalbis ir žinutės laukas montuojami tik žinant klientą ir raktuojami jo ID.
          <RequireCustomer>
            <ConversationView conversationId={conversationId} />
          </RequireCustomer>
        ) : (
          <ErrorView message={lt.support.notFound} />
        )}
      </RequireAuth>
    </Screen>
  );
}
