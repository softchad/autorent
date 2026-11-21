import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button, IconButton } from '@/components/Button';
import { SheetModal } from '@/components/SheetModal';
import { lt } from '@/i18n/lt';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { formatDateLong, formatDateRange } from '@/utils/format';
import { IsoDate, isBefore } from '@/utils/isoDate';
import { DateRange, deviceToday, isMonthBefore, monthOf, monthWeeks, pickDay, rangeRole, shiftMonthRef } from './dateRange';

type Props = {
  visible: boolean;
  range: DateRange;
  // Šiandienos data; testuose perduodama fiksuota.
  today?: IsoDate;
  onConfirm: (range: DateRange) => void;
  onClose: () => void;
};

// Tamsus nuomos laikotarpio kalendorius. Čia renkamos tik paieškos datos –
// konkretaus automobilio užimtumą rodo rezervavimo ekrano kalendorius.
export function DateRangeSheet({ visible, range, today = deviceToday(), onConfirm, onClose }: Props) {
  // Juodraštis: pasirinkimas galioja tik paspaudus „Patvirtinti datas“.
  const [draft, setDraft] = useState<DateRange>(range);
  const [month, setMonth] = useState(() => monthOf(range.from ?? today));

  // Kaskart atidarius lapą pradedama nuo dabartinio pasirinkimo. Priklausoma nuo datų reikšmių, ne nuo
  // range objekto: tėvui persipiešus su nauju, bet tokiu pačiu objektu, juodraštis neatstatomas.
  useEffect(() => {
    if (visible) {
      setDraft({ from: range.from, to: range.to });
      setMonth(monthOf(range.from ?? today));
    }
  }, [visible, range.from, range.to, today]);

  const complete = Boolean(draft.from && draft.to);
  // Į praėjusius mėnesius grįžti negalima – juose nėra ką rinktis.
  const canGoBack = isMonthBefore(monthOf(today), month);
  const summary = complete
    ? formatDateRange(draft.from as IsoDate, draft.to as IsoDate)
    : draft.from
      ? lt.dateSheet.chooseEnd
      : lt.dateSheet.chooseStart;

  return (
    <SheetModal
      visible={visible}
      title={lt.dateSheet.title}
      onClose={onClose}
      closeTestID="dates-close"
      testID="date-sheet"
      footer={
        <Button
          label={lt.dateSheet.confirm}
          onPress={() => onConfirm(draft)}
          disabled={!complete}
          variant="accent"
          testID="dates-confirm"
          style={styles.confirm}
        />
      }
    >
      <View style={styles.body}>
        <View style={styles.monthRow}>
          <IconButton
            icon="chevron-back"
            accessibilityLabel={lt.dateSheet.previousMonth}
            onPress={() => canGoBack && setMonth(shiftMonthRef(month, -1))}
            size={44}
            testID="dates-previous"
            style={canGoBack ? undefined : styles.dimmed}
          />
          <Text style={styles.monthTitle} accessibilityRole="header" testID="dates-month">
            {lt.dates.months[month.month - 1]} {month.year}
          </Text>
          <IconButton
            icon="chevron-forward"
            accessibilityLabel={lt.dateSheet.nextMonth}
            onPress={() => setMonth(shiftMonthRef(month, 1))}
            size={44}
            testID="dates-next"
          />
        </View>

        <View style={styles.week} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          {lt.dates.weekdays.map((name) => (
            <Text key={name} style={styles.weekday}>
              {name}
            </Text>
          ))}
        </View>

        {monthWeeks(month).map((week, weekIndex) => (
          <View key={weekIndex} style={styles.week}>
            {week.map((day, dayIndex) => {
              if (!day) {
                return <View key={dayIndex} style={styles.cell} />;
              }
              const past = isBefore(day, today);
              const role = rangeRole(day, draft);
              const selected = role === 'start' || role === 'end';
              return (
                <Pressable
                  key={day}
                  onPress={() => setDraft(pickDay(draft, day))}
                  disabled={past}
                  accessibilityRole="button"
                  accessibilityLabel={`${formatDateLong(day)}${role === 'none' ? '' : `, ${lt.dateSheet.role[role]}`}`}
                  accessibilityState={{ selected, disabled: past }}
                  testID={`date-${day}`}
                  style={[styles.cell, role === 'inside' && styles.inside, selected && styles.selected]}
                >
                  <Text style={[styles.dayText, past && styles.pastText, selected && styles.selectedText]}>{Number(day.slice(8, 10))}</Text>
                </Pressable>
              );
            })}
          </View>
        ))}

        <Text style={styles.summary} accessibilityLiveRegion="polite" testID="dates-summary">
          {summary}
        </Text>
      </View>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: spacing.lg, paddingBottom: spacing.md },
  monthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.md },
  monthTitle: { ...typography.bodyStrong, textTransform: 'capitalize' },
  dimmed: { opacity: 0.35 },
  week: { flexDirection: 'row' },
  weekday: { ...typography.label, flex: 1, textAlign: 'center', marginBottom: spacing.xs },
  cell: {
    flex: 1,
    minHeight: MIN_TOUCH_SIZE,
    margin: 2,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  inside: { backgroundColor: colors.primarySoft },
  // Pradžia ir pabaiga – mėlynos su žydru rėmeliu; pasirinkimą papildomai praneša ekrano skaitytuvas.
  selected: { backgroundColor: colors.brand, borderWidth: 2, borderColor: colors.primary },
  dayText: { ...typography.body },
  pastText: { color: colors.textMuted, opacity: 0.45 },
  selectedText: { color: colors.textOnBrand, fontFamily: fonts.semibold },
  summary: { ...typography.caption, textAlign: 'center', marginTop: spacing.md },
  confirm: { flex: 1 },
});
