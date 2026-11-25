import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, Text, View } from 'react-native';
import { CustomerReservation } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { formatDateRange, formatDays, formatMoney } from '@/utils/format';

type Props = {
  // Serverio grąžinta ką tik sukurta rezervacija – rodomi tik tikri jos duomenys.
  reservation: CustomerReservation;
  onShowAll: () => void;
  // Jei perduota, rodomas mygtukas, atidarantis šios rezervacijos ekraną.
  onOpen?: () => void;
};

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={styles.value}>{value}</Text>
    </View>
  );
}

// Sėkmės būsena po patvirtinimo: aiškus ženklas, kas užsakyta ir kas bus toliau.
export function BookingSuccess({ reservation, onShowAll, onOpen }: Props) {
  return (
    <View style={styles.container} testID="booking-success">
      <View style={styles.icon}>
        <Ionicons name="checkmark" size={44} color={colors.success} />
      </View>
      <Text style={styles.title} accessibilityRole="header">
        {lt.confirm.successTitle}
      </Text>
      <Text style={styles.message} accessibilityLiveRegion="polite">
        {lt.confirm.success}
      </Text>

      <Card style={styles.card}>
        <Text style={typography.label}>{lt.confirm.number(reservation.rezervacijos_id)}</Text>
        <Text style={styles.car}>
          {reservation.marke} {reservation.modelis}
        </Text>
        <Row label={lt.confirm.period} value={formatDateRange(reservation.rezervacijos_pradzia, reservation.rezervacijos_pabaiga)} />
        <Row label={lt.confirm.duration} value={formatDays(reservation.dienu_skaicius)} />
        <Row label={lt.price.total} value={formatMoney(reservation.viso_kaina)} />
      </Card>

      {onOpen ? <Button label={lt.confirm.openReservation} onPress={onOpen} icon="arrow-forward" testID="success-open" style={styles.button} /> : null}
      <Button label={lt.confirm.showAll} onPress={onShowAll} variant="secondary" testID="success-all" style={styles.button} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { alignItems: 'center', paddingVertical: spacing.xl, gap: spacing.md },
  // Žalia spalva – tik sėkmei; ją papildo varnelė ir tekstas.
  icon: {
    width: 88,
    height: 88,
    borderRadius: radius.pill,
    backgroundColor: colors.successSoft,
    borderWidth: 2,
    borderColor: colors.success,
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: { ...typography.title, textAlign: 'center' },
  message: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  card: { alignSelf: 'stretch', marginTop: spacing.md },
  car: { ...typography.heading, marginBottom: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.md, paddingVertical: spacing.xs },
  value: { ...typography.bodyStrong, flexShrink: 1, textAlign: 'right' },
  button: { alignSelf: 'stretch' },
});
