import { ReactNode, useEffect, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Location } from '@/api/types';
import { Button, IconName } from '@/components/Button';
import { SheetModal } from '@/components/SheetModal';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import {
  CatalogueFilters,
  EMPTY_FILTERS,
  FUEL_OPTIONS,
  GEARBOX_OPTIONS,
  MAX_PRICE_OPTIONS,
  SEAT_OPTIONS,
  toggleFilter,
} from './filters';

type LoadStatus = 'loading' | 'error' | 'success';

type Props = {
  visible: boolean;
  filters: CatalogueFilters;
  locations: Location[];
  // Padalinių užklausos būsena ir pakartojimas.
  locationsStatus?: LoadStatus;
  onRetryLocations?: () => void;
  // Markės ir kėbulai gaunami ta pačia katalogo užklausa, todėl jų būsena ir pakartojimas bendri.
  brands: string[];
  bodyTypes: string[];
  optionsStatus?: LoadStatus;
  onRetryOptions?: () => void;
  onApply: (filters: CatalogueFilters) => void;
  onClose: () => void;
};

function Group({ title, icon, children }: { title: string; icon: IconName; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <View style={styles.groupHeading}>
        <View style={styles.groupIcon} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
          <Ionicons name={icon} size={19} color={colors.primary} />
        </View>
        <Text style={styles.groupTitle} accessibilityRole="header">{title}</Text>
      </View>
      <View style={styles.chips}>{children}</View>
    </View>
  );
}

// Iš serverio gaunamų pasirinkimų grupės būsena: krovimas, klaida su pakartojimu arba sėkmingai tuščias sąrašas.
function OptionsState({ status, empty, failedText, onRetry, testID }: {
  status: LoadStatus;
  empty: boolean;
  failedText: string;
  onRetry?: () => void;
  testID: string;
}) {
  if (status === 'loading') {
    return (
      <Text style={styles.note} testID={`${testID}-loading`}>
        {lt.common.loading}
      </Text>
    );
  }
  if (status === 'error') {
    return (
      <View style={styles.errorRow}>
        <Text style={styles.error} accessibilityRole="alert" testID={`${testID}-error`}>
          {failedText}
        </Text>
        {onRetry ? <Button label={lt.common.retry} onPress={onRetry} variant="secondary" testID={`${testID}-retry`} /> : null}
      </View>
    );
  }
  return empty ? (
    <Text style={styles.note} testID={`${testID}-empty`}>
      {lt.filterSheet.noOptions}
    </Text>
  ) : null;
}

export function FilterSheet({
  visible,
  filters,
  locations,
  locationsStatus = 'success',
  onRetryLocations,
  brands,
  bodyTypes,
  optionsStatus = 'success',
  onRetryOptions,
  onApply,
  onClose,
}: Props) {
  // Juodraštis: pakeitimai galioja tik paspaudus „Rodyti automobilius“.
  const [draft, setDraft] = useState<CatalogueFilters>(filters);

  // Kaskart atidarius langą arba pasikeitus pritaikytų filtrų reikšmėms juodraštis pradedamas nuo jų.
  // Priklausoma nuo reikšmių, ne nuo objekto: naujas, bet lygus filters objektas juodraščio neatstato.
  const filtersKey = JSON.stringify(filters);
  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible, filtersKey]);

  function chip<Key extends keyof CatalogueFilters>(key: Key, value: NonNullable<CatalogueFilters[Key]>, label: string) {
    return (
      <Pressable
        key={`${key}-${value}`}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: draft[key] === value }}
        onPress={() => setDraft(toggleFilter(draft, key, value))}
        style={({ pressed }) => [styles.option, draft[key] === value && styles.optionSelected, pressed && styles.optionPressed]}
        testID={`filter-${key}-${value}`}
      >
        <Text style={[styles.optionText, draft[key] === value && styles.optionTextSelected]}>{label}</Text>
        {draft[key] === value ? <Ionicons name="checkmark-circle" size={19} color={colors.primary} /> : null}
      </Pressable>
    );
  }

  // Pasirinkta reikšmė, kurios nėra (ar dar nėra) sąraše, rodoma atskirai, kad ją būtų galima išjungti.
  const missingLocation =
    draft.vietos_id !== null && !locations.some((place) => place.vietos_id === draft.vietos_id) ? draft.vietos_id : null;
  const missingBrand = draft.marke !== null && !brands.includes(draft.marke) ? draft.marke : null;
  const missingBody = draft.kebulo_tipas !== null && !bodyTypes.includes(draft.kebulo_tipas) ? draft.kebulo_tipas : null;

  return (
    <SheetModal
      visible={visible}
      title={lt.filterSheet.title}
      onClose={onClose}
      tall
      closeTestID="filters-close"
      testID="filter-sheet"
      footer={
        <>
          <Button
            label={lt.filterSheet.clear}
            onPress={() => setDraft({ ...EMPTY_FILTERS, date_from: draft.date_from, date_to: draft.date_to })}
            variant="ghost"
            testID="filters-clear"
            style={styles.clearButton}
          />
          <Button label={lt.filterSheet.apply} onPress={() => onApply(draft)} variant="accent" testID="filters-apply" style={styles.applyButton} />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.content} indicatorStyle="white">
        <Group title={lt.filterSheet.maxPrice} icon="wallet-outline">
          {MAX_PRICE_OPTIONS.map((price) => chip('max_kaina', price, lt.filterSheet.upTo(price)))}
        </Group>
        <Group title={lt.filterSheet.location} icon="location-outline">
          {missingLocation !== null ? chip('vietos_id', missingLocation, lt.filterSheet.locationById(missingLocation)) : null}
          {locationsStatus === 'success' ? locations.map((place) => chip('vietos_id', place.vietos_id, place.pavadinimas)) : null}
          <OptionsState
            status={locationsStatus}
            empty={locations.length === 0}
            failedText={lt.filterSheet.locationsFailed}
            onRetry={onRetryLocations}
            testID="filter-locations"
          />
        </Group>
        <Group title={lt.filterSheet.fuel} icon="flash-outline">{FUEL_OPTIONS.map((fuel) => chip('kuro_tipas', fuel, fuel))}</Group>
        <Group title={lt.filterSheet.gearbox} icon="settings-outline">{GEARBOX_OPTIONS.map((gear) => chip('pavaru_deze', gear, gear))}</Group>
        <Group title={lt.filterSheet.seats} icon="people-outline">
          {SEAT_OPTIONS.map((seats) => chip('sedimos_vietos', seats, lt.filterSheet.seatsFrom(seats)))}
        </Group>
        <Group title={lt.filterSheet.brand} icon="car-sport-outline">
          {missingBrand !== null ? chip('marke', missingBrand, missingBrand) : null}
          {optionsStatus === 'success' ? brands.map((brand) => chip('marke', brand, brand)) : null}
          <OptionsState
            status={optionsStatus}
            empty={brands.length === 0}
            failedText={lt.filterSheet.optionsFailed}
            onRetry={onRetryOptions}
            testID="filter-brands"
          />
        </Group>
        <Group title={lt.filterSheet.body} icon="layers-outline">
          {missingBody !== null ? chip('kebulo_tipas', missingBody, missingBody) : null}
          {optionsStatus === 'success' ? bodyTypes.map((body) => chip('kebulo_tipas', body, body)) : null}
          <OptionsState
            status={optionsStatus}
            empty={bodyTypes.length === 0}
            failedText={lt.filterSheet.optionsFailed}
            onRetry={onRetryOptions}
            testID="filter-bodies"
          />
        </Group>
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl, gap: spacing.md },
  group: { padding: spacing.md, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surfaceAlt },
  groupHeading: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, marginBottom: spacing.md },
  groupIcon: { width: 34, height: 34, borderRadius: 10, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.primarySoft },
  groupTitle: { ...typography.bodyStrong, flex: 1 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  option: { flexBasis: '48%', flexGrow: 1, minHeight: 48, paddingHorizontal: spacing.md, paddingVertical: spacing.sm, flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionPressed: { opacity: 0.8 },
  optionText: { ...typography.caption, color: colors.text, flex: 1 },
  optionTextSelected: { ...typography.bodyStrong, fontSize: 14 },
  note: { ...typography.caption, alignSelf: 'center' },
  errorRow: { gap: spacing.sm, alignItems: 'flex-start' },
  error: { ...typography.bodyStrong, color: colors.danger },
  clearButton: { minHeight: 52, borderRadius: radius.md, paddingHorizontal: spacing.md },
  applyButton: { flex: 1, minHeight: 52, borderRadius: radius.md },
});
