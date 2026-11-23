import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { fetchCar } from '@/api/cars';
import { fetchRentalInfo } from '@/api/terms';
import { toUserMessage } from '@/api/errors';
import { RentalInfo } from '@/api/types';
import { Button, IconButton } from '@/components/Button';
import { Screen } from '@/components/Screen';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { CarDetailView, periodBadge } from '@/features/catalogue/CarDetailView';
import { TermsSections } from '@/features/terms/TermsSections';
import { LocationMap, MAP_SUPPORTED, MapAttribution } from '@/features/map/LocationMap';
import { RoutePanel } from '@/features/map/RoutePanel';
import { usePickupRoute } from '@/features/map/usePickupRoute';
import { AsyncResult, useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { isBefore, isValidIsoDate } from '@/utils/isoDate';

type Period = { date_from: string; date_to: string };
type RouteParam = string | string[] | undefined;

// Automobilio numeris iš maršruto: tik viena eilutė su teigiamu sveikuoju skaičiumi, saugaus dydžio.
function parseCarId(value: RouteParam): number | null {
  if (typeof value !== 'string' || !/^[1-9]\d*$/.test(value)) {
    return null;
  }
  const id = Number(value);
  return Number.isSafeInteger(id) ? id : null;
}

// Paieškos laikotarpis iš maršruto parametrų; priimamas tik jei abi datos tikros ir nuo < iki.
function periodFromParams(nuo: RouteParam, iki: RouteParam): Period | undefined {
  if (typeof nuo === 'string' && typeof iki === 'string' && isValidIsoDate(nuo) && isValidIsoDate(iki) && isBefore(nuo, iki)) {
    return { date_from: nuo, date_to: iki };
  }
  return undefined;
}

// Atidarius ekraną tiesiogiai (be navigacijos istorijos) grįžtama į katalogą.
function useGoBack() {
  const router = useRouter();
  return () => (router.canGoBack() ? router.back() : router.replace('/'));
}

function BackOnly({ onBack, children }: { onBack: () => void; children?: ReactNode }) {
  return (
    <View style={styles.fill}>
      <IconButton icon="chevron-back" accessibilityLabel={lt.common.back} onPress={onBack} testID="car-back" />
      {children}
    </View>
  );
}

// Sąlygų būsena lapo apačioje: krovimas, klaida su pakartojimu arba skyriai. Automobilio informacija rodoma bet kuriuo atveju.
function RentalTerms({ info }: { info: AsyncResult<RentalInfo> }) {
  if (info.data) {
    return <TermsSections sections={info.data.skyriai} />;
  }
  if (info.status === 'error') {
    return (
      <View style={styles.termsState}>
        <Text style={styles.termsError} accessibilityRole="alert" testID="terms-error">
          {lt.carDetail.termsFailed}
        </Text>
        <Button label={lt.common.retry} onPress={info.reload} variant="secondary" testID="terms-retry" />
      </View>
    );
  }
  return (
    <Text style={[typography.caption, styles.termsState]} testID="terms-loading">
      {lt.carDetail.termsLoading}
    </Text>
  );
}

function CarDetailContent({ carId, period, onBack }: { carId: number; period?: Period; onBack: () => void }) {
  // Su datomis serveris pasako, ar automobilis laisvas kataloge pasirinktu laikotarpiu.
  const car = useAsync((signal) => fetchCar(carId, period, signal), [carId, period?.date_from, period?.date_to]);
  // Sąlygų tekstai nepriklauso nuo automobilio, todėl kraunami atskirai.
  const rentalInfo = useAsync((signal) => fetchRentalInfo(signal), []);
  const location = car.data?.lokacija ?? null;
  const pickup = usePickupRoute(location);
  const router = useRouter();
  // Kataloge pasirinktas laikotarpis perduodamas rezervavimo ekranui.
  const openBooking = () =>
    router.push({
      pathname: '/rezervuoti/[id]',
      params: { id: String(carId), ...(period ? { nuo: period.date_from, iki: period.date_to } : {}) },
    });

  return (
    <Screen scroll={false} padded={!car.data} topInset={!car.data} testID="screen-car-detail">
      {/* Ekranas be navigacijos antraštės: fonas užima visą ekraną, „Atgal“ mygtukas yra virš jo. */}
      <Stack.Screen options={{ headerShown: false }} />
      {car.data ? (
        <CarDetailView
          car={car.data}
          statusBadge={periodBadge(car.data)}
          onBack={onBack}
          onReserve={openBooking}
          backdrop={
            location ? (
              <LocationMap
                location={location}
                point={pickup.point}
                loading={pickup.loading}
                userPoint={pickup.userPoint}
                route={pickup.route?.points}
              />
            ) : undefined
          }
          pickupExtras={
            <>
              {pickup.point ? <MapAttribution /> : null}
              <RoutePanel route={pickup} mapSupported={MAP_SUPPORTED} />
            </>
          }
        >
          <RentalTerms info={rentalInfo} />
        </CarDetailView>
      ) : (
        <BackOnly onBack={onBack}>
          {car.status === 'loading' ? <LoadingView /> : null}
          {car.status === 'error' ? <ErrorView message={toUserMessage(car.error)} onRetry={car.reload} /> : null}
        </BackOnly>
      )}
    </Screen>
  );
}

export default function CarDetailScreen() {
  const params = useLocalSearchParams<{ id?: string | string[]; nuo?: string | string[]; iki?: string | string[] }>();
  const goBack = useGoBack();
  const carId = parseCarId(params.id);
  const period = periodFromParams(params.nuo, params.iki);

  if (carId === null) {
    // Netinkamas numeris: serveris nekviečiamas.
    return (
      <Screen scroll={false} topInset testID="screen-car-detail">
        <Stack.Screen options={{ headerShown: false }} />
        <BackOnly onBack={goBack}>
          <ErrorView message={lt.carDetail.notFound} />
        </BackOnly>
      </Screen>
    );
  }
  return <CarDetailContent carId={carId} period={period} onBack={goBack} />;
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  termsState: { gap: spacing.sm, alignItems: 'flex-start', marginBottom: spacing.md },
  termsError: { ...typography.bodyStrong, color: colors.danger },
});
