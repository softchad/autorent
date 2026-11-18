import { fireEvent, render, screen } from '@testing-library/react-native';
import { Text } from 'react-native';
import { useAuth } from './AuthContext';
import { RequireAuth } from './RequireAuth';

jest.mock('./AuthContext');

function mockStatus(status: 'loading' | 'signedOut' | 'signedIn', notice: string | null = null) {
  jest.mocked(useAuth).mockReturnValue({ status, notice } as unknown as ReturnType<typeof useAuth>);
}

const secret = <Text>Mano rezervacijos</Text>;

describe('RequireAuth', () => {
  it('prisijungusiam rodo turinį', async () => {
    mockStatus('signedIn');
    await render(<RequireAuth onLogin={jest.fn()} onRegister={jest.fn()}>{secret}</RequireAuth>);
    expect(screen.getByText('Mano rezervacijos')).toBeTruthy();
  });

  it('neprisijungusiam turinio nerodo ir siūlo prisijungti', async () => {
    mockStatus('signedOut');
    const onLogin = jest.fn();
    await render(<RequireAuth onLogin={onLogin} onRegister={jest.fn()}>{secret}</RequireAuth>);
    expect(screen.queryByText('Mano rezervacijos')).toBeNull();
    await fireEvent.press(screen.getByRole('button', { name: 'Prisijungti' }));
    expect(onLogin).toHaveBeenCalledTimes(1);
  });

  it('kol sesija atkuriama, rodo krovimą, o ne prisijungimo kvietimą', async () => {
    mockStatus('loading');
    await render(<RequireAuth onLogin={jest.fn()} onRegister={jest.fn()}>{secret}</RequireAuth>);
    expect(screen.getByTestId('loading-view')).toBeTruthy();
    expect(screen.queryByTestId('require-auth')).toBeNull();
  });

  it('rodo priežastį, kodėl sesija nutrūko', async () => {
    mockStatus('signedOut', 'Sesija baigėsi. Prisijunkite iš naujo.');
    await render(<RequireAuth onLogin={jest.fn()} onRegister={jest.fn()}>{secret}</RequireAuth>);
    expect(screen.getByText('Sesija baigėsi. Prisijunkite iš naujo.')).toBeTruthy();
  });
});
