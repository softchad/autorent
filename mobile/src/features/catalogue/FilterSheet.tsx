import { ReactNode, useEffect, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Location } from '@/api/types';
import { Button } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { SheetModal } from '@/components/SheetModal';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
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

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle} accessibilityRole="header">
        {title}
      </Text>
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
      <Chip
        key={`${key}-${value}`}
        label={label}
        selected={draft[key] === value}
        onPress={() => setDraft(toggleFilter(draft, key, value))}
        testID={`filter-${key}-${value}`}
      />
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
            variant="secondary"
            testID="filters-clear"
            style={styles.footerButton}
          />
          <Button label={lt.filterSheet.apply} onPress={() => onApply(draft)} variant="accent" testID="filters-apply" style={styles.footerButton} />
        </>
      }
    >
      <ScrollView contentContainerStyle={styles.content}>
        <Group title={lt.filterSheet.location}>
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
        <Group title={lt.filterSheet.fuel}>{FUEL_OPTIONS.map((fuel) => chip('kuro_tipas', fuel, fuel))}</Group>
        <Group title={lt.filterSheet.gearbox}>{GEARBOX_OPTIONS.map((gear) => chip('pavaru_deze', gear, gear))}</Group>
        <Group title={lt.filterSheet.seats}>
          {SEAT_OPTIONS.map((seats) => chip('sedimos_vietos', seats, lt.filterSheet.seatsFrom(seats)))}
        </Group>
        <Group title={lt.filterSheet.maxPrice}>
          {MAX_PRICE_OPTIONS.map((price) => chip('max_kaina', price, lt.filterSheet.upTo(price)))}
        </Group>
        <Group title={lt.filterSheet.brand}>
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
        <Group title={lt.filterSheet.body}>
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
  content: { paddingHorizontal: spacing.lg, paddingTop: spacing.sm, paddingBottom: spacing.xl },
  group: { marginBottom: spacing.xl },
  groupTitle: { ...typography.label, marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  note: { ...typography.caption, alignSelf: 'center' },
  errorRow: { gap: spacing.sm, alignItems: 'flex-start' },
  error: { ...typography.bodyStrong, color: colors.danger },
  footerButton: { flex: 1 },
});
