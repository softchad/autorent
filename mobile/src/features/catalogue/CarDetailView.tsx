import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useState } from 'react';
import { Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PublicCar } from '@/api/types';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExpandableSheet } from '@/components/ExpandableSheet';
import { ReservationBar } from '@/components/ReservationBar';
import { lt } from '@/i18n/lt';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { formatMoney } from '@/utils/format';

// Serviso / remonto būsenos automobilio rezervuoti negalima (tą patį tikrina serveris).
const NOT_BOOKABLE_STATUSES = ['servise', 'remonte'];

export function isBookable(car: PublicCar): boolean {
  return !NOT_BOOKABLE_STATUSES.includes(car.automobilio_statusas);
}

// Perspėjimas pagal tikslią būseną; rezervuojamam automobiliui – null.
export function notBookableText(car: PublicCar): string | null {
  if (isBookable(car)) return null;
  return car.automobilio_statusas === 'remonte' ? lt.carDetail.notBookableRepair : lt.carDetail.notBookableService;
}

// Techninių duomenų eilutės: [pavadinimas, reikšmė].
export function specRows(car: PublicCar): [string, string][] {
  const text = lt.carDetail;
  return [
    [text.year, String(car.metai)],
    [text.body, car.kebulo_tipas],
    [text.color, car.spalva],
    [text.gearbox, car.pavaru_deze],
    [text.fuel, car.kuro_tipas],
    // Elektromobilio variklio tūris DB yra 0 – tokios eilutės nerodome.
    ...(car.variklio_turis > 0 ? [[text.engine, text.liters(car.variklio_turis)] as [string, string]] : []),
    [text.power, text.kw(car.galia_kw)],
    [text.mileage, text.km(car.rida)],
    [text.seats, String(car.sedimos_vietos)],
    [text.climate, car.klimato_kontrole ? lt.common.yes : lt.common.no],
    [text.navigation, car.navigacija ? lt.common.yes : lt.common.no],
  ];
}

// Mažiausias suskleisto lapo aukštis: rankenėlė ir antraštė su pavadinimu.
const COLLAPSED_HEIGHT = 132;
// Lapo viršutinis rėmelis.
const SHEET_BORDER = 1;
// Kokią ekrano dalį užima išskleistas lapas.
const EXPANDED_SHARE = 0.75;

type Props = {
  car: PublicCar;
  // Papildomos sekcijos lapo apačioje (pvz. draudimo informacija) įterpiamos iš ekrano.
  children?: ReactNode;
  // Fonas per visą ekraną. Jei neperduotas, rodoma automobilio nuotrauka; ekranas čia gali perduoti žemėlapį.
  backdrop?: ReactNode;
  // Turinys po paėmimo vietos adresu (pvz. maršruto mygtukai).
  pickupExtras?: ReactNode;
  // Ženklelis lapo antraštėje (pvz. ar automobilis laisvas pasirinktomis dienomis).
  statusBadge?: ReactNode;
  onBack?: () => void;
  // Jei neperduota arba automobilis neišnuomojamas, rezervavimo juosta nerodoma.
  onReserve?: () => void;
};

// Automobilio ekranas: fonas, ištraukiamas informacijos lapas ir rezervavimo juosta.
export function CarDetailView({ car, children, backdrop, pickupExtras, statusBadge, onBack, onReserve }: Props) {
  const window = useWindowDimensions();
  // Tikras scenos aukštis sužinomas ją išdėsčius; iki tol naudojamas lango aukštis.
  const [stageHeight, setStageHeight] = useState(window.height);
  // Suskleistas lapas turi sutalpinti visą antraštę, net jei perspėjimas užima kelias eilutes.
  const [headerHeight, setHeaderHeight] = useState(0);
  const collapsedHeight = Math.max(COLLAPSED_HEIGHT, Math.ceil(SHEET_BORDER + MIN_TOUCH_SIZE + headerHeight));
  const title = `${car.marke} ${car.modelis}`;
  const price = formatMoney(car.kaina_parai);
  const photo = getCarPhoto(car.marke);
  const warning = notBookableText(car);

  return (
    <View style={styles.fill}>
      <View style={styles.stage} onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}>
        {backdrop ?? (
          <View style={styles.fill} testID="car-photo-backdrop">
            <Image source={photo} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
            <LinearGradient colors={['rgba(11, 18, 31, 0.55)', 'rgba(11, 18, 31, 0)', 'rgba(11, 18, 31, 0.9)']} locations={[0, 0.35, 1]} style={styles.photo} />
          </View>
        )}

        {onBack ? (
          <SafeAreaView edges={['top']} style={styles.topBar} pointerEvents="box-none">
            <IconButton icon="chevron-back" accessibilityLabel={lt.common.back} onPress={onBack} variant="glass" testID="car-back" />
          </SafeAreaView>
        ) : null}

        <ExpandableSheet
          collapsedHeight={collapsedHeight}
          expandedHeight={Math.max(collapsedHeight, Math.round(stageHeight * EXPANDED_SHARE))}
          expandLabel={lt.vehicle.expand}
          collapseLabel={lt.vehicle.collapse}
          testID="car-sheet"
          header={
            <View style={styles.sheetHeader} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)} testID="car-sheet-header">
              <View style={styles.imageFrame} pointerEvents="none">
                <Image source={photo} style={styles.thumbnail} resizeMode="cover" accessible={false} />
              </View>
              <View style={styles.headingRow}>
                <View style={styles.headingText}>
                  <Text style={typography.heading} accessibilityRole="header">
                    {title}
                  </Text>
                  <Text style={typography.caption}>
                    {car.metai} · {car.pavaru_deze} · {car.kuro_tipas}
                  </Text>
                </View>
              </View>
              {statusBadge ? <View style={styles.statusBadge}>{statusBadge}</View> : null}
              {/* Antraštėje, ne lapo turinyje: matoma ir ekrano skaitytuvui pasiekiama suskleidus lapą. */}
              {warning ? (
                <Text style={styles.warning} accessibilityRole="alert" testID="car-not-bookable">
                  {warning}
                </Text>
              ) : null}
            </View>
          }
        >
          {car.lokacija ? (
            <Card testID="car-pickup">
              <Text style={styles.cardTitle} accessibilityRole="header">
                {lt.carDetail.pickup}
              </Text>
              <Text style={typography.bodyStrong}>{car.lokacija.pavadinimas}</Text>
              <Text style={typography.body}>{car.lokacija.adresas}</Text>
              {pickupExtras}
            </Card>
          ) : null}

          <Card testID="car-specs">
            <Text style={styles.cardTitle} accessibilityRole="header">
              {lt.carDetail.specs}
            </Text>
            {specRows(car).map(([label, value]) => (
              <View key={label} style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
                <Text style={typography.caption}>{label}</Text>
                <Text style={typography.bodyStrong}>{value}</Text>
              </View>
            ))}
          </Card>

          {children}
        </ExpandableSheet>
      </View>

      {/* Rezervavimo juosta visada matoma ekrano apačioje, po informacijos lapu. */}
      {onReserve && !warning ? (
        <View style={styles.barArea}>
          <ReservationBar
            label={lt.vehicle.reserveNow}
            price={price}
            priceUnit={lt.vehicle.perDay}
            onPress={onReserve}
            accessibilityHint={lt.carDetail.chooseDates}
            testID="choose-dates"
          />
        </View>
      ) : null}
    </View>
  );
}

// Ženklelis, kai serveris pasakė, ar automobilis laisvas paieškoje pasirinktomis dienomis.
export function periodBadge(car: PublicCar): ReactNode {
  if (car.laisvas_pasirinktu_laikotarpiu === true) {
    return <Badge label={lt.car.freeForPeriod} tone="success" testID="car-period-free" />;
  }
  if (car.laisvas_pasirinktu_laikotarpiu === false) {
    return <Badge label={lt.car.busyForPeriod} tone="danger" testID="car-period-busy" />;
  }
  return null;
}

const styles = StyleSheet.create({
  fill: { flex: 1, backgroundColor: colors.background },
  stage: { flex: 1, overflow: 'hidden', backgroundColor: colors.background },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 2 },
  headingRow: { minHeight: 72, justifyContent: 'center', paddingRight: 136 },
  imageFrame: {
    position: 'absolute',
    right: spacing.lg,
    top: -MIN_TOUCH_SIZE - 56,
    width: 128,
    height: 112,
    padding: 3,
    borderRadius: radius.lg,
    borderWidth: 2,
    borderColor: colors.primary,
    backgroundColor: colors.surfaceAlt,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 5 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 6,
  },
  thumbnail: { width: '100%', height: '100%', borderRadius: radius.lg - 5, backgroundColor: colors.surface },
  headingText: { flex: 1, gap: spacing.xs },
  statusBadge: { marginTop: spacing.xs },
  warning: {
    ...typography.bodyStrong,
    color: colors.warning,
    backgroundColor: colors.warningSoft,
    padding: spacing.md,
    borderRadius: radius.md,
    marginTop: spacing.sm,
  },
  cardTitle: { ...typography.heading, marginBottom: spacing.md },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.neutralSoft,
  },
  barArea: {
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    paddingBottom: spacing.sm,
    backgroundColor: colors.surfaceAlt,
  },
});
