import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { ApiError, toUserMessage } from '@/api/errors';
import { ConfirmInput, confirmHold } from '@/api/holds';
import { CustomerReservation, PublicCar, Terms } from '@/api/types';
import { Button } from '@/components/Button';
import { Card } from '@/components/Card';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { TermsSections } from '@/features/terms/TermsSections';
import { lt } from '@/i18n/lt';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { formatDateLong, formatDateRange } from '@/utils/format';
import { BookingDraft } from './bookingDraft';
import { CountdownRing } from './CountdownRing';
import { generateIdempotencyKey } from './idempotency';
import { PriceBreakdown } from './PriceBreakdown';
import { useHold } from './useHold';
import { usePriceQuote } from './usePriceQuote';

type Props = {
  draft: BookingDraft;
  car: PublicCar;
  terms: Terms;
  // Sąlygos atnaujinamos po 409; kol atnaujinama ar nepavyko, konflikto išvada nedaroma.
  termsRefreshing: boolean;
  termsError: unknown;
  onReloadTerms: () => void;
  returnByHour: number;
  onConfirmed: (reservation: CustomerReservation) => void;
  onChooseAgain: () => void;
};

// sending/checking – prašymas išsiųstas; unknown – atsakymo nėra, todėl kartojamas tas pats prašymas;
// gone – serveris atsakė 410, naujas patvirtinimas negalimas.
type Phase = 'idle' | 'sending' | 'unknown' | 'checking' | 'gone';

// Šie atsakymai reiškia, kad serveris prašymą su šiuo raktu atmetė ir rezervacijos nesukūrė.
const REJECTED_STATUSES = new Set([400, 404, 409, 410, 422]);

type RequestBody = Omit<ConfirmInput, 'idempotencyKey'>;

function sameBody(a: RequestBody, b: RequestBody): boolean {
  return (
    a.holdId === b.holdId &&
    a.pickupHour === b.pickupHour &&
    a.termsVersion === b.termsVersion &&
    a.expectedTotal === b.expectedTotal &&
    a.extras.join(',') === b.extras.join(',')
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row} accessible accessibilityLabel={`${label}: ${value}`}>
      <Text style={typography.caption}>{label}</Text>
      <Text style={typography.bodyStrong}>{value}</Text>
    </View>
  );
}

export function ConfirmView({
  draft,
  car,
  terms,
  termsRefreshing,
  termsError,
  onReloadTerms,
  returnByHour,
  onConfirmed,
  onChooseAgain,
}: Props) {
  const hold = useHold(draft);
  const quoteInput = useMemo(
    () => ({ carId: draft.carId, from: draft.from, to: draft.to, extras: draft.extras }),
    [draft.carId, draft.from, draft.to, draft.extras],
  );
  const [quoteRefresh, setQuoteRefresh] = useState(0);
  const price = usePriceQuote(quoteInput, quoteRefresh);
  const quote = price.status === 'ready' ? price.quote : null;

  // Sutikimas galioja tik tai sąlygų versijai ir sumai, kurias klientas matė pažymėdamas.
  const [consent, setConsent] = useState<{ version: string; total: number } | null>(null);
  const accepted = consent !== null && quote !== null && consent.version === terms.versija && consent.total === quote.viso;

  const [phase, setPhase] = useState<Phase>('idle');
  const [submitError, setSubmitError] = useState<string | null>(null);
  // 409 gavusio prašymo versija ir suma: atnaujinus duomenis palyginama, ar kas nors pasikeitė.
  const [conflict, setConflict] = useState<{ version: string; total: number | undefined } | null>(null);
  // Paskutinis išsiųstas prašymas su raktu; settled – serveris jį aiškiai atmetė.
  const pendingRef = useRef<{ input: ConfirmInput; settled: boolean } | null>(null);
  // Sinchroninis užraktas: antras paspaudimas iki kito atvaizdavimo antro POST nesiunčia.
  const inFlightRef = useRef(false);
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const conflictChecked = conflict !== null && quote !== null && !termsRefreshing && !termsError;
  const conflictPersists = conflictChecked && quote.viso === conflict.total && terms.versija === conflict.version;
  const conflictChanged = conflictChecked && !conflictPersists;
  const conflictBlocks = conflict !== null && !conflictChanged;
  const resultUnknown = phase === 'unknown' || phase === 'checking';

  async function send(input: ConfirmInput, nextPhase: 'sending' | 'checking') {
    if (inFlightRef.current) {
      return;
    }
    inFlightRef.current = true;
    pendingRef.current = { input, settled: false };
    setPhase(nextPhase);
    setSubmitError(null);
    try {
      const reservation = await confirmHold(input);
      // Išmontuotas turinys priklauso ankstesniam klientui ar juodraščiui – rezultatas čia nerodomas.
      if (!mountedRef.current) {
        return;
      }
      hold.markUsed();
      onConfirmed(reservation);
    } catch (error) {
      if (!mountedRef.current) {
        return;
      }
      const status = error instanceof ApiError ? error.status : null;
      if (status === null || !REJECTED_STATUSES.has(status)) {
        setPhase('unknown');
        setSubmitError(lt.confirm.unknownResult);
        return;
      }
      pendingRef.current = { input, settled: true };
      if (status === 410) {
        setPhase('gone');
        return;
      }
      setPhase('idle');
      setSubmitError(toUserMessage(error));
      if (status === 409) {
        setConflict({ version: input.termsVersion, total: input.expectedTotal });
        setQuoteRefresh((value) => value + 1);
        onReloadTerms();
      }
    } finally {
      inFlightRef.current = false;
    }
  }

  function handleConfirm() {
    if (phase !== 'idle' || !hold.hold || hold.status !== 'active' || !accepted || !quote || conflictBlocks) {
      return;
    }
    const body: RequestBody = {
      holdId: hold.hold.laikymo_id,
      extras: draft.extras,
      pickupHour: draft.pickupHour,
      termsVersion: terms.versija,
      expectedTotal: quote.viso,
    };
    // Atmesto prašymo raktas tinka tik tokiam pačiam turiniui; pakeistam prašymui – naujas raktas.
    const previous = pendingRef.current;
    const idempotencyKey = previous && sameBody(previous.input, body) ? previous.input.idempotencyKey : generateIdempotencyKey();
    setConflict(null);
    void send({ ...body, idempotencyKey }, 'sending');
  }

  // Neaiškus rezultatas tikrinamas tuo pačiu raktu ir tuo pačiu turiniu, net pasibaigus vietiniam laikui.
  function handleCheckResult() {
    const pending = pendingRef.current;
    if (pending && !pending.settled) {
      void send(pending.input, 'checking');
    }
  }

  if (phase === 'gone') {
    return (
      <View style={styles.expired} testID="hold-expired">
        <CountdownRing remainingMs={0} totalMs={hold.totalMs} />
        <Text style={typography.heading} accessibilityRole="alert">
          {lt.confirm.expiredTitle}
        </Text>
        <Text style={styles.expiredText}>{lt.confirm.expiredMessage}</Text>
        <Button label={lt.confirm.chooseAgain} onPress={onChooseAgain} testID="expired-choose-again" />
      </View>
    );
  }
  if (hold.status === 'creating') {
    return <LoadingView message={lt.confirm.holding} />;
  }
  if (hold.status === 'error') {
    return (
      <View testID="hold-error">
        <ErrorView message={toUserMessage(hold.error)} onRetry={hold.retry} />
        <Button label={lt.confirm.chooseAgain} onPress={onChooseAgain} variant="secondary" testID="hold-choose-again" />
      </View>
    );
  }
  // Vietinis laikas baigėsi, o išsiųsto prašymo nėra – rezervacija tikrai nesukurta.
  if (hold.status === 'expired' && phase === 'idle') {
    return (
      <View style={styles.expired} testID="hold-expired">
        <CountdownRing remainingMs={0} totalMs={hold.totalMs} />
        <Text style={typography.heading} accessibilityRole="alert">
          {lt.confirm.expiredTitle}
        </Text>
        <Text style={styles.expiredText}>{lt.confirm.expiredMessage}</Text>
        <Button label={lt.confirm.chooseAgain} onPress={onChooseAgain} testID="expired-choose-again" />
      </View>
    );
  }

  return (
    <View testID="confirm-view">
      <CountdownRing remainingMs={hold.remainingMs} totalMs={hold.totalMs} />

      <Card style={styles.summary}>
        <Text style={styles.cardTitle} accessibilityRole="header">
          {lt.confirm.summary}
        </Text>
        <Text style={typography.bodyStrong}>
          {car.marke} {car.modelis}
        </Text>
        <SummaryRow label={lt.confirm.period} value={formatDateRange(draft.from, draft.to)} />
        <SummaryRow
          label={lt.confirm.pickup}
          value={lt.confirm.pickupValue(car.lokacija?.pavadinimas ?? '', draft.pickupHour)}
        />
        <SummaryRow label={lt.confirm.returnBy} value={lt.confirm.returnValue(formatDateLong(draft.to), returnByHour)} />
      </Card>

      <PriceBreakdown state={price} />
      {price.status === 'error' ? (
        <Button
          label={lt.common.retry}
          onPress={() => setQuoteRefresh((count) => count + 1)}
          variant="secondary"
          testID="price-retry"
        />
      ) : null}

      <Text style={styles.cardTitle} accessibilityRole="header">
        {lt.confirm.termsTitle}
      </Text>
      <TermsSections sections={terms.skyriai} />
      {termsError ? (
        <View testID="terms-error">
          <Text style={styles.error} accessibilityRole="alert">
            {toUserMessage(termsError)}
          </Text>
          <Button label={lt.common.retry} onPress={onReloadTerms} variant="secondary" testID="terms-retry" />
        </View>
      ) : null}

      {resultUnknown ? (
        <View testID="confirm-unknown">
          <Text style={styles.error} accessibilityRole="alert" testID="confirm-error">
            {submitError ?? lt.confirm.unknownResult}
          </Text>
          <Button
            label={lt.confirm.checkResult}
            onPress={handleCheckResult}
            loading={phase === 'checking'}
            variant="accent"
            testID="confirm-check"
          />
        </View>
      ) : (
        <>
          <Pressable
            onPress={() => setConsent(accepted || !quote ? null : { version: terms.versija, total: quote.viso })}
            disabled={!quote}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: accepted, disabled: !quote }}
            accessibilityLabel={lt.confirm.accept}
            style={[styles.accept, accepted && styles.acceptChecked]}
            testID="accept-terms"
          >
            <View style={[styles.box, accepted && styles.boxChecked]}>{accepted ? <Text style={styles.tick}>✓</Text> : null}</View>
            <Text style={styles.acceptText}>{lt.confirm.accept}</Text>
          </Pressable>

          {conflictChanged ? (
            <Text style={styles.error} accessibilityRole="alert" testID="confirm-error">
              {lt.confirm.conflictChanged}
            </Text>
          ) : null}
          {!conflictChanged && submitError ? (
            <Text style={styles.error} accessibilityRole="alert" testID="confirm-error">
              {submitError}
            </Text>
          ) : null}
          {conflictPersists ? (
            <Button
              label={lt.confirm.chooseAgain}
              onPress={onChooseAgain}
              variant="secondary"
              testID="conflict-choose-again"
              style={styles.chooseAgain}
            />
          ) : null}

          <Button
            label={lt.confirm.submit}
            accessibilityHint={lt.confirm.submitHint}
            onPress={handleConfirm}
            disabled={!accepted || conflictBlocks || hold.status !== 'active'}
            loading={phase === 'sending'}
            variant="accent"
            icon="checkmark"
            testID="confirm-submit"
          />
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  summary: { marginTop: spacing.lg },
  cardTitle: { ...typography.heading, marginBottom: spacing.sm },
  row: { marginTop: spacing.sm },
  expired: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  expiredText: { ...typography.body, color: colors.textMuted, textAlign: 'center' },
  accept: {
    flexDirection: 'row',
    gap: spacing.md,
    minHeight: MIN_TOUCH_SIZE,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
    marginBottom: spacing.md,
  },
  acceptChecked: { borderColor: colors.primary, borderWidth: 2 },
  acceptText: { ...typography.body, flex: 1 },
  box: {
    width: 24,
    height: 24,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: colors.textMuted,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxChecked: { backgroundColor: colors.primary, borderColor: colors.primary },
  tick: { color: colors.textOnPrimary, fontFamily: fonts.bold },
  error: { ...typography.bodyStrong, color: colors.danger, marginBottom: spacing.md },
  chooseAgain: { marginBottom: spacing.md },
});
