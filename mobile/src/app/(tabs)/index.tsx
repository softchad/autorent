import { useRouter } from 'expo-router';
import { Button } from '@/components/Button';
import { EmptyView } from '@/components/StateViews';
import { Screen } from '@/components/Screen';
import { lt } from '@/i18n/lt';

export default function CarsTab() {
  const router = useRouter();
  return (
    <Screen topInset grid testID="screen-cars">
      <EmptyView title={lt.tabs.cars} icon="car-sport-outline" />
      {/* Tik kūrimo režimu: nuoroda į dizaino peržiūrą su pavyzdiniais duomenimis. */}
      {__DEV__ ? <Button label={lt.preview.open} onPress={() => router.push('/perziura')} variant="ghost" testID="open-preview" /> : null}
    </Screen>
  );
}