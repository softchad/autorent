import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, Text } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { ExpandableSheet, resolveSnap } from './ExpandableSheet';
import { FloatingCarSummary } from './FloatingCarSummary';
import { gridLineCount } from './GridBackground';
import { ReservationBar } from './ReservationBar';
import { Screen } from './Screen';
import { SearchPanel } from './SearchPanel';
import { VehicleCard } from './VehicleCard';

describe('SearchPanel', () => {
  function renderPanel(overrides = {}) {
    const handlers = { onPressLocation: jest.fn(), onPressDates: jest.fn(), onSearch: jest.fn() };
    return {
      handlers,
      view: render(
        <SearchPanel
          locationLabel="Paėmimo vieta"
          locationValue="Vilnius Centras"
          fromLabel="Nuo"
          fromValue="31 Spa"
          toLabel="Iki"
          toValue="4 Lap"
          searchLabel="Ieškoti"
          {...handlers}
          {...overrides}
        />,
      ),
    };
  }

  it('kiekvienas laukas ekrano skaitytuvui perskaitomas kartu su reikšme', async () => {
    await renderPanel().view;
    expect(screen.getByRole('button', { name: 'Paėmimo vieta: Vilnius Centras' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Nuo: 31 Spa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Iki: 4 Lap' })).toBeTruthy();
  });

  it('laukai atidaro pasirinkimą, o mygtukas pradeda paiešką', async () => {
    const { handlers, view } = renderPanel();
    await view;
    await fireEvent.press(screen.getByTestId('search-location'));
    await fireEvent.press(screen.getByTestId('search-from'));
    await fireEvent.press(screen.getByTestId('search-to'));
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(handlers.onPressLocation).toHaveBeenCalledTimes(1);
    expect(handlers.onPressDates).toHaveBeenCalledTimes(2);
    expect(handlers.onSearch).toHaveBeenCalledTimes(1);
  });

  it('kol ieškoma, antrą kartą paspausti negalima', async () => {
    const { handlers, view } = renderPanel({ searching: true });
    await view;
    await fireEvent.press(screen.getByTestId('search-submit'));
    expect(handlers.onSearch).not.toHaveBeenCalled();
  });

  it('laukų lietimo plotas ne mažesnis nei 44', async () => {
    await renderPanel().view;
    const style = StyleSheet.flatten(screen.getByTestId('search-location').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
  });
});

describe('VehicleCard', () => {
  it('visa kortelė yra vienas mygtukas su pilnu aprašu', async () => {
    const onPress = jest.fn();
    await render(
      <VehicleCard
        title="BMW X5"
        subtitle="2023 · Visureigis"
        price="89,00 €"
        priceUnit="/ diena"
        image={getCarPhoto('BMW')}
        onPress={onPress}
        accessibilityLabel="BMW X5, 2023. 89,00 € / diena"
        testID="kortele"
      />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'BMW X5, 2023. 89,00 € / diena' }));
    expect(onPress).toHaveBeenCalledTimes(1);
    expect(screen.getByText('BMW X5')).toBeTruthy();
    expect(screen.getByText('/ diena')).toBeTruthy();
  });
});

describe('FloatingCarSummary', () => {
  it('perskaitoma vienu sakiniu', async () => {
    await render(<FloatingCarSummary title="Tesla Model 3" subtitle="Kaunas" price="75,00 €" priceUnit="/ diena" image={getCarPhoto('Tesla')} />);
    expect(screen.getByLabelText('Tesla Model 3. Kaunas. 75,00 € / diena')).toBeTruthy();
  });
});

describe('ReservationBar', () => {
  it('paspaudus pradedamas rezervavimas', async () => {
    const onPress = jest.fn();
    await render(<ReservationBar label="Rezervuoti dabar" price="45,00 €" priceUnit="/ diena" onPress={onPress} testID="juosta" />);
    await fireEvent.press(screen.getByRole('button', { name: 'Rezervuoti dabar. 45,00 € / diena' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('išjungta juosta nereaguoja ir tai pasako ekrano skaitytuvui', async () => {
    const onPress = jest.fn();
    await render(<ReservationBar label="Rezervuoti dabar" price="45,00 €" priceUnit="/ diena" onPress={onPress} disabled testID="juosta" />);
    await fireEvent.press(screen.getByTestId('juosta'));
    expect(onPress).not.toHaveBeenCalled();
    expect(screen.getByTestId('juosta').props.accessibilityState).toEqual({ disabled: true });
  });
});

describe('resolveSnap', () => {
  it('patempus aukštyn lapas išsiskleidžia, žemyn – susiskleidžia', () => {
    expect(resolveSnap(false, -80, 0)).toBe(true);
    expect(resolveSnap(true, 80, 0)).toBe(false);
  });

  it('greitas brūkštelėjimas veikia ir trumpu atstumu', () => {
    expect(resolveSnap(false, -10, -1)).toBe(true);
    expect(resolveSnap(true, 10, 1)).toBe(false);
  });

  it('per mažas judesys padėties nekeičia', () => {
    expect(resolveSnap(false, -20, -0.1)).toBe(false);
    expect(resolveSnap(true, 20, 0.1)).toBe(true);
  });
});

describe('ExpandableSheet', () => {
  function renderSheet() {
    return render(
      <ExpandableSheet
        header={<Text>Antraštė</Text>}
        collapsedHeight={100}
        expandedHeight={400}
        expandLabel="Išskleisti"
        collapseLabel="Suskleisti"
        testID="lapas"
      >
        <Text>Turinys</Text>
      </ExpandableSheet>,
    );
  }

  it('rankenėlės paspaudimas pakeičia tempimą: lapas išsiskleidžia ir susiskleidžia', async () => {
    await renderSheet();
    const handle = screen.getByTestId('lapas-handle');
    expect(handle.props.accessibilityState).toEqual({ expanded: false });
    await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti' }));
    expect(screen.getByTestId('lapas-handle').props.accessibilityState).toEqual({ expanded: true });
    await fireEvent.press(screen.getByRole('button', { name: 'Suskleisti' }));
    expect(screen.getByTestId('lapas-handle').props.accessibilityState).toEqual({ expanded: false });
  });

  it('rankenėlės lietimo plotas ne mažesnis nei 44', async () => {
    await renderSheet();
    const style = StyleSheet.flatten(screen.getByTestId('lapas-handle').props.style);
    expect(style.minHeight).toBeGreaterThanOrEqual(MIN_TOUCH_SIZE);
  });
});

describe('gridLineCount', () => {
  it('uždengia visą ilgį ir neskaičiuoja neigiamų dydžių', () => {
    expect(gridLineCount(360)).toBe(10);
    expect(gridLineCount(361)).toBe(11);
    expect(gridLineCount(0)).toBe(0);
    expect(gridLineCount(-5)).toBe(0);
  });
});

describe('Screen', () => {
  it('tinklelis rodomas tik paprašius ir yra paslėptas nuo ekrano skaitytuvo', async () => {
    await render(
      <Screen grid>
        <Text>Turinys</Text>
      </Screen>,
    );
    const grid = screen.getByTestId('grid-background', { includeHiddenElements: true });
    expect(grid.props.importantForAccessibility).toBe('no-hide-descendants');
  });
});