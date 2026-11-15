import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, StyleSheet, ViewStyle } from 'react-native';
import { CardListSkeleton, Skeleton } from './Skeleton';

// Tikrinamas elgesys (kada pulsavimas prasideda, sustoja ir kaip reaguoja į nustatymą).
// Tai nėra tikro telefono, VoiceOver ar TalkBack bandymas.

type Listener = (value: boolean) => void;

const isEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const addListener = AccessibilityInfo.addEventListener as jest.Mock;

let listeners: Listener[];
let started: { start: jest.SpyInstance; stop: jest.SpyInstance }[];
let loop: jest.SpyInstance;
let setValue: jest.SpyInstance;

// Visi Skeleton blokai klauso to paties nustatymo, todėl įvykį siunčiame visiems.
const emitReduced = (value: boolean) => act(async () => listeners.forEach((listener) => listener(value)));
const flush = () => act(async () => {});
const propsOf = (node: unknown) => (node as { props: Record<string, unknown> }).props;

beforeEach(() => {
  listeners = [];
  started = [];

  isEnabled.mockReset().mockResolvedValue(false);
  addListener.mockReset().mockImplementation((_name: string, handler: Listener) => {
    listeners.push(handler);
    return { remove: jest.fn() };
  });

  const realLoop = Animated.loop.bind(Animated);
  loop = jest.spyOn(Animated, 'loop').mockImplementation((animation, config) => {
    const real = realLoop(animation, config);
    started.push({ start: jest.spyOn(real, 'start'), stop: jest.spyOn(real, 'stop') });
    return real;
  });
  setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Skeleton pulsavimas', () => {
  it('kol nustatymas nenuskaitytas, nepulsuoja', async () => {
    isEnabled.mockReturnValue(new Promise<boolean>(() => {}));
    await render(<Skeleton height={20} />);

    expect(loop).not.toHaveBeenCalled();
  });

  it('nuskaičius, kad judesys nesumažintas, pradeda pulsuoti', async () => {
    await render(<Skeleton height={20} />);
    await flush();

    expect(loop).toHaveBeenCalledTimes(1);
    expect(started[0].start).toHaveBeenCalledTimes(1);
    expect(started[0].stop).not.toHaveBeenCalled();
  });

  it('jei judesys sumažintas jau nuo pradžių, niekada nepulsuoja', async () => {
    isEnabled.mockResolvedValue(true);
    await render(<Skeleton height={20} />);
    await flush();

    expect(loop).not.toHaveBeenCalled();
  });

  it('išmontuojant pulsavimas sustabdomas', async () => {
    const { unmount } = await render(<Skeleton height={20} />);
    await flush();
    expect(started[0].stop).not.toHaveBeenCalled();

    await unmount();

    expect(started[0].stop).toHaveBeenCalledTimes(1);
  });

  it('įjungus „mažinti judesį“, pulsavimas sustoja ir blokas grįžta į ramią būseną', async () => {
    await render(<Skeleton height={20} />);
    await flush();
    setValue.mockClear();

    await emitReduced(true);

    expect(started[0].stop).toHaveBeenCalledTimes(1);
    expect(setValue).toHaveBeenLastCalledWith(0.55);
  });

  it('vėl išjungus „mažinti judesį“, pulsavimas prasideda iš naujo', async () => {
    await render(<Skeleton height={20} />);
    await flush();
    await emitReduced(true);
    expect(loop).toHaveBeenCalledTimes(1);

    await emitReduced(false);

    expect(loop).toHaveBeenCalledTimes(2);
    expect(started[1].start).toHaveBeenCalledTimes(1);
    expect(started[1].stop).not.toHaveBeenCalled();
  });

  it('nustatymui nesikeičiant, pulsavimas nepaleidžiamas iš naujo', async () => {
    await render(<Skeleton height={20} />);
    await flush();

    await emitReduced(false);
    await emitReduced(false);

    expect(loop).toHaveBeenCalledTimes(1);
    expect(started[0].stop).not.toHaveBeenCalled();
  });
});

describe('Skeleton išvaizda ir prieinamumas', () => {
  it('dekoratyvus blokas paslėptas nuo ekrano skaitytuvo', async () => {
    await render(<CardListSkeleton label="Kraunama…" count={2} />);

    const list = screen.getByTestId('loading-view');
    const blocks = list.children.filter((child) => typeof child !== 'string');

    expect(blocks).toHaveLength(2);
    for (const block of blocks) {
      const props = propsOf(block);
      expect(props.accessibilityElementsHidden).toBe(true);
      expect(props.importantForAccessibility).toBe('no-hide-descendants');
    }
  });
});

describe('CardListSkeleton', () => {
  it('yra vienas prieinamumo elementas su krovimo žinute', async () => {
    await render(<CardListSkeleton label="Kraunami automobiliai" />);

    const list = screen.getByRole('progressbar', { name: 'Kraunami automobiliai' });
    expect(list.props.accessible).toBe(true);
  });

  it('rodo numatytą arba nurodytą kortelių skaičių', async () => {
    const { rerender } = await render(<CardListSkeleton label="Kraunama…" />);
    expect(screen.getByTestId('loading-view').children).toHaveLength(3);

    await rerender(<CardListSkeleton label="Kraunama…" count={5} />);
    expect(screen.getByTestId('loading-view').children).toHaveLength(5);
  });

  it('kortelių aukštį galima perduoti pagal naudojimo vietą', async () => {
    await render(<CardListSkeleton label="Kraunama…" count={2} cardHeight={306} />);

    const heights = screen
      .getByTestId('loading-view')
      .children.map((child) => (StyleSheet.flatten(propsOf(child).style as ViewStyle) as ViewStyle).height);

    expect(heights).toEqual([306, 306]);
  });
});
