import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { PublicCar } from '@/api/types';
import { Badge } from '@/components/Badge';
import { VehicleCard } from '@/components/VehicleCard';
import { lt } from '@/i18n/lt';
import { getCarPhoto } from '@/theme/images';
import { colors, fonts, spacing } from '@/theme';
import { formatMoney } from '@/utils/format';

type Props = {
  car: PublicCar;
  onPress: () => void;
  topPick?: boolean;
  // Ką daro paspaudimas; numatytai – atidaro automobilio informaciją.
  accessibilityHint?: string;
};

// Trumpas aprašas vienoje eilutėje: „automatinė · hibridas · 5 vietos · 103 kW“.
export function carSummary(car: PublicCar): string {
  return [car.pavaru_deze, car.kuro_tipas, `${car.sedimos_vietos} ${lt.car.seats}`, `${car.galia_kw} ${lt.car.kw}`].join(' · ');
}

// Laisvumo tekstas tik kai serveris jį grąžino (t. y. kai paieškoje nurodytos datos); null – nėra.
function availabilityText(car: PublicCar): string | null {
  if (car.laisvas_pasirinktu_laikotarpiu === true) {
    return lt.car.freeForPeriod;
  }
  if (car.laisvas_pasirinktu_laikotarpiu === false) {
    return lt.car.busyForPeriod;
  }
  return null;
}

function availabilityBadge(car: PublicCar) {
  const text = availabilityText(car);
  if (text === null) {
    return undefined;
  }
  return <Badge label={text} tone={car.laisvas_pasirinktu_laikotarpiu ? 'success' : 'danger'} />;
}

// Katalogo kortelė: serverio duomenys sudedami į bendrą didelę automobilio kortelę.
export function CarCard({ car, onPress, topPick = false, accessibilityHint = lt.car.openHint }: Props) {
  const title = `${car.marke} ${car.modelis}`;
  const price = formatMoney(car.kaina_parai);
  const place = car.lokacija ? car.lokacija.miestas : '';
  // Kortelė ekrano skaitytuvui yra vienas elementas, todėl ženklelio tekstas įtraukiamas į etiketę.
  // Trūkstamos dalys (miestas, laisvumas) praleidžiamos, kad neliktų tuščių sakinių.
  const accessibilityLabel = [
    `${title}, ${car.metai}`,
    carSummary(car),
    place,
    topPick ? lt.car.topPick : null,
    availabilityText(car),
    `${price} ${lt.car.perDay}`,
  ]
    .filter(Boolean)
    .join('. ');

  return (
    <VehicleCard
      title={title}
      subtitle={carSummary(car)}
      price={price}
      priceUnit={lt.vehicle.perDay}
      image={getCarPhoto(car.marke)}
      tag={place ? `${car.metai} · ${place}` : String(car.metai)}
      highlighted={topPick}
      badge={topPick ? (
        <View style={styles.badges}>
          <View style={styles.topPick}>
            <Ionicons name="star" size={13} color={colors.background} />
            <Text style={styles.topPickText}>{lt.car.topPick}</Text>
          </View>
          {availabilityBadge(car)}
        </View>
      ) : availabilityBadge(car)}
      onPress={onPress}
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={`car-card-${car.automobilio_id}`}
    />
  );
}

const styles = StyleSheet.create({
  badges: { alignItems: 'flex-start', gap: spacing.xs },
  topPick: { flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: colors.accent, borderRadius: 20, paddingHorizontal: 10, paddingVertical: 6 },
  topPickText: { fontFamily: fonts.bold, fontSize: 12, color: colors.background },
});
