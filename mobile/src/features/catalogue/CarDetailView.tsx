import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode, useEffect, useRef, useState } from 'react';
import { Animated, Image, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { PublicCar } from '@/api/types';
import { Badge } from '@/components/Badge';
import { IconButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { ExpandableSheet } from '@/components/ExpandableSheet';
import { FloatingCarSummary } from '@/components/FloatingCarSummary';
import { ReservationBar } from '@/components/ReservationBar';
import { useReducedMotion } from '@/hooks/useReducedMotion';
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
const EXPANDED_SHARE = 0.55;

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

// Automobilio ekranas: fonas per visą ekraną, virš jo – maža automobilio kortelė,
// ištraukiamas informacijos lapas ir rezervavimo juosta.
export function CarDetailView({ car, children, backdrop, pickupExtras, statusBadge, onBack, onReserve }: Props) {
  const window = useWindowDimensions();
  const reduced = useReducedMotion();
  const entrance = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    entrance.setValue(reduced ? 1 : 0);
    if (reduced) return;
    const animation = Animated.timing(entrance, { toValue: 1, duration: 350, useNativeDriver: true });
    animation.start();
    return () => animation.stop();
  }, [car.automobilio_id, entrance, reduced]);
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
      <View style={styles.fill} onLayout={(event) => setStageHeight(event.nativeEvent.layout.height)}>
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

        <Animated.View style={[styles.summary, {
          bottom: collapsedHeight + spacing.md,
          opacity: entrance,
          transform: [
            { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [-stageHeight * 0.35, 0] }) },
            { scale: entrance.interpolate({ inputRange: [0, 1], outputRange: [1.2, 1] }) },
          ],
        }]} pointerEvents="none">
          <FloatingCarSummary
            title={title}
            subtitle={`${car.metai} · ${car.kebulo_tipas}`}
            price={price}
            priceUnit={lt.vehicle.perDay}
            image={photo}
            testID="car-summary"
          />
        </Animated.View>

        <ExpandableSheet
          collapsedHeight={collapsedHeight}
          expandedHeight={Math.max(collapsedHeight, Math.round(stageHeight * EXPANDED_SHARE))}
          expandLabel={lt.vehicle.expand}
          collapseLabel={lt.vehicle.collapse}
          testID="car-sheet"
          header={
            <View style={styles.sheetHeader} onLayout={(event) => setHeaderHeight(event.nativeEvent.layout.height)} testID="car-sheet-header">
              <Text style={typography.title} accessibilityRole="header" numberOfLines={1}>
                {title}
              </Text>
              <Text style={typography.caption} numberOfLines={1}>
                {car.pavaru_deze} · {car.kuro_tipas} · {car.sedimos_vietos} {lt.car.seats}
              </Text>
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
        <SafeAreaView edges={['bottom']} style={styles.barArea}>
          <ReservationBar
            label={lt.vehicle.reserveNow}
            price={price}
            priceUnit={lt.vehicle.perDay}
            onPress={onReserve}
            accessibilityHint={lt.carDetail.chooseDates}
            testID="choose-dates"
          />
        </SafeAreaView>
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
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  topBar: { position: 'absolute', top: 0, left: 0, right: 0, paddingHorizontal: spacing.lg, paddingTop: spacing.sm },
  // Maža kortelė „plūduriuoja“ kairėje, iškart virš suskleisto lapo.
  summary: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'flex-start' },
  sheetHeader: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md, gap: 2 },
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
