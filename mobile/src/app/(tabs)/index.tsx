import { useRouter } from 'expo-router';
import { useState } from 'react';
import { fetchCars, fetchLocations } from '@/api/cars';
import { fetchBookingRules } from '@/api/booking';
import { Screen } from '@/components/Screen';
import { CatalogueView } from '@/features/catalogue/CatalogueView';
import { FilterSheet } from '@/features/catalogue/FilterSheet';
import { CatalogueFilters, distinctValues, EMPTY_FILTERS } from '@/features/catalogue/filters';
import { useAsync } from '@/hooks/useAsync';

export default function CarsTab() {
  const router = useRouter();
  const [filters, setFilters] = useState<CatalogueFilters>(EMPTY_FILTERS);
  const [sheetOpen, setSheetOpen] = useState(false);

  // Pasirinkimų sąrašai (padaliniai, markės, kėbulai) užkraunami vieną kartą ir nepriklauso nuo filtrų.
  const locations = useAsync((signal) => fetchLocations(signal), []);
  const allCars = useAsync((signal) => fetchCars({ only_available: false }, signal), []);
  const rules = useAsync((signal) => fetchBookingRules(signal), []);

  function openCar(carId: number) {
    const period = filters.date_from && filters.date_to ? { nuo: filters.date_from, iki: filters.date_to } : {};
    router.push({ pathname: '/automobilis/[id]', params: { id: String(carId), ...period } });
  }

  return (
    <Screen scroll={false} padded={false} topInset bottomInset={false} grid testID="screen-cars">
      <CatalogueView
        filters={filters}
        today={rules.data?.siandien}
        onChangeFilters={setFilters}
        onOpenCar={(car) => openCar(car.automobilio_id)}
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
