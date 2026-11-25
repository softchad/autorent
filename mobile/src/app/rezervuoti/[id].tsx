import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { fetchBookingRules, fetchExtras } from '@/api/booking';
import { fetchCar } from '@/api/cars';
import { toUserMessage } from '@/api/errors';
import { useAuth } from '@/auth/AuthContext';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { BookingDraft, draftToParams, selectionFromSearch } from '@/features/booking/bookingDraft';
import { BookingView } from '@/features/booking/BookingView';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';

type RouteParam = string | string[] | undefined;

// Automobilio numeris iš maršruto – tas pats principas kaip automobilio ekrane:
// tik viena eilutė su teigiamu sveikuoju skaičiumi, saugaus dydžio.
function parseCarId(value: RouteParam): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// Pakartotas parametras (masyvas) data nelaikomas.
function textParam(value: RouteParam): string | undefined {
  return typeof value === 'string' ? value : undefined;
}

function BookingContent({ carId, nuo, iki }: { carId: number; nuo?: string; iki?: string }) {
  const { status } = useAuth();
  const { goLogin } = useAuthNavigation();
  const router = useRouter();

  // Trys nepriklausomos užklausos; ekranas rodomas, kai visos pavyko.
  const data = useAsync(
    async (signal) => {
      const [car, rules, extras] = await Promise.all([
        fetchCar(carId, undefined, signal),
        fetchBookingRules(signal),
        fetchExtras(signal),
      ]);
      return { car, rules, extras };
    },
    [carId],
  );

  const [draft, setDraft] = useState<BookingDraft | null>(null);
  const [ready, setReady] = useState(false);
  const [draftCarId, setDraftCarId] = useState(carId);
  // Pasikeitus automobiliui ankstesnis juodraštis išmetamas dar šio render metu.
  if (draftCarId !== carId) {
    setDraftCarId(carId);
    setDraft(null);
    setReady(false);
  }
  const handleDraftChange = useCallback((next: BookingDraft | null, isReady: boolean) => {
    setDraft(next);
    setReady(isReady);
  }, []);

  // Prisijungimas neatmeta juodraščio; patvirtinimui būtina paruošta šio automobilio kaina.
  const canContinue = status === 'signedOut' || (status === 'signedIn' && ready && draft !== null && draft.carId === carId);

  function handleContinue() {
    if (status === 'signedOut') {
      goLogin();
      return;
    }
    if (!canContinue || draft === null) {
      return;
    }
    router.push({ pathname: '/patvirtinimas', params: draftToParams(draft) });
  }

  const footer = data.data ? (
    <Button
      label={status === 'signedOut' ? lt.booking.loginToContinue : lt.booking.continue}
      accessibilityHint={status === 'signedOut' ? lt.booking.loginHint : undefined}
      onPress={handleContinue}
      disabled={!canContinue}
      variant="accent"
      icon="arrow-forward"
      testID="booking-continue"
    />
  ) : undefined;

  return (
    <Screen footer={footer} testID="screen-booking">
      <Stack.Screen options={{ title: lt.booking.title }} />
      {data.status === 'loading' ? <LoadingView /> : null}
      {data.status === 'error' ? <ErrorView message={toUserMessage(data.error)} onRetry={data.reload} /> : null}
      {data.data ? (
        <BookingView
          key={carId}
          car={data.data.car}
          rules={data.data.rules}
          extras={data.data.extras}
          onDraftChange={handleDraftChange}
          // Kataloge pasirinktos datos iškart pažymimos kalendoriuje.
          initialSelection={selectionFromSearch(nuo, iki, data.data.rules)}
        />
      ) : null}
    </Screen>
  );
}

export default function BookingScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; nuo?: string | string[]; iki?: string | string[] }>();
  const carId = parseCarId(params.id);

  if (carId === null) {
    // Netinkamas numeris: serveris nekviečiamas.
    return (
      <Screen testID="screen-booking">
        <Stack.Screen options={{ title: lt.booking.title }} />
        <ErrorView message={lt.carDetail.notFound} />
      </Screen>
    );
  }
  return <BookingContent carId={carId} nuo={textParam(params.nuo)} iki={textParam(params.iki)} />;
}
