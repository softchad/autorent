import { ReservationsView } from '@/features/reservations/ReservationsView';
import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { useAccountKey } from '@/auth/accountKey';
import { RequireAuth } from '@/auth/RequireAuth';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Screen } from '@/components/Screen';
import { AccountView } from '@/features/account/AccountView';
import { lt } from '@/i18n/lt';

export default function AccountTab() {
  const { goLogin, goRegister } = useAuthNavigation();
  const router = useRouter();
  const accountKey = useAccountKey();
  const [refreshKey, setRefreshKey] = useState(0);

  // Grįžus į paskyrą (pvz. iš pokalbio) sąrašai atnaujinami, kad dingtų „neperskaityta“ žymos.
  useFocusEffect(
    useCallback(() => {
      setRefreshKey((key) => key + 1);
    }, []),
  );

  return (
    <Screen scroll={false} padded={false} topInset grid testID="screen-account">
      <RequireAuth message={lt.account.signedOutMessage} onLogin={goLogin} onRegister={goRegister}>
        <AccountView
          key={accountKey}
          inboxRefreshKey={refreshKey}
          onOpenConversation={(conversation) =>
            router.push({ pathname: '/pokalbis/[id]', params: { id: String(conversation.pokalbio_id) } })
          }
          onNewConversation={() => router.push('/pokalbis/naujas')}
          onOpenPreview={() => router.push('/perziura')}
          reservations={
            <ReservationsView
              refreshKey={refreshKey}
              onBrowse={() => router.navigate('/')}
            />
          }
        />
      </RequireAuth>
    </Screen>
  );
}
