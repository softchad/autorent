import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Modal, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ApiError, toUserMessage } from '@/api/errors';
import { cancelReservation } from '@/api/reservations';
import { CancellationPreview, CustomerReservation } from '@/api/types';
import { Button } from '@/components/Button';
import { vilniusDateOf, vilniusOffsetHours } from '@/features/booking/vilniusTime';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { lt } from '@/i18n/lt';
import { colors, overlays, radius, spacing, typography } from '@/theme';
import { formatDateLong, formatMoney } from '@/utils/format';

type Props = {
  reservation: CustomerReservation;
  onClose: () => void;
  onDone: (updated: CustomerReservation) => void;
  onConditionsChanged: () => void;
};

export function formatFreeUntil(isoMoment: string): string {
  const utcMs = Date.parse(isoMoment.replace(/(\.\d{3})\d+(?=Z$)/, '$1'));
  const local = new Date(utcMs + vilniusOffsetHours(utcMs) * 3_600_000);
  const time = `${String(local.getUTCHours()).padStart(2, '0')}:${String(local.getUTCMinutes()).padStart(2, '0')}`;
  return `${formatDateLong(vilniusDateOf(utcMs))} ${time}`;
}

export function consequenceLines(preview: CancellationPreview): string[] {
  return preview.nemokamai
    ? [lt.cancelDialog.free, lt.cancelDialog.freeUntil(formatFreeUntil(preview.nemokamai_iki))]
    : [lt.cancelDialog.fee(formatMoney(preview.mokestis))];
}

// Kvietėjas langą montuoja kiekvienam naujam patvirtinimui su tuo metu rodyta rezervacija.
export function CancelDialog({ reservation, onClose, onDone, onConditionsChanged }: Props) {
  const reduced = useReducedMotion();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const busy = useRef(false);
  const blocked = useRef(false);
  const active = useRef(true);
  useEffect(() => {
    active.current = true;
    return () => { active.current = false; };
  }, []);
  const preview = reservation.atsaukimas;
  const allowed = reservation.veiksmai.includes('atsaukti') && preview !== null;

  function close() {
    if (!busy.current) onClose();
  }

  async function confirm() {
    if (!allowed || !preview || busy.current || blocked.current) return;
    busy.current = true;
    setSubmitting(true);
    setError(null);
    try {
      const updated = await cancelReservation(reservation.rezervacijos_id, preview.mokestis);
      if (active.current) {
        blocked.current = true;
        onDone(updated);
      }
    } catch (failure) {
      if (!active.current) return;
      if (failure instanceof ApiError && failure.kind === 'conflict') {
        blocked.current = true;
        onConditionsChanged();
      } else {
        setError(toUserMessage(failure));
      }
    } finally {
      busy.current = false;
      if (active.current) setSubmitting(false);
    }
  }

  return (
    <Modal visible transparent animationType={reduced ? 'none' : 'fade'} onRequestClose={close} testID="cancel-modal">
      <SafeAreaView style={styles.backdrop}>
        <View style={styles.dialog} accessibilityViewIsModal testID="cancel-dialog">
          <ScrollView contentContainerStyle={styles.content} bounces={false}>
            <View style={styles.icon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
              <Ionicons name="calendar-outline" size={28} color={colors.primary} />
            </View>
            <Text style={typography.title} accessibilityRole="header">{lt.cancelDialog.title}</Text>
            <Text style={typography.bodyStrong}>{reservation.marke} {reservation.modelis}</Text>
            {allowed && preview ? (
              <View style={styles.consequence} testID="cancel-consequence">
                {consequenceLines(preview).map((line, index) => (
                  <Text key={line} style={index === 0 ? typography.bodyStrong : typography.caption}>{line}</Text>
                ))}
              </View>
            ) : <Text style={typography.body}>{lt.cancelDialog.unavailable}</Text>}
            <Text style={typography.caption}>{lt.cancelDialog.irreversible}</Text>
            {error ? <Text style={styles.error} accessibilityRole="alert" testID="cancel-error">{error}</Text> : null}
            {allowed && preview ? (
              <Button
                label={preview.nemokamai ? lt.cancelDialog.confirmFree : lt.cancelDialog.confirmFee(formatMoney(preview.mokestis))}
                onPress={() => void confirm()}
                loading={submitting}
                variant="danger"
                testID="cancel-confirm"
              />
            ) : null}
            <Button label={lt.cancelDialog.keep} onPress={close} variant="secondary" disabled={submitting} testID="cancel-keep" />
          </ScrollView>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg, backgroundColor: overlays.scrim },
  dialog: { maxHeight: '92%', borderRadius: radius.card, backgroundColor: colors.surfaceAlt, borderWidth: 1, borderColor: colors.brand, overflow: 'hidden' },
  content: { padding: spacing.lg, gap: spacing.md },
  icon: { width: 56, height: 56, borderRadius: 18, backgroundColor: colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  consequence: { padding: spacing.lg, backgroundColor: colors.primarySoft, borderRadius: radius.md, gap: spacing.sm },
  error: { ...typography.body, color: colors.danger },
});
