import { useEffect, useMemo, useState } from 'react';
import { FlatList, Image, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { fetchCars } from '@/api/cars';
import { toUserMessage } from '@/api/errors';
import { Location, PublicCar } from '@/api/types';
import { Button, IconButton } from '@/components/Button';
import { Chip } from '@/components/Chip';
import { ManufacturerBelt } from '@/components/ManufacturerBelt';
import { SearchPanel } from '@/components/SearchPanel';
import { CardListSkeleton } from '@/components/Skeleton';
import { EmptyView, ErrorView } from '@/components/StateViews';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, spacing, typography } from '@/theme';
import { brandImages } from '@/theme/images';
import { formatDateCompact } from '@/utils/format';
import { CarCard } from './CarCard';
import { DateRange } from './dateRange';
import { DateRangeSheet } from './DateRangeSheet';
import { CatalogueFilters, countActiveFilters, EMPTY_FILTERS, toQuery } from './filters';
import { LocationSheet } from './LocationSheet';
import { SORT_ORDERS, sortCars, SortOrder } from './sorting';

type Props = {
  filters: CatalogueFilters;
  onChangeFilters: (filters: CatalogueFilters) => void;
  onOpenCar: (car: PublicCar) => void;
  // Jei neperduota, filtrų mygtukas nerodomas.
  onOpenFilters?: () => void;
  // Padaliniai paėmimo vietos pasirinkimui ir markės gamintojų juostai (iš realaus automobilių sąrašo).
  locations?: Location[];
  // Padalinių sąrašo užkrovimo būsena ir pakartojimas (perduodama vietos pasirinkimo lapui).
  locationsStatus?: 'loading' | 'error' | 'success';
  onRetryLocations?: () => void;
  brands?: string[];
  // true – markių sąrašo užkrauti nepavyko; vietoje gamintojų juostos rodomas pranešimas.
  brandsFailed?: boolean;
  onRetryBrands?: () => void;
  // Kortelės prieinamumo užuomina, kai paspaudimas daro ką kita nei numatyta.
  carHint?: string;
  onOpenAccount?: () => void;
};

// Paieškos skydelio pasirinkimai, kol nepaspausta „Ieškoti“.
type Criteria = Pick<CatalogueFilters, 'vietos_id' | 'date_from' | 'date_to'>;

function criteriaOf(filters: CatalogueFilters): Criteria {
  return { vietos_id: filters.vietos_id, date_from: filters.date_from, date_to: filters.date_to };
}

// Pagrindinis ekranas: paieškos skydelis, gamintojų juosta ir automobilių kortelės.
export function CatalogueView({
  filters,
  onChangeFilters,
  onOpenCar,
  onOpenFilters,
  locations = [],
  locationsStatus = 'success',
  onRetryLocations,
  brands = [],
  brandsFailed = false,
  onRetryBrands,
  carHint,
  onOpenAccount,
}: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('price_asc');
  const [criteria, setCriteria] = useState<Criteria>(criteriaOf(filters));
  const [openSheet, setOpenSheet] = useState<'location' | 'dates' | null>(null);

  // Jei filtrai pakeičiami kitur (pvz. išvalomi), skydelis rodo tą patį.
  useEffect(() => {
    setCriteria({ vietos_id: filters.vietos_id, date_from: filters.date_from, date_to: filters.date_to });
  }, [filters.vietos_id, filters.date_from, filters.date_to]);

  // Filtrų tekstinė forma naudojama kaip priklausomybė: užklausa kartojama tik pasikeitus filtrams.
  const queryKey = JSON.stringify(toQuery(filters));
  const cars = useAsync((signal) => fetchCars(toQuery(filters), signal), [queryKey]);

  const sorted = useMemo(() => (cars.data ? sortCars(cars.data, sortOrder) : []), [cars.data, sortOrder]);
  const activeCount = countActiveFilters(filters);
  const filterLabel = activeCount > 0 ? `${lt.catalogue.filters} (${activeCount})` : lt.catalogue.filters;
  const place = locations.find((item) => item.vietos_id === criteria.vietos_id);
  const range: DateRange = { from: criteria.date_from, to: criteria.date_to };

  const header = (
    <View>
      <View style={styles.topBar}>
        <Image source={brandImages.logoFull} style={styles.logo} resizeMode="contain" accessibilityLabel={lt.common.appName} />
        {onOpenAccount ? (
          <IconButton icon="person-outline" accessibilityLabel={lt.catalogue.account} onPress={onOpenAccount} testID="open-account" />
        ) : null}
      </View>
      <Text style={styles.heading} accessibilityRole="header">
        {lt.search.heading}
      </Text>
      <View style={styles.padded}>
        <SearchPanel
          locationLabel={lt.search.location}
          locationValue={place ? place.pavadinimas : lt.search.anyLocation}
          locationEmpty={!place}
          fromLabel={lt.search.from}
          fromValue={criteria.date_from ? formatDateCompact(criteria.date_from) : lt.search.chooseDate}
          toLabel={lt.search.to}
          toValue={criteria.date_to ? formatDateCompact(criteria.date_to) : lt.search.chooseDate}
          datesEmpty={!criteria.date_from || !criteria.date_to}
          searchLabel={lt.search.submit}
          onPressLocation={() => setOpenSheet('location')}
          onPressDates={() => setOpenSheet('dates')}
          // Paieška pritaiko skydelio pasirinkimus; kiti filtrai (markė, kuras ir kt.) lieka kaip buvę.
          onSearch={() => onChangeFilters({ ...filters, ...criteria })}
          searching={cars.refreshing}
        />
      </View>

      {brandsFailed ? (
        <View style={[styles.padded, styles.belt, styles.notice]}>
          <Text style={styles.noticeText} accessibilityRole="alert" testID="brands-error">
            {lt.catalogue.brandsFailed}
          </Text>
          {onRetryBrands ? <Button label={lt.common.retry} onPress={onRetryBrands} variant="secondary" testID="brands-retry" /> : null}
        </View>
      ) : brands.length > 0 ? (
        <View style={styles.belt}>
          <ManufacturerBelt
            brands={brands}
            selected={filters.marke}
            onSelect={(brand) => onChangeFilters({ ...filters, marke: brand })}
            allLabel={lt.brands.all}
          />
        </View>
      ) : null}

      <View style={styles.toolbar}>
        <Text style={styles.count} accessibilityLiveRegion="polite">
          {cars.status === 'success' ? lt.catalogue.found(sorted.length) : ' '}
        </Text>
        {onOpenFilters ? (
          <Button label={filterLabel} onPress={onOpenFilters} variant="secondary" icon="options-outline" testID="open-filters" />
        ) : null}
      </View>
      {cars.status === 'success' && cars.error ? (
        // Atnaujinti nepavyko: ankstesni automobiliai lieka sąraše, o priežastis ir pakartojimas rodomi čia.
        <View style={[styles.padded, styles.notice]}>
          <Text style={styles.noticeText} accessibilityRole="alert" testID="cars-refresh-error">
            {`${lt.catalogue.refreshFailed} ${toUserMessage(cars.error)}`}
          </Text>
          <Button label={lt.common.retry} onPress={cars.reload} variant="secondary" testID="cars-refresh-retry" />
        </View>
      ) : null}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.sortRow}>
        {SORT_ORDERS.map((order) => (
          <Chip
            key={order}
            label={lt.catalogue.sort[order]}
            selected={order === sortOrder}
            onPress={() => setSortOrder(order)}
            testID={`sort-${order}`}
          />
        ))}
      </ScrollView>
    </View>
  );

  // Sąrašo vietoje rodoma viena iš būsenų: griaučiai, klaida arba „nerasta“.
  const emptyState =
    cars.status === 'loading' ? (
      <CardListSkeleton label={lt.common.loading} cardHeight={306} />
    ) : cars.status === 'error' ? (
      <ErrorView message={toUserMessage(cars.error)} onRetry={cars.reload} />
    ) : (
      <EmptyView
        title={lt.catalogue.emptyTitle}
        message={lt.catalogue.emptyMessage}
        icon="car-sport-outline"
        actionLabel={activeCount > 0 ? lt.catalogue.clearFilters : undefined}
        onAction={() => onChangeFilters(EMPTY_FILTERS)}
      />
    );

  return (
    <View style={styles.fill}>
      <FlatList
        data={cars.status === 'success' ? sorted : []}
        keyExtractor={(car) => String(car.automobilio_id)}
        renderItem={({ item }) => (
          <View style={styles.padded}>
            <CarCard car={item} onPress={() => onOpenCar(item)} accessibilityHint={carHint} />
          </View>
        )}
        contentContainerStyle={styles.list}
        refreshControl={<RefreshControl refreshing={cars.refreshing} onRefresh={cars.reload} tintColor={colors.primary} />}
        ListHeaderComponent={header}
        ListEmptyComponent={emptyState}
        keyboardShouldPersistTaps="handled"
        testID="car-list"
      />

      <LocationSheet
        visible={openSheet === 'location'}
        locations={locations}
        status={locationsStatus}
        onRetry={onRetryLocations}
        selectedId={criteria.vietos_id}
        onSelect={(vietos_id) => {
          setCriteria({ ...criteria, vietos_id });
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
      <DateRangeSheet
        visible={openSheet === 'dates'}
        range={range}
        onConfirm={(next) => {
          setCriteria({ ...criteria, date_from: next.from, date_to: next.to });
          setOpenSheet(null);
        }}
        onClose={() => setOpenSheet(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  list: { paddingBottom: spacing.xl, flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    minHeight: 56,
  },
  // Logotipo failo kraštinių santykis 720:85.
  logo: { width: 152, height: 18 },
  heading: { ...typography.title, fontSize: 27, lineHeight: 34, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.lg },
  belt: { marginTop: spacing.xl },
  toolbar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    marginTop: spacing.xl,
    minHeight: 54,
  },
  count: { ...typography.bodyStrong },
  notice: { gap: spacing.sm, marginTop: spacing.md },
  noticeText: { ...typography.bodyStrong, color: colors.danger },
  sortRow: { gap: spacing.sm, paddingHorizontal: spacing.lg, paddingVertical: spacing.md },
});
