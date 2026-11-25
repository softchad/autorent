import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { CustomerReservation } from '@/api/types';
import { Badge } from '@/components/Badge';
import { Card } from '@/components/Card';
import { Button } from '@/components/Button';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { formatDateLong, formatDays, formatMoney } from '@/utils/format';
import { STAGE_TONES } from './ReservationCard';
import { StatusTimeline } from './StatusTimeline';
import { buildTimeline } from './timeline';

type Props = { reservation: CustomerReservation; onCancel?: () => void };

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.bodyStrong}>{value}</Text>
    </View>
  );
}

export function ReservationDetailView({ reservation, onCancel }: Props) {
  return (
    <View testID="reservation-detail">
      <LinearGradient colors={[colors.primarySoft, colors.surfaceAlt]} style={styles.hero}>
        <View style={styles.heroRow}>
          <View style={styles.heroText}>
            <Text style={typography.caption}>{lt.reservations.number(reservation.rezervacijos_id)}</Text>
            <Text style={styles.title} accessibilityRole="header">{reservation.marke} {reservation.modelis}</Text>
          </View>
          <Image source={getCarPhoto(reservation.marke)} style={styles.photo} resizeMode="contain" accessible={false} />
        </View>
        <View style={styles.badge}>
          <Badge label={lt.reservations.stage[reservation.etapas]} tone={STAGE_TONES[reservation.etapas]} testID="stage-badge" />
        </View>
      </LinearGradient>

      <Card style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">{lt.reservationDetail.progress}</Text>
        <StatusTimeline steps={buildTimeline(reservation)} />
      </Card>

      <Card style={styles.card}>
        <Text style={styles.cardTitle} accessibilityRole="header">{lt.reservationDetail.details}</Text>
        <Row label={lt.reservationDetail.period} value={`${formatDateLong(reservation.rezervacijos_pradzia)} – ${formatDateLong(reservation.rezervacijos_pabaiga)}`} />
        <Row label={lt.reservationDetail.duration} value={formatDays(reservation.dienu_skaicius)} />
        <Row label={lt.reservationDetail.dailyRate} value={formatMoney(reservation.kaina_parai)} />
        <Text style={styles.extrasTitle}>{lt.reservationDetail.extras}</Text>
        {reservation.paslaugos.length ? reservation.paslaugos.map((line) => (
          <Row key={line.kodas} label={line.pavadinimas} value={`${formatMoney(line.kaina_parai)} ${lt.car.perDay} · ${formatMoney(line.suma)}`} />
        )) : <Text style={styles.noExtras}>{lt.reservationDetail.noExtras}</Text>}
        <View style={styles.total} accessible accessibilityLabel={`${lt.reservationDetail.total}: ${formatMoney(reservation.viso_kaina)}`}>
          <Text style={typography.bodyStrong}>{lt.reservationDetail.total}</Text>
          <Text style={styles.amount}>{formatMoney(reservation.viso_kaina)}</Text>
        </View>
        {reservation.atsaukimo_mokestis !== null ? <Row label={lt.reservationDetail.cancellationFee} value={formatMoney(reservation.atsaukimo_mokestis)} /> : null}
        {reservation.salygu_versija ? <Row label={lt.reservationDetail.terms} value={reservation.salygu_versija} /> : null}
      </Card>
      {onCancel && reservation.veiksmai.includes('atsaukti') && reservation.atsaukimas !== null ? (
        <Button label={lt.reservationDetail.cancel} accessibilityHint={lt.reservationDetail.cancelHint} onPress={onCancel} variant="secondary" testID="reservation-cancel" />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  hero: { padding: spacing.lg, borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand, marginBottom: spacing.lg },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  heroText: { flex: 1, gap: spacing.sm },
  title: { ...typography.title, fontSize: 25, lineHeight: 32 },
  photo: { width: 104, height: 88 },
  badge: { alignItems: 'flex-start', marginTop: spacing.md },
  card: { backgroundColor: colors.surfaceAlt, borderRadius: radius.card },
  cardTitle: { ...typography.heading, marginBottom: spacing.lg },
  row: { gap: spacing.xs, marginBottom: spacing.md },
  extrasTitle: { ...typography.caption, marginBottom: spacing.sm },
  noExtras: { ...typography.body, marginBottom: spacing.md },
  total: { borderTopWidth: 1, borderTopColor: colors.borderStrong, paddingTop: spacing.lg, marginBottom: spacing.lg, gap: spacing.sm },
  amount: { ...typography.price, color: colors.primary },
});
