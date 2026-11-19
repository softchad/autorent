import { Stack, useRouter } from 'expo-router';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Screen } from '@/components/Screen';
import { NewConversationForm } from '@/features/support/NewConversationForm';
import { lt } from '@/i18n/lt';

export default function NewConversationScreen() {
  const router = useRouter();
  const { goLogin, goRegister } = useAuthNavigation();

  return (
    <Screen testID="screen-new-conversation">
      <Stack.Screen options={{ title: lt.support.newTitle }} />
      <RequireAuth onLogin={goLogin} onRegister={goRegister}>
        {/* Forma montuojama tik žinant klientą ir raktuojama jo ID. */}
        <RequireCustomer>
          <NewConversationForm
            // Sukūrus forma pakeičiama pačiu pokalbiu, kad „Atgal“ grąžintų į pašto dėžutę.
            onCreated={(conversation) =>
              router.replace({ pathname: '/pokalbis/[id]', params: { id: String(conversation.pokalbio_id) } })
            }
          />
        </RequireCustomer>
      </RequireAuth>
    </Screen>
  );
}
