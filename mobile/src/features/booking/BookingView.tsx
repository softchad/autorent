import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingRulesResponse, Extra } from '@/api/booking';
import { PublicCar } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { lt } from '@/i18n/lt';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { formatDateRange, formatDays, formatMoney } from '@/utils/format';
import { diffDays } from '@/utils/isoDate';
import { AvailabilityCalendar } from './AvailabilityCalendar';
import { BookingDraft, canContinue, pickupHours, toggleExtra } from './bookingDraft';
import { EMPTY_SELECTION, Selection } from './calendarLogic';
import { PriceBreakdown } from './PriceBreakdown';
import { QuoteInput } from './priceRequest';
import { usePriceQuote } from './usePriceQuote';

type Props = {
  car: PublicCar;
  rules: BookingRulesResponse;
  extras: Extra[];
  // Ekranas gauna naujausią juodraštį ir žinią, ar galima tęsti (mygtukas yra ekrano apačioje).
  onDraftChange: (draft: BookingDraft | null, ready: boolean) => void;
  refreshKey?: number;
  // Laikotarpis, pasirinktas dar kataloge; klientui jo nereikia rinktis iš naujo.
  initialSelection?: Selection;
};

export function BookingView(props: Props) {
  const { car, rules, extras, onDraftChange, refreshKey, initialSelection } = props;
  const [selection, setSelection] = useState<Selection>(initialSelection ?? EMPTY_SELECTION);
  const [pickupHour, setPickupHour] = useState(rules.paemimas_nuo_val);
  const [selectedExtras, setSelectedExtras] = useState<string[]>([]);

  const quoteInput: QuoteInput | null = useMemo(
    () =>
      selection.from && selection.to
        ? { carId: car.automobilio_id, from: selection.from, to: selection.to, extras: selectedExtras }
        : null,
    [car.automobilio_id, selection.from, selection.to, selectedExtras],
  );
  // Kainos pakartojimas po klaidos keičia tik kainos užklausą, ne pasirinkimus ar kalendorių.
  const [priceRetry, setPriceRetry] = useState(0);
  const price = usePriceQuote(quoteInput, (refreshKey ?? 0) + priceRetry);

  // Apie kiekvieną pasikeitimą pranešama ekranui; „ready“ – tik kai serveris patvirtino kainą laisvam automobiliui.
  const ready = canContinue(selection, price);
  const draft: BookingDraft | null = quoteInput
    ? { carId: quoteInput.carId, from: quoteInput.from, to: quoteInput.to, pickupHour, extras: selectedExtras }
    : null;
  const draftKey = draft ? JSON.stringify(draft) : '';
  useEffect(() => {
    onDraftChange(draft, ready);
    // draft turinį visiškai atspindi draftKey.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftKey, ready]);

  return (
    <View>
      <LinearGradient colors={[colors.primarySoft, colors.surfaceAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.carHeader}>
        <View style={styles.carIdentity}>
          <Text style={styles.carTitle} accessibilityRole="header">{car.marke} {car.modelis}</Text>
          <Text style={styles.carMeta}>{car.metai} · {car.kebulo_tipas}</Text>
          <Text style={styles.carMeta}>{car.pavaru_deze} · {car.kuro_tipas}</Text>
        </View>
        <Image source={getCarPhoto(car.marke)} style={styles.carPhoto} resizeMode="cover" accessible={false} />
      </LinearGradient>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="calendar-outline" size={21} color={colors.primary} accessible={false} />
          <Text style={styles.sectionTitle} accessibilityRole="header">{lt.booking.period}</Text>
        </View>
        <AvailabilityCalendar
          carId={car.automobilio_id}
          rules={rules}
          selection={selection}
          onChange={setSelection}
          refreshKey={refreshKey}
        />
        {selection.from && selection.to ? (
          <View style={styles.selectionSummary}>
            <Ionicons name="checkmark-circle" size={20} color={colors.primary} accessible={false} />
            <Text style={styles.selected} testID="selected-period">
              {lt.booking.selected(formatDateRange(selection.from, selection.to), formatDays(diffDays(selection.from, selection.to)))}
            </Text>
          </View>
        ) : null}
      </Card>

      <Card style={styles.section}>
        <View style={styles.sectionHeading}>
          <Ionicons name="time-outline" size={21} color={colors.primary} accessible={false} />
          <Text style={styles.sectionTitle} accessibilityRole="header">{lt.booking.pickupHour}</Text>
        </View>
        <View style={styles.chips}>
          {pickupHours(rules.paemimas_nuo_val, rules.paemimas_iki_val).map((hour) => (
            <Pressable
              key={hour}
              accessibilityRole="button"
              accessibilityLabel={lt.booking.hour(hour)}
              accessibilityState={{ selected: hour === pickupHour }}
              onPress={() => setPickupHour(hour)}
              style={[styles.hour, hour === pickupHour && styles.hourSelected]}
              testID={`pickup-hour-${hour}`}
            >
              <Text style={[styles.hourText, hour === pickupHour && styles.hourTextSelected]}>{lt.booking.hour(hour)}</Text>
            </Pressable>
          ))}
        </View>
        <Text style={styles.note}>{lt.booking.pickupHint(rules.grazinimas_iki_val)}</Text>
      </Card>

      {extras.length > 0 ? (
        <Card style={styles.section}>
          <View style={styles.sectionHeading}>
            <Ionicons name="add-circle-outline" size={21} color={colors.primary} accessible={false} />
            <Text style={styles.sectionTitle} accessibilityRole="header">{lt.booking.extras}</Text>
          </View>
          {extras.map((extra) => {
            const checked = selectedExtras.includes(extra.kodas);
            return (
              <Pressable
                key={extra.kodas}
                onPress={() => setSelectedExtras(toggleExtra(selectedExtras, extra.kodas))}
                accessibilityRole="checkbox"
                accessibilityState={{ checked }}
                accessibilityLabel={`${extra.pavadinimas}, ${lt.booking.extraPrice(formatMoney(extra.kaina_parai))}`}
                accessibilityHint={extra.aprasymas}
                style={[styles.extra, checked && styles.extraChecked]}
                testID={`extra-${extra.kodas}`}
              >
                <View style={styles.extraIcon}>
                  <Ionicons name={extra.kodas === 'pilna_apsauga' ? 'shield-checkmark-outline' : extra.kodas === 'papildomas_vairuotojas' ? 'person-add-outline' : 'add-outline'} size={22} color={colors.primary} accessible={false} />
                </View>
                <View style={styles.extraText}>
                  <Text style={typography.bodyStrong}>{extra.pavadinimas}</Text>
                  <Text style={typography.caption}>{extra.aprasymas}</Text>
                  <Text style={styles.extraPrice}>{lt.booking.extraPrice(formatMoney(extra.kaina_parai))}</Text>
                </View>
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked ? <Ionicons name="checkmark" size={17} color={colors.textOnPrimary} accessible={false} /> : null}
                </View>
              </Pressable>
            );
          })}
        </Card>
      ) : null}

      <PriceBreakdown state={price} />
      {price.status === 'error' ? (
        <Button
          label={lt.common.retry}
          onPress={() => setPriceRetry((count) => count + 1)}
          variant="secondary"
          testID="price-retry"
        />
      ) : null}
      {price.status === 'ready' && price.quote && !price.quote.laisvas ? (
        <Text style={styles.notFree} accessibilityRole="alert" testID="not-free">
          {lt.booking.notFree}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    marginBottom: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.card,
    borderWidth: 1,
    borderColor: colors.brand,
    backgroundColor: colors.surfaceAlt,
  },
  carIdentity: { flex: 1, gap: spacing.xs },
  carPhoto: { width: 104, height: 96, borderRadius: radius.lg, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.brand },
  carTitle: { ...typography.title, fontSize: 23, lineHeight: 30 },
  carMeta: { ...typography.caption, color: colors.textMuted },
  section: { backgroundColor: colors.surfaceAlt, borderRadius: radius.lg },
  sectionHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.lg },
  sectionTitle: { ...typography.heading, flex: 1 },
  selectionSummary: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginTop: spacing.md, padding: spacing.md, backgroundColor: colors.primarySoft, borderRadius: radius.md },
  selected: { ...typography.caption, color: colors.primary, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  hour: { minHeight: 48, minWidth: 68, paddingHorizontal: spacing.md, justifyContent: 'center', alignItems: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  hourSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  hourText: { ...typography.bodyStrong, color: colors.textMuted },
  hourTextSelected: { color: colors.primary },
  note: { ...typography.caption, marginTop: spacing.sm },
  extra: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
    backgroundColor: colors.surface,
  },
  extraChecked: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  extraText: { flex: 1 },
  extraIcon: { width: 40, height: 40, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  extraPrice: { ...typography.bodyStrong, fontSize: 14, color: colors.primary, marginTop: spacing.xs },
  box: {
    width: 24,
    height: 24,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  notFree: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
});
