import { render, screen } from '@testing-library/react-native';
import { Animated } from 'react-native';
import { CountdownRing, ringLabel } from './CountdownRing';

const TOTAL = 600_000;

// Sumažinto judesio nustatymas imituojamas; numatyta – įjungtas (kaip kol nustatymas dar nenuskaitytas).
let mockReduced = true;
jest.mock('@/hooks/useReducedMotion', () => ({ useReducedMotion: () => mockReduced }));

beforeEach(() => {
  mockReduced = true;
});

afterEach(() => {
  jest.restoreAllMocks();
});

// Animacija pakeičiama valdomu objektu, kad būtų matyti, kiek animacijų sustabdyta.
function stoppableTiming() {
  const stops: jest.Mock[] = [];
  const timing = jest.spyOn(Animated, 'timing').mockImplementation(() => {
    const stop = jest.fn();
    stops.push(stop);
    return { start: jest.fn(), stop, reset: jest.fn() };
  });
  return { timing, stops };
}

describe('ringLabel', () => {
  it.each([
    [600_000, 'Liko 10 min. 0 sek.'],
    [570_000, 'Liko 9 min. 30 sek.'],
    [1, 'Liko 0 min. 1 sek.'],
    [0, 'Laikas baigėsi'],
  ])('%i ms → %s', (remaining, expected) => {
    expect(ringLabel(remaining)).toBe(expected);
  });
});

describe('CountdownRing', () => {
  it('rodo likusį laiką skaičiais ir kaip laikmatį ekrano skaitytuvui', async () => {
    await render(<CountdownRing remainingMs={570_000} totalMs={TOTAL} />);
    expect(screen.getByTestId('countdown-text')).toHaveTextContent('09:30');
    const ring = screen.getByTestId('countdown-ring');
    expect(ring.props.accessibilityRole).toBe('timer');
    expect(ring.props.accessibilityLabel).toBe('Liko 9 min. 30 sek.');
  });

  it('pasibaigus rodo 00:00 ir paaiškinimą', async () => {
    await render(<CountdownRing remainingMs={0} totalMs={TOTAL} />);
    expect(screen.getByTestId('countdown-text')).toHaveTextContent('00:00');
    expect(screen.getByText('Laikas baigėsi')).toBeTruthy();
  });

  it('atnaujinus reikšmę tekstas pasikeičia', async () => {
    const { rerender } = await render(<CountdownRing remainingMs={61_000} totalMs={TOTAL} />);
    expect(screen.getByTestId('countdown-text')).toHaveTextContent('01:01');
    await rerender(<CountdownRing remainingMs={59_500} totalMs={TOTAL} />);
    expect(screen.getByTestId('countdown-text')).toHaveTextContent('01:00');
  });
});

describe('CountdownRing – judesys', () => {
  it('sumažinto judesio režimu animacija nepaleidžiama', async () => {
    const timing = jest.spyOn(Animated, 'timing');
    const view = await render(<CountdownRing remainingMs={570_000} totalMs={TOTAL} />);
    await view.rerender(<CountdownRing remainingMs={300_000} totalMs={TOTAL} />);
    expect(timing).not.toHaveBeenCalled();
  });

  it('pasikeitus likusiam laikui ankstesnė animacija sustabdoma', async () => {
    mockReduced = false;
    const { timing, stops } = stoppableTiming();
    const view = await render(<CountdownRing remainingMs={570_000} totalMs={TOTAL} />);
    expect(timing).toHaveBeenCalledTimes(1);

    await view.rerender(<CountdownRing remainingMs={300_000} totalMs={TOTAL} />);

    expect(timing).toHaveBeenCalledTimes(2);
    expect(timing).toHaveBeenLastCalledWith(expect.anything(), expect.objectContaining({ toValue: 0.5 }));
    expect(stops[0]).toHaveBeenCalled();
    expect(stops[1]).not.toHaveBeenCalled();
  });

  it('išmontavus animacija sustabdoma', async () => {
    mockReduced = false;
    const { stops } = stoppableTiming();
    const view = await render(<CountdownRing remainingMs={570_000} totalMs={TOTAL} />);
    expect(stops[0]).not.toHaveBeenCalled();
    await view.unmount();
    expect(stops[0]).toHaveBeenCalled();
  });

  it('įjungus sumažintą judesį animacija sustabdoma, o progresas nustatomas iškart', async () => {
    mockReduced = false;
    const { timing, stops } = stoppableTiming();
    const setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
    const view = await render(<CountdownRing remainingMs={300_000} totalMs={TOTAL} />);

    mockReduced = true;
    await view.rerender(<CountdownRing remainingMs={300_000} totalMs={TOTAL} />);

    expect(stops[0]).toHaveBeenCalled();
    expect(timing).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenLastCalledWith(0.5);
  });
});
