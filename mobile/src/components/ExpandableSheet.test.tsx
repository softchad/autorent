import { act, fireEvent, render, screen } from '@testing-library/react-native';
import {
  AccessibilityInfo,
  Animated,
  GestureResponderEvent,
  PanResponder,
  PanResponderGestureState,
  Text,
} from 'react-native';
import { motion } from '@/theme';
import { clampPosition, ExpandableSheet, shouldCaptureDrag } from './ExpandableSheet';

// Čia tikrinama mūsų gestų logika, kviečiant PanResponder atgalinius iškvietimus tiesiogiai.
// Tai nėra tikro piršto bandymas: PanResponder, native animacijos ir sistemos gestų
// nutraukimas telefone šiais testais neįrodomi.

const COLLAPSED = 100;
const EXPANDED = 400;
const TRAVEL = EXPANDED - COLLAPSED;

type Config = Parameters<typeof PanResponder.create>[0];

const isEnabled = AccessibilityInfo.isReduceMotionEnabled as jest.Mock;
const event = {} as GestureResponderEvent;
const gesture = (dy: number, vy = 0, dx = 0) => ({ dx, dy, vy }) as PanResponderGestureState;

let config: Config;
let timing: jest.SpyInstance;
let setValue: jest.SpyInstance;
let stopAnimation: jest.SpyInstance;
// Reikšmė, kurią „tikroji“ lapo padėtis turi tempimo pradžioje (kai lapas dar juda, ji kita nei galutinė).
let valueAtGrant: number | null;
let pendingStops: ((value: number) => void)[];

beforeEach(() => {
  const realCreate = PanResponder.create.bind(PanResponder);
  jest.spyOn(PanResponder, 'create').mockImplementation((next) => {
    config = next;
    return realCreate(next);
  });

  pendingStops = [];
  valueAtGrant = TRAVEL;
  stopAnimation = jest
    .spyOn(Animated.Value.prototype, 'stopAnimation')
    .mockImplementation(((callback?: (value: number) => void) => {
      if (!callback) return;
      if (valueAtGrant === null) pendingStops.push(callback);
      else callback(valueAtGrant);
    }) as never);
  setValue = jest.spyOn(Animated.Value.prototype, 'setValue');
  timing = jest.spyOn(Animated, 'timing');
  isEnabled.mockReset().mockResolvedValue(false);
});

afterEach(() => {
  jest.restoreAllMocks();
});

async function renderSheet({ reduced = false } = {}) {
  isEnabled.mockResolvedValue(reduced);
  await render(
    <ExpandableSheet
      header={<Text>Antraštė</Text>}
      collapsedHeight={COLLAPSED}
      expandedHeight={EXPANDED}
      expandLabel="Išskleisti"
      collapseLabel="Suskleisti"
      testID="lapas"
    >
      <Text>Turinys</Text>
    </ExpandableSheet>,
  );
  // Leidžiame hook'ui nuskaityti „mažinti judesį“ nustatymą ir pradiniam efektui pasibaigti.
  await act(async () => {});
  timing.mockClear();
  setValue.mockClear();
}

const grant = () => act(async () => config.onPanResponderGrant?.(event, gesture(0)));
const move = (dy: number, dx = 0) => act(async () => config.onPanResponderMove?.(event, gesture(dy, 0, dx)));
const release = (dy: number, vy = 0) => act(async () => config.onPanResponderRelease?.(event, gesture(dy, vy)));
const terminate = () => act(async () => config.onPanResponderTerminate?.(event, gesture(0)));
const isExpanded = () => screen.getByTestId('lapas-handle').props.accessibilityState.expanded;
const lastSetValue = () => setValue.mock.calls.at(-1)?.[0];

describe('tempimo pradžia', () => {
  it('vertikalų judesį perima, horizontalų, įstrižą ir smulkų – ne', () => {
    expect(shouldCaptureDrag(0, 20)).toBe(true);
    expect(shouldCaptureDrag(5, -20)).toBe(true);
    expect(shouldCaptureDrag(30, 8)).toBe(false);
    expect(shouldCaptureDrag(20, 20)).toBe(false);
    expect(shouldCaptureDrag(0, 5)).toBe(false);
    expect(shouldCaptureDrag(0, 6)).toBe(false);
  });

  it('PanResponder naudoja tą pačią taisyklę ir neleidžia kitiems perimti gesto', async () => {
    await renderSheet();

    expect(config.onMoveShouldSetPanResponder?.(event, gesture(30, 0, 0))).toBe(true);
    expect(config.onMoveShouldSetPanResponder?.(event, gesture(10, 0, 40))).toBe(false);
    expect(config.onPanResponderTerminationRequest?.(event, gesture(0))).toBe(false);
  });
});

describe('clampPosition', () => {
  it('prideda poslinkį prie pradžios ir neišeina už ribų', () => {
    expect(clampPosition(120, -30, TRAVEL)).toBe(90);
    expect(clampPosition(120, -500, TRAVEL)).toBe(0);
    expect(clampPosition(120, 500, TRAVEL)).toBe(TRAVEL);
  });
});

describe('tempimas animacijos metu', () => {
  it('prasideda nuo tikrosios lapo padėties, o ne nuo galutinės', async () => {
    await renderSheet();
    valueAtGrant = 120; // lapas dar juda link suskleistos padėties (300)

    await grant();
    await move(-30);

    expect(stopAnimation).toHaveBeenCalledTimes(1);
    expect(lastSetValue()).toBe(90);
  });

  it('kol tikroji padėtis nežinoma, lapas nejuda, o gavus – pasiveja pirštą', async () => {
    await renderSheet();
    valueAtGrant = null;

    await grant();
    await move(-30);
    expect(setValue).not.toHaveBeenCalled();

    await act(async () => pendingStops[0](120));
    await move(-40);
    expect(lastSetValue()).toBe(80);
  });

  it('pavėluotas atsakymas iš ankstesnio tempimo naujo nepaveikia', async () => {
    await renderSheet();
    valueAtGrant = null;

    await grant();
    await grant();
    await act(async () => pendingStops[0](5));
    await move(-10);
    expect(setValue).not.toHaveBeenCalled();

    await act(async () => pendingStops[1](200));
    await move(-10);
    expect(lastSetValue()).toBe(190);
  });
});

describe('gesto nutraukimas', () => {
  it('nutrūkus tempimui suskleistas lapas grįžta į suskleistą padėtį', async () => {
    await renderSheet();
    valueAtGrant = TRAVEL;

    await grant();
    await move(-120);
    expect(lastSetValue()).toBe(180);

    timing.mockClear();
    await terminate();

    expect(isExpanded()).toBe(false);
    expect(timing).toHaveBeenCalledTimes(1);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: TRAVEL, duration: motion.select });
  });

  it('nutrūkus tempimui išskleistas lapas grįžta į išskleistą padėtį', async () => {
    await renderSheet();
    await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti' }));
    expect(isExpanded()).toBe(true);
    timing.mockClear();
    setValue.mockClear();

    valueAtGrant = 0;
    await grant();
    await move(90);
    expect(lastSetValue()).toBe(90);

    timing.mockClear();
    await terminate();

    expect(isExpanded()).toBe(true);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: 0, duration: motion.select });
  });

  it('nutraukimas be judesio užšaldyto lapo nepalieka pusiaukelėje', async () => {
    await renderSheet();
    valueAtGrant = 150; // gestas sustabdė judantį lapą

    await grant();
    await terminate();

    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: TRAVEL });
  });

  it('po nutraukimo pavėluotas stop atsakymas naujo tempimo neiškreipia', async () => {
    await renderSheet();
    valueAtGrant = null;

    await grant();
    await terminate();
    await act(async () => pendingStops[0](42));
    await move(-10);

    expect(setValue).not.toHaveBeenCalled();
  });
});

describe('atleidimas', () => {
  it('pakankamai patempus aukštyn lapas išsiskleidžia', async () => {
    await renderSheet();
    await grant();
    await move(-100);
    await release(-100);

    expect(isExpanded()).toBe(true);
  });

  it('per mažas judesys grąžina lapą atgal su animacija', async () => {
    await renderSheet();
    await grant();
    await move(-20);
    timing.mockClear();
    await release(-20);

    expect(isExpanded()).toBe(false);
    expect(timing.mock.calls[0][1]).toMatchObject({ toValue: TRAVEL, duration: motion.select });
  });
});

describe('sumažintas judesys', () => {
  it('rankenėlė pastumia lapą be animacijos', async () => {
    await renderSheet({ reduced: true });

    await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti' }));

    expect(isExpanded()).toBe(true);
    expect(timing).not.toHaveBeenCalled();
    expect(lastSetValue()).toBe(0);
  });

  it('atleidus per mažai patemptą lapą, jis grįžta be animacijos', async () => {
    await renderSheet({ reduced: true });
    await grant();
    await move(-20);
    await release(-20);

    expect(timing).not.toHaveBeenCalled();
    expect(lastSetValue()).toBe(TRAVEL);
  });

  it('nutraukus gestą, lapas grįžta be animacijos', async () => {
    await renderSheet({ reduced: true });
    await grant();
    await move(-80);
    await terminate();

    expect(timing).not.toHaveBeenCalled();
    expect(lastSetValue()).toBe(TRAVEL);
  });

  it('pakankamai patempus, lapas persijungia be animacijos', async () => {
    await renderSheet({ reduced: true });
    await grant();
    await move(-100);
    await release(-100);

    expect(isExpanded()).toBe(true);
    expect(timing).not.toHaveBeenCalled();
    expect(lastSetValue()).toBe(0);
  });

  it('kol nustatymas dar nenuskaitytas, animacijos nėra', async () => {
    isEnabled.mockReturnValue(new Promise<boolean>(() => {}));
    await render(
      <ExpandableSheet
        header={<Text>Antraštė</Text>}
        collapsedHeight={COLLAPSED}
        expandedHeight={EXPANDED}
        expandLabel="Išskleisti"
        collapseLabel="Suskleisti"
        testID="lapas"
      >
        <Text>Turinys</Text>
      </ExpandableSheet>,
    );
    timing.mockClear();

    await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti' }));

    expect(timing).not.toHaveBeenCalled();
  });

  it('judesys nesumažintas – išskleidimas animuojamas', async () => {
    await renderSheet({ reduced: false });

    await fireEvent.press(screen.getByRole('button', { name: 'Išskleisti' }));

    expect(timing.mock.calls.at(-1)?.[1]).toMatchObject({ toValue: 0, duration: motion.sheet });
  });
});
