import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert } from 'react-native';
import { fetchCars, fetchLocations } from '@/api/cars';
import { Screen } from '@/components/Screen';
import { CatalogueView } from '@/features/catalogue/CatalogueView';
import { FilterSheet } from '@/features/catalogue/FilterSheet';
import { CatalogueFilters, distinctValues, EMPTY_FILTERS } from '@/features/catalogue/filters';
import { useAsync } from '@/hooks/useAsync';
import { lt } from '@/i18n/lt';

export default function CarsTab() {
  const router = useRouter();
  const [filters, setFilters] = useState<CatalogueFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Pasirinkimų sąrašai (padaliniai, markės, kėbulai) užkraunami vieną kartą ir nepriklauso nuo filtrų.
  const locations = useAsync((signal) => fetchLocations(signal), []);
  const allCars = useAsync((signal) => fetchCars({ only_available: false }, signal), []);

  // Automobilio informacijos ekrano dar nėra, todėl vietoje navigacijos rodomas pranešimas.
  function showDetailsUnavailable() {
    Alert.alert(lt.catalogue.detailsUnavailableTitle, lt.catalogue.detailsUnavailable, [{ text: lt.common.close }]);
  }

  return (
    <Screen scroll={false} padded={false} topInset testID="screen-cars">
      <CatalogueView
        filters={filters}
        onChangeFilters={setFilters}
        onOpenCar={showDetailsUnavailable}
        carHint={lt.catalogue.detailsUnavailableHint}
        locations={locations.data ?? []}
        locationsStatus={locations.status}
        onRetryLocations={locations.reload}
        brands={distinctValues(allCars.data ?? [], 'marke')}
        brandsFailed={allCars.status === 'error'}
        onRetryBrands={allCars.reload}
        onOpenAccount={() => router.navigate('/paskyra')}
        onOpenFilters={() => setSheetOpen(true)}
      />
      <FilterSheet
        visible={sheetOpen}
        filters={filters}
        locations={locations.data ?? []}
        locationsStatus={locations.status}
        onRetryLocations={locations.reload}
        brands={distinctValues(allCars.data ?? [], 'marke')}
        bodyTypes={distinctValues(allCars.data ?? [], 'kebulo_tipas')}
        optionsStatus={allCars.status}
        onRetryOptions={allCars.reload}
        onApply={(next) => {
          setFilters(next);
          setSheetOpen(false);
        }}
        onClose={() => setSheetOpen(false)}
      />
    </Screen>
  );
}
