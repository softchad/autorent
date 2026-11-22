import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { fetchCalendar } from '@/api/booking';
import { isAbortError } from '@/api/client';
import { Button } from '@/components/Button';
import { lt } from '@/i18n/lt';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { formatDateShort } from '@/utils/format';
import {
  BookingRules,
  buildMonthGrid,
  CalendarDay,
  DayMap,
  dayRole,
  DayRole,
  DayStatus,
  isDayPressable,
  RangeProblem,
  selectDay,
  Selection,
  shiftMonth,
  toDayMap,
  YearMonth,
  yearMonthOf,
} from './calendarLogic';

type Props = {
  carId: number;
  rules: BookingRules;
  selection: Selection;
  onChange: (selection: Selection) => void;
  // Padidinus skaičių kalendorius užimtumą užkrauna iš naujo (pvz. po nepavykusio laikymo).
  refreshKey?: number;
};

// Spalva visada kartu su tekstu ekrano skaitytuvui – būsena perteikiama ne vien spalva.
const STATUS_COLORS: Record<DayStatus, { background: string; text: string }> = {
  praeitis: { background: colors.background, text: colors.textMuted },
  laisva: { background: colors.successSoft, text: colors.success },
  dalinai: { background: colors.warningSoft, text: colors.warning },
  uzimta: { background: colors.dangerSoft, text: colors.danger },
};

const ROLE_TEXT: Record<DayRole, string | null> = {
  start: lt.calendar.roleStart,
  end: lt.calendar.roleEnd,
  inside: lt.calendar.roleInside,
  none: null,
};

export function problemMessage(problem: RangeProblem, rules: BookingRules): string {
  if (problem === 'too_long') {
    return lt.calendar.problems.too_long(rules.max_paru);
  }
  return lt.calendar.problems[problem];
}

export function dayLabel(day: CalendarDay, role: DayRole): string {
  const parts = [formatDateShort(day.data), lt.calendar.status[day.busena]];
  const roleText = ROLE_TEXT[role];
  if (roleText) {
    parts.push(roleText);
  }
  return parts.join(', ');
}

export function AvailabilityCalendar({ carId, rules, selection, onChange, refreshKey = 0 }: Props) {
  const [visible, setVisible] = useState<YearMonth>(yearMonthOf(selection.from ?? rules.siandien));
  // Dienos galioja tik tam automobiliui ir refreshKey kartai, kuriai buvo užkrautos.
  const cacheKey = `${carId}:${refreshKey}`;
  const [cache, setCache] = useState<{ key: string; days: DayMap }>({ key: cacheKey, days: {} });
  const days = cache.key === cacheKey ? cache.days : {};
  const [loading, setLoading] = useState(true);
  const [loadFailed, setLoadFailed] = useState(false);
  const [problem, setProblem] = useState<RangeProblem | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  // Rodomo mėnesio užimtumas užkraunamas iš serverio ir pridedamas prie tos pačios kartos dienų.
  useEffect(() => {
    // active saugo nuo pavėluoto atsakymo, net jei užklausa abort nepaiso arba atsakymas jau perskaitytas.
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setLoadFailed(false);
    fetchCalendar(carId, visible.year, visible.month, controller.signal)
      .then((calendar) => {
        if (!active) return;
        setCache((current) => ({
          key: cacheKey,
          days: { ...(current.key === cacheKey ? current.days : {}), ...toDayMap(calendar.dienos) },
        }));
        setLoading(false);
      })
      .catch((error: unknown) => {
        if (active && !isAbortError(error)) {
          setLoadFailed(true);
          setLoading(false);
        }
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [carId, cacheKey, visible.year, visible.month, retryCount]);

  // Pasikeitus automobiliui, kartai, pasirinkimui ar dienai ankstesnis paaiškinimas nebeaktualus.
  // Atmesta pabaiga pasirinkimo nekeičia, todėl jos paaiškinimas lieka.
  useEffect(() => {
    setProblem(null);
  }, [cacheKey, selection.from, selection.to, rules.siandien]);

  function handlePress(day: CalendarDay) {
    const result = selectDay(selection, day.data, days, rules);
    setProblem(result.problem);
    if (result.selection !== selection) {
      onChange(result.selection);
    }
  }

  const isFirstMonth = visible.year * 12 + visible.month <= yearMonthOf(rules.siandien).year * 12 + yearMonthOf(rules.siandien).month;
  // Serveris leidžia mėnesius iki einamųjų metų + 2 gruodžio (public.py get_public_car_calendar).
  const isLastMonth = visible.year * 12 + visible.month >= (yearMonthOf(rules.siandien).year + 2) * 12 + 12;
  const hint = selection.from && !selection.to ? lt.calendar.hintEnd : lt.calendar.hintStart;

  return (
    <View testID="availability-calendar">
      <View style={styles.header}>
        <Pressable
          onPress={() => setVisible(shiftMonth(visible, -1))}
          disabled={isFirstMonth}
          accessibilityRole="button"
          accessibilityLabel={lt.calendar.previousMonth}
          accessibilityState={{ disabled: isFirstMonth }}
          style={[styles.arrow, isFirstMonth && styles.arrowDisabled]}
          testID="calendar-prev"
        >
          <Text style={styles.arrowText}>‹</Text>
        </Pressable>
        <View style={styles.titleRow}>
          <Text style={typography.heading} accessibilityRole="header" testID="calendar-title">
            {lt.calendar.monthTitle(visible.year, lt.calendar.months[visible.month - 1])}
          </Text>
          {loading ? <ActivityIndicator color={colors.primary} /> : null}
        </View>
        <Pressable
          onPress={() => setVisible(shiftMonth(visible, 1))}
          disabled={isLastMonth}
          accessibilityRole="button"
          accessibilityLabel={lt.calendar.nextMonth}
          accessibilityState={{ disabled: isLastMonth }}
          style={[styles.arrow, isLastMonth && styles.arrowDisabled]}
          testID="calendar-next"
        >
          <Text style={styles.arrowText}>›</Text>
        </Pressable>
      </View>

      <View style={styles.week} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
        {lt.calendar.weekdays.map((name) => (
          <Text key={name} style={styles.weekday}>
            {name}
          </Text>
        ))}
      </View>

      {buildMonthGrid(visible).map((week, weekIndex) => (
        <View key={weekIndex} style={styles.week}>
          {week.map((date, cellIndex) => {
            const day = date ? days[date] : undefined;
            if (!date || !day) {
              return <View key={cellIndex} style={styles.cell} />;
            }
            const role = dayRole(date, selection);
            const palette = STATUS_COLORS[day.busena];
            const pressable = isDayPressable(day, selection);
            const selected = role !== 'none';
            return (
              <Pressable
                key={date}
                onPress={() => handlePress(day)}
                disabled={!pressable}
                accessibilityRole="button"
                accessibilityLabel={dayLabel(day, role)}
                accessibilityState={{ disabled: !pressable, selected }}
                testID={`day-${date}`}
                style={[
                  styles.cell,
                  styles.day,
                  { backgroundColor: palette.background },
                  role === 'inside' && styles.inside,
                  (role === 'start' || role === 'end') && styles.edge,
                ]}
              >
                <Text style={[styles.dayText, { color: selected ? (role === 'inside' ? colors.primary : colors.textOnPrimary) : palette.text }]}>
                  {Number(date.slice(8))}
                </Text>
              </Pressable>
            );
          })}
        </View>
      ))}

      {loadFailed ? (
        <View style={styles.message}>
          <Text style={styles.problem} accessibilityRole="alert">
            {lt.calendar.loadError}
          </Text>
          <Button label={lt.common.retry} onPress={() => setRetryCount((count) => count + 1)} variant="secondary" />
        </View>
      ) : null}

      <Text style={problem ? styles.problem : styles.hint} accessibilityLiveRegion="polite" testID="calendar-message">
        {problem ? problemMessage(problem, rules) : hint}
      </Text>

      <View style={styles.legend}>
        <LegendItem status="laisva" label={lt.calendar.legendFree} />
        <LegendItem status="dalinai" label={lt.calendar.legendPartial} />
        <LegendItem status="uzimta" label={lt.calendar.legendBusy} />
      </View>
    </View>
  );
}

function LegendItem({ status, label }: { status: DayStatus; label: string }) {
  return (
    <View style={styles.legendItem}>
      <View style={[styles.legendSwatch, { backgroundColor: STATUS_COLORS[status].background, borderColor: STATUS_COLORS[status].text }]} />
      <Text style={styles.legendText}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.sm },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  arrow: {
    width: MIN_TOUCH_SIZE,
    height: MIN_TOUCH_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.md,
    backgroundColor: colors.primarySoft,
  },
  arrowDisabled: { opacity: 0.4 },
  arrowText: { fontSize: 26, lineHeight: 30, color: colors.primary, fontFamily: fonts.bold },
  week: { flexDirection: 'row', gap: 4, marginBottom: 4 },
  weekday: { ...typography.caption, flex: 1, textAlign: 'center' },
  cell: { flex: 1, minHeight: MIN_TOUCH_SIZE },
  day: { alignItems: 'center', justifyContent: 'center', borderRadius: radius.sm },
  dayText: { ...typography.bodyStrong },
  inside: { backgroundColor: colors.primarySoft, borderWidth: 1, borderColor: colors.primary },
  edge: { backgroundColor: colors.primary },
  message: { gap: spacing.sm, marginTop: spacing.sm },
  hint: { ...typography.body, color: colors.textMuted, marginTop: spacing.sm },
  problem: { ...typography.bodyStrong, color: colors.danger, marginTop: spacing.sm },
  legend: { marginTop: spacing.md, gap: spacing.xs },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  legendSwatch: { width: 16, height: 16, borderRadius: 4, borderWidth: 1 },
  legendText: { ...typography.caption, flex: 1 },
});
