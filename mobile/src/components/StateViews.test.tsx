import {
  fireEvent,
  render,
  screen,
} from '@testing-library/react-native';
import { EmptyView, ErrorView, LoadingView } from './StateViews';

// Prieinamumo testai tikrina savybes, kurias gauna ekrano skaitytuvas Jest aplinkoje.
// Tikras VoiceOver / TalkBack veikimas telefone dar nepatikrintas.

describe('LoadingView', () => {
  it('praneša ekrano skaitytuvui, kad kraunama', async () => {
    await render(<LoadingView />);

    expect(
      screen.getByLabelText('Kraunama…'),
    ).toBeTruthy();
  });

  it('yra vienas prieinamumo elementas su krovimo žinute', async () => {
    await render(<LoadingView message="Kraunami automobiliai" />);

    const view = screen.getByRole('progressbar', {
      name: 'Kraunami automobiliai',
    });

    expect(view.props.accessible).toBe(true);
    expect(screen.getByText('Kraunami automobiliai')).toBeTruthy();
  });
});

describe('ErrorView', () => {
  it('rodo klaidą ir leidžia pakartoti', async () => {
    const onRetry = jest.fn();

    await render(
      <ErrorView
        message="Nepavyko prisijungti prie serverio."
        onRetry={onRetry}
      />,
    );

    expect(screen.getByRole('alert')).toHaveTextContent(
      'Nepavyko prisijungti prie serverio.',
    );

    await fireEvent.press(
      screen.getByRole('button', {
        name: 'Bandyti dar kartą',
      }),
    );

    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  it('be onRetry mygtuko nerodo', async () => {
    await render(<ErrorView message="Klaida" />);

    expect(screen.queryByRole('button')).toBeNull();
  });

  it('klaida paskelbiama be fokuso perkėlimo', async () => {
    await render(<ErrorView message="Klaida" />);

    expect(
      screen.getByRole('alert').props.accessibilityLiveRegion,
    ).toBe('polite');
  });

  it('dekoratyvi piktograma paslėpta, o tekstas ir mygtukas prieinami', async () => {
    await render(
      <ErrorView message="Klaida" onRetry={() => {}} />,
    );

    // Numatytos užklausos paslėptų elementų nemato, todėl tai, kas randama, yra prieinama.
    expect(screen.queryByTestId('state-icon')).toBeNull();
    expect(screen.getByTestId('state-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByRole('alert')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Bandyti dar kartą' })).toBeTruthy();
  });
});

describe('EmptyView', () => {
  it('rodo pavadinimą, paaiškinimą ir veiksmą', async () => {
    const onAction = jest.fn();

    await render(
      <EmptyView
        title="Rezervacijų dar nėra"
        message="Išsirinkite automobilį."
        actionLabel="Ieškoti"
        onAction={onAction}
      />,
    );

    expect(
      screen.getByText('Rezervacijų dar nėra'),
    ).toBeTruthy();

    expect(
      screen.getByText('Išsirinkite automobilį.'),
    ).toBeTruthy();

    await fireEvent.press(
      screen.getByRole('button', { name: 'Ieškoti' }),
    );

    expect(onAction).toHaveBeenCalledTimes(1);
  });

  it('veiksmo mygtuko nerodo, jei trūksta pavadinimo arba veiksmo', async () => {
    const { rerender } = await render(
      <EmptyView title="Nieko nerasta" actionLabel="Ieškoti" />,
    );
    expect(screen.queryByRole('button')).toBeNull();

    await rerender(
      <EmptyView title="Nieko nerasta" onAction={() => {}} />,
    );
    expect(screen.queryByRole('button')).toBeNull();
  });

  it('dekoratyvi piktograma paslėpta, o tekstas ir mygtukas prieinami', async () => {
    await render(
      <EmptyView
        title="Rezervacijų dar nėra"
        message="Išsirinkite automobilį."
        actionLabel="Ieškoti"
        onAction={() => {}}
      />,
    );

    expect(screen.queryByTestId('state-icon')).toBeNull();
    expect(screen.getByTestId('state-icon', { includeHiddenElements: true })).toBeTruthy();
    expect(screen.getByText('Rezervacijų dar nėra')).toBeTruthy();
    expect(screen.getByText('Išsirinkite automobilį.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Ieškoti' })).toBeTruthy();
  });
});
