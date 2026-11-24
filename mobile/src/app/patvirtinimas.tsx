import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { fetchBookingRules } from '@/api/booking';
import { fetchCar } from '@/api/cars';
import { toUserMessage } from '@/api/errors';
import { fetchTerms } from '@/api/terms';
import { CustomerReservation } from '@/api/types';
import { RequireAuth } from '@/auth/RequireAuth';
import { RequireCustomer } from '@/auth/RequireCustomer';
import { useAuthNavigation } from '@/auth/useAuthNavigation';
import { Button } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { BookingDraft, draftFromParams, draftMatchesRules, draftToParams } from '@/features/booking/bookingDraft';
import { BookingSuccess } from '@/features/booking/BookingSuccess';
import { ConfirmView } from '@/features/booking/ConfirmView';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';

// Montuojamas tik su struktūriškai tinkamu juodraščiu, prisijungusiam ir žinomam klientui.
// Raktas (klientas + juodraštis) užtikrina, kad pasikeitus vienam iš jų neliktų ankstesnės būsenos, įskaitant sėkmę.
function ConfirmContent({ draft }: { draft: BookingDraft }) {
  const router = useRouter();
  const [created, setCreated] = useState<CustomerReservation | null>(null);

  const data = useAsync(
    async (signal) => {
      const [car, terms, rules] = await Promise.all([
        fetchCar(draft.carId, undefined, signal),
        fetchTerms(signal),
        fetchBookingRules(signal),
      ]);
      return { car, terms, rules };
    },
    [draft.carId],
  );

  // Be navigacijos istorijos (pvz. atidarius nuorodą) atidaromas to paties automobilio rezervavimo ekranas.
  const chooseAgain = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace({ pathname: '/rezervuoti/[id]', params: { id: String(draft.carId) } });
  }, [router, draft.carId]);

  if (created) {
    return (
      <>
        <Stack.Screen options={{ title: lt.confirm.successTitle, headerBackVisible: false }} />
        <BookingSuccess reservation={created} onShowAll={() => router.replace('/rezervacijos')} />
      </>
    );
  }
  if (data.status === 'loading') {
    return <LoadingView />;
  }
  if (!data.data) {
    return <ErrorView message={toUserMessage(data.error)} onRetry={data.reload} />;
  }
  // Serverio taisyklės tikrinamos prieš ConfirmView, todėl netinkamam juodraščiui laikymas nekuriamas.
  if (!draftMatchesRules(draft, data.data.rules)) {
    return (
      <>
        <ErrorView message={lt.confirm.invalid} />
        <Button label={lt.confirm.chooseAgain} onPress={chooseAgain} variant="secondary" testID="invalid-choose-again" />
      </>
    );
  }
  return (
    <ConfirmView
      draft={draft}
      car={data.data.car}
      terms={data.data.terms}
      termsRefreshing={data.refreshing}
      termsError={data.error}
      onReloadTerms={data.reload}
      returnByHour={data.data.rules.grazinimas_iki_val}
      onConfirmed={setCreated}
      onChooseAgain={chooseAgain}
    />
  );
}

export default function ConfirmScreen() {
  const params = useLocalSearchParams();
  const { goLogin, goRegister } = useAuthNavigation();
  const parsed = draftFromParams(params);
  const draftKey = parsed ? JSON.stringify(draftToParams(parsed)) : null;
  // Tas pats juodraštis – tas pats objektas, kol nepasikeičia parametrai.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const draft = useMemo(() => parsed, [draftKey]);

  return (
    <Screen testID="screen-confirm">
      <Stack.Screen options={{ title: lt.confirm.title }} />
      {draft && draftKey ? (
        <RequireAuth onLogin={goLogin} onRegister={goRegister}>
          <RequireCustomer>
            <ConfirmContent key={draftKey} draft={draft} />
          </RequireCustomer>
        </RequireAuth>
      ) : (
        // Netinkami parametrai: serveris nekviečiamas ir laikymas nekuriamas.
        <ErrorView message={lt.confirm.invalid} />
      )}
    </Screen>
  );
}
