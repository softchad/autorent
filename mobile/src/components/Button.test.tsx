import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { MIN_TOUCH_SIZE } from '@/theme';
import { Button } from './Button';

describe('Button', () => {
  it('turi mygtuko rolę ir pavadinimą ekrano skaitytuvui', async () => {
    await render(
      <Button label="Rezervuoti" onPress={() => {}} />,
    );

    expect(
      screen.getByRole('button', { name: 'Rezervuoti' }),
    ).toBeTruthy();
  });

  it('paspaudus iškviečia onPress', async () => {
    const onPress = jest.fn();

    await render(<Button label="Tęsti" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('krovimo metu neleidžia paspausti antrą kartą', async () => {
    const onPress = jest.fn();

    await render(
      <Button label="Patvirtinti" onPress={onPress} loading />,
    );

    const button = screen.getByRole('button');
    await fireEvent.press(button);

    expect(onPress).not.toHaveBeenCalled();
    expect(button.props.accessibilityState).toEqual({
      disabled: true,
      busy: true,
    });
  });

  it('išjungtas mygtukas nereaguoja', async () => {
    const onPress = jest.fn();

    await render(
      <Button label="Tęsti" onPress={onPress} disabled />,
    );
    await fireEvent.press(screen.getByRole('button'));

    expect(onPress).not.toHaveBeenCalled();
  });

  it('lietimo plotas ne mažesnis nei 44', async () => {
    await render(
      <Button
        label="Tęsti"
        onPress={() => {}}
        testID="mygtukas"
      />,
    );

    const style = StyleSheet.flatten(
      screen.getByTestId('mygtukas').props.style,
    );

    expect(style.minHeight).toBeGreaterThanOrEqual(
      MIN_TOUCH_SIZE,
    );
  });
});