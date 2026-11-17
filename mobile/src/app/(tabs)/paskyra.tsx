import { useRouter } from 'expo-router';
import { useAuth } from '@/auth/AuthContext';
import { EmptyView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { lt } from '@/i18n/lt';

export default function AccountTab() {
  const router = useRouter();
  const { status } = useAuth();
  const signedOut = status === 'signedOut';

  return (
    <Screen topInset grid testID="screen-account">
      <EmptyView
        title={lt.tabs.account}
        actionLabel={signedOut ? lt.login.submit : undefined}
        onAction={signedOut ? () => router.push('/prisijungimas') : undefined}
      />
    </Screen>
  );
}
