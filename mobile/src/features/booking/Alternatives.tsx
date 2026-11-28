import { Image, StyleSheet, Text, View } from 'react-native';
import { AlternativePeriod, fetchAlternatives } from '@/api/booking';
import { Card } from '@/components/Card';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { toUserMessage } from '@/api/errors';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { formatDateRange, formatMoney } from '@/utils/format';

type Props = {
  carId: number;
  from: string;
  to: string;
  refreshKey?: number;
  onSelectPeriod: (period: AlternativePeriod) => void;
  onSelectCar?: (carId: number) => void;
};

export function Alternatives({ carId, from, to, refreshKey = 0, onSelectPeriod, onSelectCar }: Props) {
  const result = useAsync((signal) => fetchAlternatives(carId, from, to, signal), [carId, from, to, refreshKey]);
  const data = result.data;
  if (result.status === 'loading') return <LoadingView message={lt.alternatives.loading} />;
  if (result.error) return <ErrorView message={toUserMessage(result.error)} onRetry={result.reload} />;
  if (!data) return null;

  const period = data.artimiausias_laikotarpis;
  return (
    <View testID="booking-alternatives">
      <Text style={styles.heading} accessibilityRole="header">{lt.alternatives.title}</Text>
      {period ? (
        <Card
          onPress={() => onSelectPeriod(period)}
          accessibilityLabel={lt.alternatives.selectPeriod(formatDateRange(period.date_from, period.date_to))}
          testID="alternative-period"
          style={styles.period}
        >
          <Text style={typography.bodyStrong}>{lt.alternatives.sameCar}</Text>
          <Text style={styles.date}>{formatDateRange(period.date_from, period.date_to)}</Text>
          <Text style={typography.caption}>{lt.alternatives.choosePeriod}</Text>
        </Card>
      ) : null}
      {data.panasus_automobiliai.map(({ automobilis: car, priezastys }) => {
        const reasons = priezastys.map((reason) => lt.alternatives.reasons[reason]).join(', ');
        const title = `${car.marke} ${car.modelis}`;
        return (
          <Card
            key={car.automobilio_id}
            onPress={onSelectCar ? () => onSelectCar(car.automobilio_id) : undefined}
            accessibilityLabel={`${title}. ${reasons}. ${formatMoney(car.kaina_parai)} ${lt.car.perDay}`}
            accessibilityHint={onSelectCar ? lt.alternatives.openCar : undefined}
            testID={`alternative-car-${car.automobilio_id}`}
          >
            <View style={styles.row}>
              <Image source={getCarPhoto(car.marke)} style={styles.photo} resizeMode="cover" accessible={false} />
              <View style={styles.details}>
                <Text style={typography.bodyStrong}>{title}</Text>
                <Text style={typography.caption}>{reasons}</Text>
                <Text style={styles.price}>{formatMoney(car.kaina_parai)} {lt.car.perDay}</Text>
              </View>
            </View>
          </Card>
        );
      })}
      {!period && data.panasus_automobiliai.length === 0 ? (
        <Text style={typography.body} testID="alternatives-empty">{lt.alternatives.empty}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  heading: { ...typography.heading, marginBottom: spacing.md },
  period: { backgroundColor: colors.primarySoft, borderColor: colors.primary },
  date: { ...typography.bodyStrong, color: colors.primary, marginVertical: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  photo: { width: 80, height: 70, borderRadius: radius.md, backgroundColor: colors.surfaceAlt },
  details: { flex: 1, gap: spacing.xs },
  price: { ...typography.bodyStrong, color: colors.primary },
});
