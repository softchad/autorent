import { render, screen } from '@testing-library/react-native';
import { StyleSheet } from 'react-native';
import { colors } from '@/theme';
import { Badge } from './Badge';

describe('Badge', () => {
  it('rodo būsenos tekstą', async () => {
    await render(<Badge label="Patvirtinta" tone="success" />);
    expect(screen.getByText('Patvirtinta')).toBeTruthy();
  });

  it('tonas nustato teksto ir fono spalvas', async () => {
    await render(<Badge label="Atšaukta" tone="danger" testID="zenklelis" />);
    const badgeStyle = StyleSheet.flatten(screen.getByTestId('zenklelis').props.style);
    const textStyle = StyleSheet.flatten(screen.getByText('Atšaukta').props.style);
    expect(badgeStyle.backgroundColor).toBe(colors.dangerSoft);
    expect(textStyle.color).toBe(colors.danger);
  });

  it('be tono naudoja neutralų', async () => {
    await render(<Badge label="Laukia" testID="zenklelis" />);
    const badgeStyle = StyleSheet.flatten(screen.getByTestId('zenklelis').props.style);
    expect(badgeStyle.backgroundColor).toBe(colors.neutralSoft);
  });
});