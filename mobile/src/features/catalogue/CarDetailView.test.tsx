import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { makeCar } from '@/testUtils/fixtures';
import { MIN_TOUCH_SIZE } from '@/theme';
import { CarDetailView, isBookable, notBookableText, periodBadge, specRows } from './CarDetailView';

// Sumažinto judesio nustatymas imituojamas; numatyta – įjungtas (kaip kol nustatymas dar nenuskaitytas).
let mockReduced = true;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

beforeEach(() => {
  mockReduced = true;
});

describe('specRows', () => {
  it('sudaro techninių duomenų eilutes', () => {
    const rows = Object.fromEntries(specRows(makeCar()));
    expect(rows).toMatchObject({
      Metai: '2022',
      'Pavarų dėžė': 'automatinė',
      Variklis: '1.8 l',
      Galia: '103 kW',
      'Klimato kontrolė': 'Taip',
    });
  });

  it('elektromobiliui variklio tūrio nerodo', () => {
    const rows = Object.fromEntries(specRows(makeCar({ kuro_tipas: 'elektra', variklio_turis: 0 })));
    expect(rows).not.toHaveProperty('Variklis');
  });
});

describe('isBookable', () => {
  it.each([
    ['laisvas', true],
    ['isnuomotas', true],
    ['servise', false],
    ['remonte', false],
  ])('statusas %s → %s', (automobilio_statusas, expected) => {
    expect(isBookable(makeCar({ automobilio_statusas }))).toBe(expected);
  });

  it('perspėjimo tekstas tik serviso ir remonto būsenoms', () => {
    expect(notBookableText(makeCar({ automobilio_statusas: 'laisvas' }))).toBeNull();
    expect(notBookableText(makeCar({ automobilio_statusas: 'isnuomotas' }))).toBeNull();
    expect(notBookableText(makeCar({ automobilio_statusas: 'servise' }))).toMatch(/servise/);
    expect(notBookableText(makeCar({ automobilio_statusas: 'remonte' }))).toMatch(/remontuojamas/);
  });
});

// Išsami informacija yra ištraukiamame lape; ji pasiekiama išskleidus lapą rankenėlės mygtuku.
async function expandSheet() {
  await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti automobilio informaciją' }));
}

describe('CarDetailView', () => {
  it('suskleistame lape matomas automobilio pavadinimas ir pagrindiniai duomenys', async () => {
    await render(<CarDetailView car={makeCar()} />);
    expect(screen.getByRole('header', { name: 'Toyota Corolla' })).toBeTruthy();
    expect(screen.getByText('2022 · automatinė · hibridas')).toBeTruthy();
  });

  it('kol lapas suskleistas, jo turinys ekrano skaitytuvui paslėptas', async () => {
    await render(<CarDetailView car={makeCar()} />);
    expect(screen.queryByText('Vilnius Centras')).toBeNull();
    expect(screen.getByText('Vilnius Centras', { includeHiddenElements: true })).toBeTruthy();
  });

  it('išskleidus rodo techninius duomenis ir paėmimo vietą', async () => {
    await render(<CarDetailView car={makeCar()} />);
    await expandSheet();
    expect(screen.getByText('Vilnius Centras')).toBeTruthy();
    expect(screen.getByText('Gedimino pr. 1, Vilnius')).toBeTruthy();
    expect(screen.getByLabelText('Kuras: hibridas')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Suskleisti automobilio informaciją' })).toBeTruthy();
  });

  it.each([
    ['servise', 'Šis automobilis šiuo metu servise, todėl jo išsinuomoti negalima.'],
    ['remonte', 'Šis automobilis šiuo metu remontuojamas, todėl jo išsinuomoti negalima.'],
  ])('statusas %s: tikslus perspėjimas matomas suskleistame lape ir rezervuoti neleidžiama', async (automobilio_statusas, text) => {
    await render(<CarDetailView car={makeCar({ automobilio_statusas })} onReserve={jest.fn()} />);
    // Neišskleidus: perspėjimas pasiekiamas ir ekrano skaitytuvui (nėra paslėptame turinyje).
    expect(screen.getByRole('alert')).toHaveTextContent(text);
    expect(screen.getByRole('button', { name: 'Išskleisti automobilio informaciją' })).toBeTruthy();
    expect(screen.queryByTestId('choose-dates')).toBeNull();
  });

  it('suskleistas lapas išauga, kad perspėjimas tilptų ir nebūtų nukirptas', async () => {
    await render(<CarDetailView car={makeCar({ automobilio_statusas: 'remonte' })} />);
    // Didelis šriftas: perspėjimas užima kelias eilutes, antraštė aukštesnė už numatytą lapą.
    await fireEvent(screen.getByTestId('car-sheet-header'), 'layout', { nativeEvent: { layout: { height: 200 } } });

    const sheet = StyleSheet.flatten(screen.getByTestId('car-sheet').props.style);
    const translateY = (sheet.transform as { translateY: number }[])[0].translateY;
    const visible = (sheet.height as number) - translateY;
    // Rėmelis + rankenėlė (MIN_TOUCH_SIZE) + išmatuota antraštė.
    expect(visible).toBeGreaterThanOrEqual(1 + MIN_TOUCH_SIZE + 200);
  });

  it('be lokacijos paėmimo vietos kortelė nerodoma, o kiti duomenys lieka', async () => {
    await render(<CarDetailView car={makeCar({ lokacija: null })} />);
    await expandSheet();
    expect(screen.queryByTestId('car-pickup')).toBeNull();
    expect(screen.queryByText('Paėmimo vieta')).toBeNull();
    expect(screen.getByTestId('car-specs')).toBeTruthy();
  });

  it('rezervavimo juosta rodo kainą ir pradeda rezervavimą', async () => {
    const onReserve = jest.fn();
    await render(<CarDetailView car={makeCar()} onReserve={onReserve} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rezervuoti dabar. 45,00 € / diena' }));
    expect(onReserve).toHaveBeenCalledTimes(1);
  });

  it('„Atgal“ mygtukas rodomas tik kai ekranas jį perduoda', async () => {
    const onBack = jest.fn();
    const view = await render(<CarDetailView car={makeCar()} />);
    expect(screen.queryByTestId('car-back')).toBeNull();
    await view.rerender(<CarDetailView car={makeCar()} onBack={onBack} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Atgal' }));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('be perduoto fono rodo automobilio nuotrauką, o perduotas fonas (žemėlapis) ją pakeičia', async () => {
    const view = await render(<CarDetailView car={makeCar()} />);
    expect(screen.getByTestId('car-photo-backdrop')).toBeTruthy();
    await view.rerender(<CarDetailView car={makeCar()} backdrop={<Text>Žemėlapis</Text>} />);
    expect(screen.queryByTestId('car-photo-backdrop')).toBeNull();
    expect(screen.getByText('Žemėlapis')).toBeTruthy();
  });

  it('papildomas turinys po paėmimo adresu ir lapo apačioje įterpiamas iš ekrano', async () => {
    await render(
      <CarDetailView car={makeCar()} pickupExtras={<Text>Maršruto mygtukai</Text>}>
        <Text>Draudimo sąlygos</Text>
      </CarDetailView>,
    );
    await expandSheet();
    expect(screen.getByText('Maršruto mygtukai')).toBeTruthy();
    expect(screen.getByText('Draudimo sąlygos')).toBeTruthy();
  });
});

describe('periodBadge', () => {
  it('ženklelis rodomas tik kai serveris pasakė, ar automobilis laisvas', async () => {
    expect(periodBadge(makeCar())).toBeNull();
    await render(<>{periodBadge(makeCar({ laisvas_pasirinktu_laikotarpiu: false }))}</>);
    expect(screen.getByText('Užimtas pasirinktomis dienomis')).toBeTruthy();
  });

  it('laisvas pasirinktu laikotarpiu: ženklelis matomas suskleistame lape', async () => {
    const car = makeCar({ laisvas_pasirinktu_laikotarpiu: true });
    await render(<CarDetailView car={car} statusBadge={periodBadge(car)} />);
    expect(screen.getByTestId('car-period-free')).toHaveTextContent('Laisvas pasirinktomis dienomis');
    expect(screen.getByText('Laisvas pasirinktomis dienomis')).toBeTruthy();
  });
});

describe('CarDetailView – antraštė ir kaina', () => {
  it('pavadinimas ir kaina nesikartoja', async () => {
    await render(<CarDetailView car={makeCar()} onReserve={jest.fn()} />);
    expect(screen.getAllByText('Toyota Corolla')).toHaveLength(1);
    expect(screen.getAllByText('45,00 €')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Rezervuoti dabar. 45,00 € / diena' })).toBeTruthy();
  });

  it('pakeitus automobilį antraštė ir rezervavimo kaina atnaujinamos kartu', async () => {
    const view = await render(<CarDetailView car={makeCar()} onReserve={jest.fn()} />);
    await view.rerender(<CarDetailView car={makeCar({ automobilio_id: 2, marke: 'Honda', modelis: 'Civic', kaina_parai: 30 })} onReserve={jest.fn()} />);
    expect(screen.queryByText('Toyota Corolla')).toBeNull();
    expect(screen.queryByText('45,00 €')).toBeNull();
    expect(screen.getAllByText('Honda Civic')).toHaveLength(1);
    expect(screen.getAllByText('30,00 €')).toHaveLength(1);
  });
});
