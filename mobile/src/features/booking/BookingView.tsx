import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { BookingRulesResponse, Extra } from '@/api/booking';
import { PublicCar } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { lt } from '@/i18n/lt';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
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
      <Text style={typography.title} accessibilityRole="header">
        {car.marke} {car.modelis}
      </Text>

      <Card>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {lt.booking.period}
        </Text>
        <AvailabilityCalendar
          carId={car.automobilio_id}
          rules={rules}
          selection={selection}
          onChange={setSelection}
          refreshKey={refreshKey}
        />
        {selection.from && selection.to ? (
          <Text style={styles.selected} testID="selected-period">
            {lt.booking.selected(formatDateRange(selection.from, selection.to), formatDays(diffDays(selection.from, selection.to)))}
          </Text>
        ) : null}
      </Card>

      <Card>
        <Text style={styles.sectionTitle} accessibilityRole="header">
          {lt.booking.pickupHour}
        </Text>
        <View style={styles.chips}>
          {pickupHours(rules.paemimas_nuo_val, rules.paemimas_iki_val).map((hour) => (
            <Chip
              key={hour}
              label={lt.booking.hour(hour)}
              selected={hour === pickupHour}
              onPress={() => setPickupHour(hour)}
              testID={`pickup-hour-${hour}`}
            />
          ))}
        </View>
        <Text style={styles.note}>{lt.booking.pickupHint(rules.grazinimas_iki_val)}</Text>
      </Card>

      {extras.length > 0 ? (
        <Card>
          <Text style={styles.sectionTitle} accessibilityRole="header">
            {lt.booking.extras}
          </Text>
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
                <View style={[styles.box, checked && styles.boxChecked]}>
                  {checked ? <Text style={styles.tick}>✓</Text> : null}
                </View>
                <View style={styles.extraText}>
                  <Text style={typography.bodyStrong}>{extra.pavadinimas}</Text>
                  <Text style={typography.caption}>{extra.aprasymas}</Text>
                  <Text style={typography.caption}>{lt.booking.extraPrice(formatMoney(extra.kaina_parai))}</Text>
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
  sectionTitle: { ...typography.heading, marginBottom: spacing.sm },
  selected: { ...typography.bodyStrong, color: colors.primary, marginTop: spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { ...typography.caption, marginTop: spacing.sm },
  extra: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    padding: spacing.sm,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.sm,
  },
  extraChecked: { borderColor: colors.primary, borderWidth: 2, backgroundColor: colors.primarySoft },
  extraText: { flex: 1 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 2,
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.textOnPrimary, fontFamily: fonts.bold },
  notFree: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
});
