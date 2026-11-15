import { EmptyView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { lt } from '@/i18n/lt';

export default function AccountTab() {
  return (
    <Screen topInset grid testID="screen-account">
      <EmptyView title={lt.tabs.account} />
    </Screen>
  );
}