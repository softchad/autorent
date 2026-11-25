import { useEffect, useMemo, useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { FlatList, Pressable, RefreshControl, StyleSheet, Text, View } from 'react-native';
import { fetchCars } from '@/api/cars';
import { toUserMessage } from '@/api/errors';
import { Location, PublicCar } from '@/api/types';
import { Button, IconButton } from '@/components/Button';
import { ManufacturerBelt } from '@/components/ManufacturerBelt';
import { SearchPanel } from '@/components/SearchPanel';
import { CardListSkeleton } from '@/components/Skeleton';
import { EmptyView, ErrorView } from '@/components/StateViews';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { vilniusDateOf } from '@/features/booking/vilniusTime';
import { addDays, IsoDate } from '@/utils/isoDate';
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
  today?: IsoDate;
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
  today = vilniusDateOf(Date.now()),
}: Props) {
  const [sortOrder, setSortOrder] = useState<SortOrder>('recommended');
  const [sortOpen, setSortOpen] = useState(false);
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
  const topPickIds = useMemo(() => new Set(
    cars.data && cars.data.length >= 4
      ? sortCars(cars.data, 'recommended').slice(0, 3).map((car) => car.automobilio_id)
      : [],
  ), [cars.data]);
  const activeCount = countActiveFilters({ ...filters, date_from: null, date_to: null });
  const filterLabel = activeCount > 0 ? `${lt.catalogue.filters} (${activeCount})` : lt.catalogue.filters;
  const place = locations.find((item) => item.vietos_id === criteria.vietos_id);
  const range: DateRange = criteria.date_from || criteria.date_to
    ? { from: criteria.date_from, to: criteria.date_to }
    : { from: today, to: addDays(today, 1) };

  const header = (
    <View>
      <View style={styles.topBar}>
        <Text style={styles.heading} accessibilityRole="header">
          {lt.search.heading}
        </Text>
        {onOpenAccount ? (
          <IconButton icon="person-outline" accessibilityLabel={lt.catalogue.account} onPress={onOpenAccount} testID="open-account" />
        ) : null}
      </View>
      <View style={styles.padded}>
        <SearchPanel
          locationLabel={lt.search.location}
          locationValue={place ? place.pavadinimas : lt.search.anyLocation}
          locationEmpty={!place}
          fromLabel={lt.search.from}
          fromValue={range.from ? formatDateCompact(range.from) : lt.search.chooseDate}
          toLabel={lt.search.to}
          toValue={range.to ? formatDateCompact(range.to) : lt.search.chooseDate}
          datesEmpty={!range.from || !range.to}
          searchLabel={lt.search.submit}
          onPressLocation={() => setOpenSheet('location')}
          onPressDates={() => setOpenSheet('dates')}
          // Paieška pritaiko skydelio pasirinkimus; kiti filtrai (markė, kuras ir kt.) lieka kaip buvę.
          onSearch={() => onChangeFilters({ ...filters, ...criteria, date_from: range.from, date_to: range.to })}
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
        <Pressable
          onPress={() => setSortOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityLabel={`${lt.catalogue.sortLabel}: ${lt.catalogue.sort[sortOrder]}`}
          accessibilityState={{ expanded: sortOpen }}
          style={styles.sortSelect}
          testID="sort-select"
        >
          <Text style={styles.sortValue}>{lt.catalogue.sort[sortOrder]}</Text>
          <Ionicons name={sortOpen ? 'chevron-up' : 'chevron-down'} size={18} color={colors.primary} />
        </Pressable>
        {onOpenFilters ? (
          <Button label={filterLabel} onPress={() => { setSortOpen(false); onOpenFilters(); }} variant="secondary" icon="options-outline" style={styles.filterControl} testID="open-filters" />
        ) : null}
      </View>
      {sortOpen ? (
        <View style={styles.sortMenu}>
          {SORT_ORDERS.map((order) => (
            <Pressable
              key={order}
              accessibilityRole="radio"
              accessibilityLabel={lt.catalogue.sort[order]}
              accessibilityState={{ checked: order === sortOrder }}
              onPress={() => { setSortOrder(order); setSortOpen(false); }}
              style={[styles.sortOption, order === sortOrder && styles.sortSelected]}
              testID={`sort-${order}`}
            >
              <Text style={typography.bodyStrong}>{lt.catalogue.sort[order]}</Text>
              {order === sortOrder ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
            </Pressable>
          ))}
        </View>
      ) : null}
      <Text style={styles.count} accessibilityLiveRegion="polite">
        {cars.status === 'success' ? lt.catalogue.found(sorted.length) : ' '}
      </Text>
      {cars.status === 'success' && cars.error ? (
        // Atnaujinti nepavyko: ankstesni automobiliai lieka sąraše, o priežastis ir pakartojimas rodomi čia.
        <View style={[styles.padded, styles.notice]}>
          <Text style={styles.noticeText} accessibilityRole="alert" testID="cars-refresh-error">
            {`${lt.catalogue.refreshFailed} ${toUserMessage(cars.error)}`}
          </Text>
          <Button label={lt.common.retry} onPress={cars.reload} variant="secondary" testID="cars-refresh-retry" />
        </View>
      ) : null}
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
            <CarCard car={item} topPick={topPickIds.has(item.automobilio_id)} onPress={() => onOpenCar(item)} accessibilityHint={carHint} />
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
        today={today}
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
  list: { paddingBottom: 144, flexGrow: 1 },
  padded: { paddingHorizontal: spacing.lg },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  heading: { ...typography.title, fontSize: 30, lineHeight: 38, flex: 1 },
  belt: { marginTop: spacing.xl },
  toolbar: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    marginHorizontal: spacing.lg,
    marginTop: spacing.lg,
    padding: spacing.xs,
    gap: spacing.xs,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.lg,
    backgroundColor: '#0E1525',
  },
  count: { ...typography.caption, paddingHorizontal: spacing.lg, marginTop: spacing.lg, marginBottom: spacing.md },
  sortSelect: { flexGrow: 1, flexBasis: 160, minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md },
  sortValue: { ...typography.bodyStrong, flex: 1 },
  filterControl: { minHeight: 48, borderRadius: radius.md, backgroundColor: colors.primarySoft, borderColor: colors.brand },
  sortMenu: { marginHorizontal: spacing.lg, marginTop: spacing.sm, padding: spacing.sm, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: '#0E1525' },
  sortOption: { minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing.md, borderRadius: radius.md },
  sortSelected: { backgroundColor: colors.primarySoft },
  notice: { gap: spacing.sm, marginTop: spacing.md },
  noticeText: { ...typography.bodyStrong, color: colors.danger },
});
