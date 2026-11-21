import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import * as carsApi from '@/api/cars';
import { ApiError } from '@/api/errors';
import { makeCar } from '@/testUtils/fixtures';
import { toIsoDate } from '@/utils/isoDate';
import { CatalogueView } from './CatalogueView';
import { deviceToday, monthOf, shiftMonthRef } from './dateRange';
import { EMPTY_FILTERS } from './filters';

type FiberLike = { memoizedProps?: { refreshControl?: { props: { onRefresh: () => void } } }; return: FiberLike | null } | null;

// RN Jest imitacija RefreshControl atvaizduoja be props, todėl „patraukimas žemyn“ kviečia FlatList
// perduoto refreshControl onRefresh; jis randamas per RNTL unstable_fiber.
async function pullToRefresh() {
  let fiber = (screen.getByTestId('car-list') as unknown as { unstable_fiber: FiberLike }).unstable_fiber;
  while (fiber && !fiber.memoizedProps?.refreshControl) {
    fiber = fiber.return;
  }
  const onRefresh = fiber?.memoizedProps?.refreshControl?.props.onRefresh;
  if (!onRefresh) {
    throw new Error('Nerastas refreshControl');
  }
  await act(async () => {
    onRefresh();
  });
}

// Kalendorius neleidžia rinktis praėjusių dienų, todėl imamos kito mėnesio dienos nuo telefono datos.
function nextMonthDays() {
  const next = shiftMonthRef(monthOf(deviceToday()), 1);
  return { from: toIsoDate(next.year, next.month, 3), to: toIsoDate(next.year, next.month, 6) };
}

jest.mock('@/api/cars');
const fetchCars = jest.mocked(carsApi.fetchCars);

const CARS = [
  makeCar({ automobilio_id: 1, marke: 'Toyota', modelis: 'Corolla', kaina_parai: 45 }),
  makeCar({ automobilio_id: 2, marke: 'Tesla', modelis: 'Model 3', kaina_parai: 90, kuro_tipas: 'elektra' }),
];

const LOCATIONS = [
  { vietos_id: 1, pavadinimas: 'Vilnius Centras', adresas: 'Gedimino pr. 1, Vilnius', miestas: 'Vilnius' },
  { vietos_id: 2, pavadinimas: 'Kaunas Centras', adresas: 'Laisvės al. 10, Kaunas', miestas: 'Kaunas' },
];

function renderView(overrides: Partial<Parameters<typeof CatalogueView>[0]> = {}) {
  const props = {
    filters: EMPTY_FILTERS,
    onChangeFilters: jest.fn(),
    onOpenFilters: jest.fn(),
    onOpenCar: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<CatalogueView {...props} />) };
}

beforeEach(() => fetchCars.mockReset());

describe('CatalogueView', () => {
  it('užkrauna ir parodo automobilius', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView().view;
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());
    expect(screen.getByText('Tesla Model 3')).toBeTruthy();
    expect(screen.getByText('Rasta: 2')).toBeTruthy();
  });

  it('klaidos atveju leidžia pakartoti', async () => {
    fetchCars.mockRejectedValueOnce(new ApiError('network')).mockResolvedValue(CARS);
    await renderView().view;
    await waitFor(() => expect(screen.getByTestId('error-view')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());
  });

  it('tuščiam rezultatui su filtrais siūlo juos išvalyti', async () => {
    fetchCars.mockResolvedValue([]);
    const { props, view } = renderView({ filters: { ...EMPTY_FILTERS, kuro_tipas: 'dujos' } });
    await view;
    await waitFor(() => expect(screen.getByText('Pagal pasirinktus kriterijus automobilių nerasta.')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Išvalyti filtrus' }));
    expect(props.onChangeFilters).toHaveBeenCalledWith(EMPTY_FILTERS);
  });

  it('filtrų mygtukas rodo aktyvių filtrų skaičių', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView({ filters: { ...EMPTY_FILTERS, kuro_tipas: 'elektra', vietos_id: 1 } }).view;
    expect(screen.getByRole('button', { name: 'Filtrai (2)' })).toBeTruthy();
  });

  it('filtrus perduoda serveriui', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView({ filters: { ...EMPTY_FILTERS, kuro_tipas: 'elektra' } }).view;
    expect(fetchCars.mock.calls[0][0]).toMatchObject({ kuro_tipas: 'elektra' });
  });

  it('rikiavimas pakeičia tvarką be naujos užklausos', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView().view;
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());
    await fireEvent.press(screen.getByRole('button', { name: 'Brangiausi' }));
    const titles = screen.getAllByText(/Corolla|Model 3/).map((node) => node.props.children);
    expect(titles[0]).toBe('Tesla Model 3');
    expect(fetchCars).toHaveBeenCalledTimes(1);
  });

  it('kol automobiliai kraunami, rodomi kortelių griaučiai, o paieškos skydelis jau veikia', async () => {
    fetchCars.mockReturnValue(new Promise(() => {}));
    await renderView().view;
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    // Griaučių kortelės tokio pat aukščio kaip VehicleCard (306), kad įsikėlus sąrašui nešokinėtų.
    for (const skeleton of screen.getByTestId('loading-view').children) {
      expect(skeleton).toHaveStyle({ height: 306 });
    }
    expect(screen.getByRole('header', { name: 'Rask savo automobilį' })).toBeTruthy();
    expect(screen.getByTestId('search-panel')).toBeTruthy();
  });

  it('paėmimo vieta pasirenkama iš padalinių ir pritaikoma tik paspaudus „Ieškoti“', async () => {
    fetchCars.mockResolvedValue(CARS);
    const { props, view } = renderView({ locations: LOCATIONS });
    await view;
    await fireEvent.press(screen.getByTestId('search-location'));
    await fireEvent.press(screen.getByRole('radio', { name: 'Kaunas Centras, Laisvės al. 10, Kaunas' }));
    expect(screen.getByRole('button', { name: 'Paėmimo vieta: Kaunas Centras' })).toBeTruthy();
    expect(props.onChangeFilters).not.toHaveBeenCalled();
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...EMPTY_FILTERS, vietos_id: 2 });
  });

  it('paieška išlaiko kitus filtrus (markę, kurą)', async () => {
    fetchCars.mockResolvedValue(CARS);
    const filters = { ...EMPTY_FILTERS, marke: 'Tesla', kuro_tipas: 'elektra' };
    const { props, view } = renderView({ filters, locations: LOCATIONS });
    await view;
    await fireEvent.press(screen.getByTestId('search-location'));
    await fireEvent.press(screen.getByTestId('location-1'));
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...filters, vietos_id: 1 });
  });

  it('skydelyje rodomas jau pritaikytas laikotarpis trumpu formatu', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView({ filters: { ...EMPTY_FILTERS, date_from: '2026-10-31', date_to: '2026-11-04' } }).view;
    expect(screen.getByRole('button', { name: 'Nuo: 31 Spa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iki: 4 Lap' })).toBeTruthy();
  });

  it('gamintojų juosta rodo realias markes ir filtruoja pagal pasirinktą', async () => {
    fetchCars.mockResolvedValue(CARS);
    const { props, view } = renderView({ brands: ['Tesla', 'Toyota'] });
    await view;
    expect(screen.getByTestId('brand-all').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByTestId('brand-tesla'));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...EMPTY_FILTERS, marke: 'Tesla' });
  });

  it('be markių sąrašo juosta nerodoma, be filtrų veiksmo – nerodomas ir filtrų mygtukas', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView({ onOpenFilters: undefined }).view;
    expect(screen.queryByTestId('manufacturer-belt')).toBeNull();
    expect(screen.queryByTestId('open-filters')).toBeNull();
  });

  it('paspaudus kortelę atidaro automobilį', async () => {
    fetchCars.mockResolvedValue(CARS);
    const { props, view } = renderView();
    await view;
    await waitFor(() => expect(screen.getByTestId('car-card-2')).toBeTruthy());
    await fireEvent.press(screen.getByTestId('car-card-2'));
    expect(props.onOpenCar).toHaveBeenCalledWith(expect.objectContaining({ automobilio_id: 2 }));
  });

  it('kortelės užuomina perduodama iš ekrano, numatyta – lieka', async () => {
    fetchCars.mockResolvedValue(CARS);
    const { view } = renderView({ carHint: 'Parodo pranešimą' });
    await view;
    await waitFor(() => expect(screen.getByTestId('car-card-1')).toBeTruthy());
    expect(screen.getByTestId('car-card-1').props.accessibilityHint).toBe('Parodo pranešimą');
  });
});

describe('CatalogueView – atnaujinimo klaida', () => {
  it('nepavykus atnaujinti, ankstesni automobiliai lieka, rodoma klaida ir pakartojimas', async () => {
    fetchCars.mockResolvedValueOnce(CARS).mockRejectedValueOnce(new ApiError('network')).mockResolvedValue(CARS);
    await renderView().view;
    await waitFor(() => expect(screen.getByText('Toyota Corolla')).toBeTruthy());
    expect(screen.queryByTestId('cars-refresh-error')).toBeNull();

    await pullToRefresh();
    await waitFor(() => expect(screen.getByTestId('cars-refresh-error')).toBeTruthy());
    expect(screen.getByTestId('cars-refresh-error')).toHaveTextContent(
      'Sąrašo atnaujinti nepavyko, rodomi anksčiau gauti automobiliai. Nepavyko prisijungti prie serverio. Patikrinkite interneto ryšį.',
    );
    expect(screen.getByText('Toyota Corolla')).toBeTruthy();
    expect(screen.getByText('Tesla Model 3')).toBeTruthy();

    await fireEvent.press(screen.getByTestId('cars-refresh-retry'));
    await waitFor(() => expect(screen.queryByTestId('cars-refresh-error')).toBeNull());
    expect(fetchCars).toHaveBeenCalledTimes(3);
  });
});

describe('CatalogueView – padalinių ir markių užkrovimas', () => {
  it('nepavykus užkrauti markių, rodomas pranešimas ir pakartojimas, o ne tuščia juosta', async () => {
    fetchCars.mockResolvedValue(CARS);
    const onRetryBrands = jest.fn();
    await renderView({ brandsFailed: true, onRetryBrands }).view;
    expect(screen.getByTestId('brands-error')).toHaveTextContent('Gamintojų sąrašo užkrauti nepavyko.');
    expect(screen.queryByTestId('manufacturer-belt')).toBeNull();
    await fireEvent.press(screen.getByTestId('brands-retry'));
    expect(onRetryBrands).toHaveBeenCalledTimes(1);
  });

  it('padalinių klaida ir pakartojimas perduodami vietos pasirinkimui', async () => {
    fetchCars.mockResolvedValue(CARS);
    const onRetryLocations = jest.fn();
    await renderView({ locationsStatus: 'error', onRetryLocations }).view;
    await fireEvent.press(screen.getByTestId('search-location'));
    expect(screen.getByText('Padalinių sąrašo užkrauti nepavyko.')).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: 'Bandyti dar kartą' }));
    expect(onRetryLocations).toHaveBeenCalledTimes(1);
  });

  it('kol padaliniai kraunami, vietos lape rodomas krovimas', async () => {
    fetchCars.mockResolvedValue(CARS);
    await renderView({ locationsStatus: 'loading' }).view;
    await fireEvent.press(screen.getByTestId('search-location'));
    expect(screen.getByLabelText('Kraunami padaliniai…')).toBeTruthy();
  });
});

describe('CatalogueView – datų juodraštis', () => {
  it('patvirtintos datos pritaikomos tik paspaudus „Ieškoti“, kiti filtrai lieka', async () => {
    fetchCars.mockResolvedValue(CARS);
    const filters = { ...EMPTY_FILTERS, marke: 'Tesla' };
    const { props, view } = renderView({ filters });
    await view;
    const { from, to } = nextMonthDays();

    await fireEvent.press(screen.getByTestId('search-from'));
    await fireEvent.press(screen.getByTestId('dates-next'));
    await fireEvent.press(screen.getByTestId(`date-${from}`));
    await fireEvent.press(screen.getByTestId(`date-${to}`));
    await fireEvent.press(screen.getByTestId('dates-confirm'));
    expect(props.onChangeFilters).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(props.onChangeFilters).toHaveBeenCalledWith({ ...filters, date_from: from, date_to: to });
  });

  it('uždarius kalendorių be patvirtinimo datos nepritaikomos', async () => {
    fetchCars.mockResolvedValue(CARS);
    const { props, view } = renderView();
    await view;
    const { from, to } = nextMonthDays();

    await fireEvent.press(screen.getByTestId('search-from'));
    await fireEvent.press(screen.getByTestId('dates-next'));
    await fireEvent.press(screen.getByTestId(`date-${from}`));
    await fireEvent.press(screen.getByTestId(`date-${to}`));
    await fireEvent.press(screen.getByTestId('dates-close'));

    expect(screen.getByRole('button', { name: 'Nuo: Pasirinkti' })).toBeTruthy();
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(props.onChangeFilters).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});
