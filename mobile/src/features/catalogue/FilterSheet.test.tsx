import { fireEvent, render, screen } from '@testing-library/react-native';
import { FilterSheet } from './FilterSheet';
import { EMPTY_FILTERS } from './filters';

const LOCATIONS = [
  { vietos_id: 1, pavadinimas: 'Vilnius Centras', adresas: 'Gedimino pr. 1, Vilnius', miestas: 'Vilnius' },
  { vietos_id: 2, pavadinimas: 'Kaunas Centras', adresas: 'Laisvės al. 10, Kaunas', miestas: 'Kaunas' },
];

function renderSheet(overrides: Partial<Parameters<typeof FilterSheet>[0]> = {}) {
  const props = {
    visible: true,
    filters: EMPTY_FILTERS,
    locations: LOCATIONS,
    brands: ['Audi', 'Toyota'],
    bodyTypes: ['Sedanas'],
    onApply: jest.fn(),
    onClose: jest.fn(),
    ...overrides,
  };
  return { props, view: render(<FilterSheet {...props} />) };
}

describe('FilterSheet', () => {
  it('pasirinkimai pritaikomi tik paspaudus „Rodyti automobilius“', async () => {
    const { props, view } = renderSheet();
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'elektra' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Kaunas Centras' }));
    expect(props.onApply).not.toHaveBeenCalled();

    await fireEvent.press(screen.getByRole('button', { name: 'Rodyti automobilius' }));
    expect(props.onApply).toHaveBeenCalledWith({ ...EMPTY_FILTERS, kuro_tipas: 'elektra', vietos_id: 2 });
  });

  it('pažymi jau įjungtus filtrus', async () => {
    await renderSheet({ filters: { ...EMPTY_FILTERS, pavaru_deze: 'automatinė' } }).view;
    expect(screen.getByRole('button', { name: 'automatinė' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'mechaninė' }).props.accessibilityState).toEqual({ selected: false });
  });

  it('„Išvalyti“ nuima filtrus, bet palieka pasirinktą laikotarpį', async () => {
    const filters = { ...EMPTY_FILTERS, marke: 'Audi', date_from: '2026-11-28', date_to: '2026-12-02' };
    const { props, view } = renderSheet({ filters });
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'Išvalyti' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Rodyti automobilius' }));
    expect(props.onApply).toHaveBeenCalledWith({ ...EMPTY_FILTERS, date_from: '2026-11-28', date_to: '2026-12-02' });
  });

  it('uždarius be patvirtinimo filtrai nepakeičiami', async () => {
    const { props, view } = renderSheet();
    await view;
    await fireEvent.press(screen.getByRole('button', { name: 'dyzelinas' }));
    await fireEvent.press(screen.getByRole('button', { name: 'Uždaryti' }));
    expect(props.onClose).toHaveBeenCalledTimes(1);
    expect(props.onApply).not.toHaveBeenCalled();
  });

  it('pakartotinai paspaudus tą patį pasirinkimą jis išjungiamas', async () => {
    const { props, view } = renderSheet({ filters: { ...EMPTY_FILTERS, sedimos_vietos: 5 } });
    await view;
    await fireEvent.press(screen.getByTestId('filter-max_kaina-60'));
    expect(screen.getByTestId('filter-max_kaina-60').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByTestId('filter-max_kaina-60'));
    expect(screen.getByTestId('filter-max_kaina-60').props.accessibilityState).toEqual({ selected: false });
    await fireEvent.press(screen.getByTestId('filter-sedimos_vietos-5'));

    await fireEvent.press(screen.getByTestId('filters-apply'));
    expect(props.onApply).toHaveBeenCalledWith(EMPTY_FILTERS);
  });
});

describe('FilterSheet – juodraščio atstatymas', () => {
  const base = { locations: LOCATIONS, brands: ['Audi', 'Toyota'], bodyTypes: ['Sedanas'], onApply: jest.fn(), onClose: jest.fn() };

  it('tėvui persipiešus su nauju lygiu filters objektu juodraštis išlieka', async () => {
    const applied = { ...EMPTY_FILTERS, marke: 'Audi' };
    const { rerender } = await render(<FilterSheet visible filters={applied} {...base} />);
    await fireEvent.press(screen.getByTestId('filter-kuro_tipas-elektra'));

    await rerender(<FilterSheet visible filters={{ ...applied }} {...base} />);

    expect(screen.getByTestId('filter-kuro_tipas-elektra').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('filter-marke-Audi').props.accessibilityState).toEqual({ selected: true });
  });

  it('uždarius ir vėl atidarius rodomi pritaikyti filtrai, ne neišsaugotas juodraštis', async () => {
    const applied = { ...EMPTY_FILTERS, pavaru_deze: 'automatinė' };
    const { rerender } = await render(<FilterSheet visible filters={applied} {...base} />);
    await fireEvent.press(screen.getByTestId('filter-kuro_tipas-elektra'));

    await rerender(<FilterSheet visible={false} filters={applied} {...base} />);
    await rerender(<FilterSheet visible filters={applied} {...base} />);

    expect(screen.getByTestId('filter-kuro_tipas-elektra').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId('filter-pavaru_deze-automatinė').props.accessibilityState).toEqual({ selected: true });
  });

  it('pasikeitus pritaikytų filtrų reikšmėms atidarytas juodraštis atnaujinamas', async () => {
    const { rerender } = await render(<FilterSheet visible filters={EMPTY_FILTERS} {...base} />);
    await rerender(<FilterSheet visible filters={{ ...EMPTY_FILTERS, kuro_tipas: 'dujos' }} {...base} />);
    expect(screen.getByTestId('filter-kuro_tipas-dujos').props.accessibilityState).toEqual({ selected: true });
  });
});

describe('FilterSheet – serverio pasirinkimų būsenos', () => {
  it('kraunant padalinius ir katalogo pasirinkimus rodomas krovimas, ne tuščias sąrašas', async () => {
    await renderSheet({ locations: [], brands: [], bodyTypes: [], locationsStatus: 'loading', optionsStatus: 'loading' }).view;
    expect(screen.getByTestId('filter-locations-loading')).toBeTruthy();
    expect(screen.getByTestId('filter-brands-loading')).toBeTruthy();
    expect(screen.getByTestId('filter-bodies-loading')).toBeTruthy();
    expect(screen.queryByText('Pasirinkimų nėra.')).toBeNull();
  });

  it('nepavykus rodoma klaida ir pakartojimas; markė ir kėbulas kartoja tą pačią užklausą', async () => {
    const onRetryLocations = jest.fn();
    const onRetryOptions = jest.fn();
    await renderSheet({
      locations: [],
      brands: [],
      bodyTypes: [],
      locationsStatus: 'error',
      optionsStatus: 'error',
      onRetryLocations,
      onRetryOptions,
    }).view;
    expect(screen.getByTestId('filter-locations-error')).toHaveTextContent('Padalinių užkrauti nepavyko.');
    expect(screen.getByTestId('filter-brands-error')).toHaveTextContent('Pasirinkimų užkrauti nepavyko.');
    expect(screen.getByTestId('filter-bodies-error')).toHaveTextContent('Pasirinkimų užkrauti nepavyko.');
    expect(screen.queryByText('Pasirinkimų nėra.')).toBeNull();

    await fireEvent.press(screen.getByTestId('filter-locations-retry'));
    await fireEvent.press(screen.getByTestId('filter-brands-retry'));
    await fireEvent.press(screen.getByTestId('filter-bodies-retry'));
    expect(onRetryLocations).toHaveBeenCalledTimes(1);
    expect(onRetryOptions).toHaveBeenCalledTimes(2);
  });

  it('sėkmingai gautas tuščias sąrašas rodomas kaip „Pasirinkimų nėra.“', async () => {
    await renderSheet({ locations: [], brands: [], bodyTypes: [] }).view;
    expect(screen.getByTestId('filter-locations-empty')).toHaveTextContent('Pasirinkimų nėra.');
    expect(screen.getByTestId('filter-brands-empty')).toBeTruthy();
    expect(screen.getByTestId('filter-bodies-empty')).toBeTruthy();
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('pasirinkta reikšmė, kurios nebėra sąraše, rodoma ir gali būti išjungta', async () => {
    const filters = { ...EMPTY_FILTERS, vietos_id: 9, marke: 'Saab', kebulo_tipas: 'Kabrioletas', kuro_tipas: 'elektra' };
    const { props, view } = renderSheet({ filters, optionsStatus: 'error', locationsStatus: 'success' });
    await view;

    // Padalinio pavadinimas nežinomas, todėl rodomas tik numeris.
    expect(screen.getByRole('button', { name: 'Pasirinktas padalinys Nr. 9' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('filter-marke-Saab').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('filter-kebulo_tipas-Kabrioletas').props.accessibilityState).toEqual({ selected: true });

    await fireEvent.press(screen.getByTestId('filter-vietos_id-9'));
    await fireEvent.press(screen.getByTestId('filter-marke-Saab'));
    await fireEvent.press(screen.getByTestId('filter-kebulo_tipas-Kabrioletas'));
    expect(screen.queryByTestId('filter-vietos_id-9')).toBeNull();

    await fireEvent.press(screen.getByTestId('filters-apply'));
    expect(props.onApply).toHaveBeenCalledWith({ ...EMPTY_FILTERS, kuro_tipas: 'elektra' });
  });
});
