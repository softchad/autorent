import { StyleSheet, Text, View } from 'react-native';
import { CustomerReservation, ReservationStage } from '@/api/types';
import { Badge, BadgeTone } from '@/components/Badge';
import { Card } from '@/components/Card';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { formatDateRange, formatDays, formatMoney } from '@/utils/format';

// Etapo spalva; pavadinimas visada rodomas tekstu, todėl informacija neperduodama vien spalva.
export const STAGE_TONES: Record<ReservationStage, BadgeTone> = {
  laukia_patvirtinimo: 'warning',
  patvirtinta: 'success',
  nuomos_laikas: 'info',
  pasibaigusi: 'neutral',
  nepatvirtinta_laiku: 'neutral',
  isnuomota: 'info',
  atsaukta: 'danger',
};

type Props = {
  reservation: CustomerReservation;
  // Be jo kortelė nepaspaudžiama.
  onPress?: () => void;
};

export function ReservationCard({ reservation, onPress }: Props) {
  const title = `${reservation.marke} ${reservation.modelis}`;
  const period = formatDateRange(reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga);
  const stage = lt.reservations.stage[reservation.etapas];
  const total = formatMoney(reservation.viso_kaina);
  const label = `${title}. ${period}, ${formatDays(reservation.dienu_skaicius)}. ${stage}. ${total}`;
  const testID = `reservation-card-${reservation.rezervacijos_id}`;

  const content = (
    <>
      <View style={styles.header}>
        <Text style={[typography.heading, styles.title]}>{title}</Text>
        <Badge label={stage} tone={STAGE_TONES[reservation.etapas]} />
      </View>
      <Text style={typography.body}>{period}</Text>
      <View style={styles.footer}>
        <Text style={typography.caption}>{formatDays(reservation.dienu_skaicius)}</Text>
        <Text style={styles.total}>{total}</Text>
      </View>
    </>
  );

  if (!onPress) {
    return (
      <View accessible accessibilityLabel={label} testID={testID}>
        <Card>{content}</Card>
      </View>
    );
  }
  return (
    <Card onPress={onPress} accessibilityLabel={label} accessibilityHint={lt.reservations.openHint} testID={testID}>
      {content}
    </Card>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', gap: spacing.sm, marginBottom: spacing.xs },
  title: { flex: 1 },
  footer: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing.sm },
  total: { ...typography.bodyStrong, color: colors.primary },
});
