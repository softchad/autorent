import { RequireAuth } from '@/auth/RequireAuth';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { EmptyView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { lt } from '@/i18n/lt';

export default function ReservationsTab() {
  const { goLogin, goRegister } = useAuthNavigation();

  return (
    <Screen topInset grid testID="screen-reservations">
      <RequireAuth onLogin={goLogin} onRegister={goRegister}>
        <EmptyView title={lt.tabs.reservations} />
      </RequireAuth>
    </Screen>
  );
}
