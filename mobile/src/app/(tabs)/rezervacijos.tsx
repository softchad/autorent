import { EmptyView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { lt } from '@/i18n/lt';

export default function ReservationsTab() {
  return (
    <Screen topInset grid testID="screen-reservations">
      <EmptyView title={lt.tabs.reservations} />
    </Screen>
  );
}