import { fireEvent, render, screen } from '@testing-library/react-native';
import { StyleSheet, TextStyle, ViewStyle } from 'react-native';
import { contrastRatio } from '@/theme/contrast';
import { BRAND_LOGO_PATHS } from './brandLogos';
import { Chip } from './Chip';
import { ManufacturerBelt } from './ManufacturerBelt';

describe('ManufacturerBelt', () => {
  const brands = ['Audi', 'Škoda', 'Lada'];

  it('rodo „Visi“ ir visas perduotas markes', async () => {
    await render(<ManufacturerBelt brands={brands} selected={null} onSelect={() => {}} allLabel="Visi" />);
    expect(screen.getByRole('button', { name: 'Visi' }).props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByRole('button', { name: 'Audi' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Škoda' })).toBeTruthy();
  });

  it('paspaudus markę ji pasirenkama, paspaudus dar kartą – atžymima', async () => {
    const onSelect = jest.fn();
    const view = await render(<ManufacturerBelt brands={brands} selected={null} onSelect={onSelect} allLabel="Visi" />);
    await fireEvent.press(screen.getByTestId('brand-audi'));
    expect(onSelect).toHaveBeenLastCalledWith('Audi');

    await view.rerender(<ManufacturerBelt brands={brands} selected="Audi" onSelect={onSelect} allLabel="Visi" />);
    expect(screen.getByTestId('brand-audi').props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(screen.getByTestId('brand-audi'));
    expect(onSelect).toHaveBeenLastCalledWith(null);
  });

  it('„Visi“ išjungia markės filtrą', async () => {
    const onSelect = jest.fn();
    await render(<ManufacturerBelt brands={brands} selected="Audi" onSelect={onSelect} allLabel="Visi" />);
    await fireEvent.press(screen.getByTestId('brand-all'));
    expect(onSelect).toHaveBeenCalledWith(null);
  });

  it('markė be ženklo rodoma tik visu pavadinimu, be logotipo, inicialų ir tuščio apskritimo', async () => {
    await render(<ManufacturerBelt brands={brands} selected={null} onSelect={() => {}} allLabel="Visi" />);
    expect(BRAND_LOGO_PATHS.lada).toBeUndefined();

    // Be ženklo mygtuke lieka vienintelis vaikas – pavadinimas; su ženklu pirma eina logotipo dalis.
    const unknown = screen.getByTestId('brand-lada');
    expect(unknown.children).toHaveLength(1);
    expect(screen.getByText('Lada')).toBeTruthy();
    expect(screen.queryByText('LA')).toBeNull();
    expect(screen.queryByText('L')).toBeNull();
    expect(screen.getByTestId('brand-audi').children).toHaveLength(2);
  });

  it('pasirinkimą galima pakeisti iš vienos markės į kitą', async () => {
    const onSelect = jest.fn();
    const view = await render(<ManufacturerBelt brands={brands} selected="Audi" onSelect={onSelect} allLabel="Visi" />);

    await fireEvent.press(screen.getByTestId('brand-skoda'));
    // Tai nauja markė, o ne atžymėjimas: filtras nepaverčiamas į „Visi“.
    expect(onSelect).toHaveBeenLastCalledWith('Škoda');
    expect(onSelect).toHaveBeenCalledTimes(1);

    await view.rerender(<ManufacturerBelt brands={brands} selected="Škoda" onSelect={onSelect} allLabel="Visi" />);
    expect(screen.getByTestId('brand-skoda').props.accessibilityState).toEqual({ selected: true });
    expect(screen.getByTestId('brand-audi').props.accessibilityState).toEqual({ selected: false });
    expect(screen.getByTestId('brand-all').props.accessibilityState).toEqual({ selected: false });
  });

  it.each([
    ['pasirinkta markė', 'Audi', 'brand-audi', 'Audi'],
    ['pasirinkta „Visi“', null, 'brand-all', 'Visi'],
  ])('%s: etiketė ir fonas turi bent 4,5:1 kontrastą', async (_name, selected, testID, text) => {
    await render(<ManufacturerBelt brands={brands} selected={selected} onSelect={() => {}} allLabel="Visi" />);

    // Imame tikrai atvaizduotus stilius, o ne paletės reikšmes, kad kontrasto nepakeistų kita spalva.
    const item = StyleSheet.flatten(screen.getByTestId(testID).props.style) as ViewStyle;
    const label = StyleSheet.flatten(screen.getByText(text).props.style) as TextStyle;

    expect(contrastRatio(String(label.color), String(item.backgroundColor))).toBeGreaterThanOrEqual(4.5);
  });

  it('„Škoda“ su diakritiniu ženklu randa savo ženklą', () => {
    expect(BRAND_LOGO_PATHS.skoda).toBeDefined();
  });
});

describe('Chip', () => {
  it('pasirinkimą praneša ekrano skaitytuvui ir reaguoja į paspaudimą', async () => {
    const onPress = jest.fn();
    await render(<Chip label="Pigiausi" selected onPress={onPress} />);
    const chip = screen.getByRole('button', { name: 'Pigiausi' });
    expect(chip.props.accessibilityState).toEqual({ selected: true });
    await fireEvent.press(chip);
    expect(onPress).toHaveBeenCalledTimes(1);
  });
});