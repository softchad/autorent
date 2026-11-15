import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { TextField } from './TextField';

describe('TextField', () => {
  it('laukas randamas pagal etiketę', async () => {
    await render(
      <TextField
        label="El. paštas"
        value=""
        onChangeText={() => {}}
      />,
    );

    expect(
      screen.getByLabelText('El. paštas'),
    ).toBeTruthy();
  });

  it('perduoda įvestą tekstą', async () => {
    const onChangeText = jest.fn();

    await render(
      <TextField
        label="El. paštas"
        value=""
        onChangeText={onChangeText}
      />,
    );

    await fireEvent.changeText(
      screen.getByLabelText('El. paštas'),
      'jonas@example.com',
    );

    expect(onChangeText).toHaveBeenCalledWith(
      'jonas@example.com',
    );
  });

  it('rodo klaidą kaip pranešimą ekrano skaitytuvui', async () => {
    await render(
      <TextField
        label="Slaptažodis"
        value=""
        onChangeText={() => {}}
        error="Įveskite slaptažodį"
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Įveskite slaptažodį',
    );

    expect(
      screen.getByLabelText('Slaptažodis').props.accessibilityHint,
    ).toBe('Įveskite slaptažodį');
  });

  it('be klaidos rodo paaiškinimą', async () => {
    await render(
      <TextField
        label="Telefonas"
        value=""
        onChangeText={() => {}}
        hint="Pvz. +37061234567"
      />,
    );

    expect(
      screen.getByText('Pvz. +37061234567'),
    ).toBeTruthy();

    expect(screen.queryByRole('alert')).toBeNull();
  });
});