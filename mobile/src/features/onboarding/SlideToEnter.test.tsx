import { act, fireEvent, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo, Animated, GestureResponderEvent, PanResponder, PanResponderGestureState } from 'react-native';
import { SlideToEnter } from './SlideToEnter';

// Tikrinama mūsų gesto logika: PanResponder atgaliniai iškvietimai kviečiami tiesiogiai, o Animated
// animacijos pakeistos valdomomis. Tai nėra tikro piršto, native animacijų ar sistemos gestų
// nutraukimo bandymas telefone.

type Config = Parameters<typeof PanResponder.create>[0];
type Result = { finished: boolean };

// Kapsulės plotis 300 → rankenėlės kelias 300 − 60 − 2·7 − 2 = 224; veiksmas įvykdomas nuo 85 % (≈190).
const TRACK_WIDTH = 300;
const MAX_TRAVEL = 224;

const isEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const addListener = AccessibilityInfo.addEventListener as jest.Mock;
const event = {} as GestureResponderEvent;
const gesture = (dx: number) => ({ dx, dy: 0, vx: 0, vy: 0 }) as PanResponderGestureState;

let config: Config;
let create: jest.SpyInstance;
let listeners: ((value: boolean) => void)[];
let timingRuns: { toValue: number; duration: number; finish: (result: Result) => void }[];
let springRuns: { toValue: number; finish: (result: Result) => void }[];
let setValue: jest.SpyInstance;
let stopAnimation: jest.SpyInstance;
let valueAtGrant: number;

beforeEach(() => {
  const realCreate = PanResponder.create.bind(PanResponder);
  create = jest.spyOn(PanResponder, 'create').mockImplementation((next) => {
    config = next;
    return realCreate(next);
  });

  timingRuns = [];
  springRuns = [];
  // Valdomos animacijos: testas pats nusprendžia, kada ir kaip jos pasibaigia.
  jest.spyOn(Animated, 'timing').mockImplementation(((_value: unknown, options: { toValue: number; duration: number }) => ({
    start: (callback?: (result: Result) => void) => {
      timingRuns.push({ toValue: options.toValue, duration: options.duration, finish: (result) => callback?.(result) });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  })) as never);
  jest.spyOn(Animated, 'spring').mockImplementation(((_value: unknown, options: { toValue: number }) => ({
    start: (callback?: (result: Result) => void) => {
      springRuns.push({ toValue: options.toValue, finish: (result) => callback?.(result) });
    },
    stop: jest.fn(),
    reset: jest.fn(),
  })) as never);

  valueAtGrant = 0;
  stopAnimation = jest.spyOn(Animated.Value.prototype, 'stopAnimation').mockImplementation(((callback?: (value: number) => void) => {
    callback?.(valueAtGrant);
  }) as never);
  setValue = jest.spyOn(Animated.Value.prototype, 'setValue');

  listeners = [];
  isEnabled.mockReset().mockResolvedValue(false);
  addListener.mockReset().mockImplementation((_name: string, handler: (value: boolean) => void) => {
    listeners.push(handler);
    return { remove: jest.fn() };
  });
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderSlide({ reduced = false, onComplete = jest.fn() } = {}) {
  isEnabled.mockResolvedValue(reduced);
  const view = await render(<SlideToEnter label="Pradėk kelionę" accessibilityHint="Paaiškinimas" onComplete={onComplete} testID="slide" />);
  await fireEvent(screen.getByTestId('slide'), 'layout', { nativeEvent: { layout: { x: 0, y: 0, width: TRACK_WIDTH, height: 74 } } });
  // Leidžiame hook'ui nuskaityti „mažinti judesį“ nustatymą.
  await act(async () => {});
  setValue.mockClear();
  stopAnimation.mockClear();
  return { onComplete, view };
}

const setReduced = (value: boolean) => act(async () => listeners.forEach((listener) => listener(value)));
const grant = () => act(async () => config.onPanResponderGrant?.(event, gesture(0)));
const move = (dx: number) => act(async () => config.onPanResponderMove?.(event, gesture(dx)));
const release = (dx: number) => act(async () => config.onPanResponderRelease?.(event, gesture(dx)));
const terminate = () => act(async () => config.onPanResponderTerminate?.(event, gesture(0)));
const lastSetValue = () => setValue.mock.calls.at(-1)?.[0];

describe('rankenėlės tempimas', () => {
  it('prasideda nuo tikrosios padėties ir neišeina už kapsulės ribų', async () => {
    await renderSlide();
    valueAtGrant = 40; // rankenėlė dar grįžta atgal

    await grant();
    await move(10);
    expect(lastSetValue()).toBe(50);

    await move(500);
    expect(lastSetValue()).toBe(MAX_TRAVEL);

    await move(-500);
    expect(lastSetValue()).toBe(0);
  });

  it('nepakankamai nutempus rankenėlė grįžta atgal, o veiksmas nevykdomas', async () => {
    const { onComplete } = await renderSlide();

    await grant();
    await move(100);
    await release(100);

    expect(springRuns).toHaveLength(1);
    expect(springRuns[0].toValue).toBe(0);
    expect(timingRuns).toHaveLength(0);
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('veiksmo užbaigimas', () => {
  it('nutempus iki galo veiksmas įvykdomas tik sėkmingai pabaigus animaciją', async () => {
    const { onComplete } = await renderSlide();

    await grant();
    await move(210);
    await release(210);

    expect(timingRuns).toHaveLength(1);
    expect(timingRuns[0].toValue).toBe(MAX_TRAVEL);
    expect(onComplete).not.toHaveBeenCalled();

    await act(async () => timingRuns[0].finish({ finished: true }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('nutraukus animaciją veiksmas nevykdomas, o rankenėlė grįžta į pradžią', async () => {
    const { onComplete } = await renderSlide();

    await grant();
    await release(210);
    await act(async () => timingRuns[0].finish({ finished: false }));

    expect(onComplete).not.toHaveBeenCalled();
    expect(springRuns).toHaveLength(1);
    expect(springRuns[0].toValue).toBe(0);
  });

  it('kol rankenėlė važiuoja iki galo, naujo gesto nepriima', async () => {
    await renderSlide();
    expect(config.onStartShouldSetPanResponder?.(event, gesture(0))).toBe(true);

    await grant();
    await release(210);

    expect(config.onStartShouldSetPanResponder?.(event, gesture(0))).toBe(false);
    expect(config.onMoveShouldSetPanResponder?.(event, gesture(5))).toBe(false);
  });

  it('veiksmas įvykdomas tik vieną kartą, net jei jį iškviesta keliais būdais', async () => {
    const { onComplete } = await renderSlide();

    await grant();
    await release(210);
    // Tuo metu ekrano skaitytuvo vartotojas aktyvina mygtuką.
    await fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    await act(async () => timingRuns[0].finish({ finished: true }));
    await fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

describe('gesto nutraukimas', () => {
  it('sistemai nutraukus gestą rankenėlė grįžta į pradžią, o veiksmas nevykdomas', async () => {
    const { onComplete } = await renderSlide();

    await grant();
    await move(150);
    await terminate();

    expect(springRuns).toHaveLength(1);
    expect(springRuns[0].toValue).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
    // Po nutraukimo galima pradėti naują gestą.
    expect(config.onStartShouldSetPanResponder?.(event, gesture(0))).toBe(true);
  });

  it('kiti komponentai gesto neperima', async () => {
    await renderSlide();

    expect(config.onPanResponderTerminationRequest?.(event, gesture(0))).toBe(false);
  });

  it('nutraukimas be tempimo nieko nekeičia', async () => {
    await renderSlide();

    await terminate();

    expect(springRuns).toHaveLength(0);
    expect(setValue).not.toHaveBeenCalled();
  });
});

describe('sumažintas judesys', () => {
  it('nepakankamai nutempus rankenėlė grįžta iškart, be animacijos', async () => {
    const { onComplete } = await renderSlide({ reduced: true });

    await grant();
    await release(50);

    expect(springRuns).toHaveLength(0);
    expect(lastSetValue()).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('nutempus iki galo veiksmas įvykdomas iškart, be animacijos', async () => {
    const { onComplete } = await renderSlide({ reduced: true });

    await grant();
    await release(210);

    expect(timingRuns).toHaveLength(0);
    expect(lastSetValue()).toBe(MAX_TRAVEL);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('nutraukus gestą rankenėlė grįžta iškart', async () => {
    await renderSlide({ reduced: true });

    await grant();
    await move(120);
    await terminate();

    expect(springRuns).toHaveLength(0);
    expect(lastSetValue()).toBe(0);
  });

  it('nustatymo pasikeitimas nepakeičia PanResponder, todėl pradėto gesto nenutraukia', async () => {
    await renderSlide();
    const createdAtStart = create.mock.calls.length;
    const handlersAtStart = config;

    await grant();
    await move(80);
    await setReduced(true);
    await setReduced(false);
    await move(120);

    expect(create).toHaveBeenCalledTimes(createdAtStart);
    expect(config).toBe(handlersAtStart);
    expect(lastSetValue()).toBe(120);
  });

  it('įjungus nustatymą grįžtanti rankenėlė sustoja pradžioje', async () => {
    const { onComplete } = await renderSlide({ reduced: false });

    await grant();
    await release(100);
    expect(springRuns).toHaveLength(1);
    stopAnimation.mockClear();
    setValue.mockClear();

    await setReduced(true);

    expect(stopAnimation).toHaveBeenCalled();
    expect(lastSetValue()).toBe(0);
    // Pavėluotas seno animacijos atsakymas nieko nesugadina.
    await act(async () => springRuns[0].finish({ finished: false }));
    expect(onComplete).not.toHaveBeenCalled();
    expect(config.onStartShouldSetPanResponder?.(event, gesture(0))).toBe(true);
  });
});

describe('išmontavimas', () => {
  it('išmontuojant sustabdoma animacija, o pavėluotas pabaigimas veiksmo nekviečia', async () => {
    const { onComplete, view } = await renderSlide();

    await grant();
    await release(210);
    stopAnimation.mockClear();

    await view.unmount();
    expect(stopAnimation).toHaveBeenCalledWith();

    await act(async () => timingRuns[0].finish({ finished: true }));
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('išmontavus pavėluotas nutraukimas rankenėlės nebejudina', async () => {
    const { view } = await renderSlide();

    await grant();
    await release(210);
    await view.unmount();
    setValue.mockClear();

    await act(async () => timingRuns[0].finish({ finished: false }));

    expect(springRuns).toHaveLength(0);
    expect(setValue).not.toHaveBeenCalled();
  });
});

describe('alternatyva be vilkimo', () => {
  it('ekrano skaitytuvo veiksmas „activate“ užbaigia įžangą nieko netempiant', async () => {
    const { onComplete } = await renderSlide();

    await fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(timingRuns).toHaveLength(0);
  });
});
