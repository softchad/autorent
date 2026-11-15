import { act, fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { lt } from '@/i18n/lt';
import { OnboardingScreen } from './OnboardingScreen';
import { isOnboardingDone, markOnboardingDone, useOnboarding } from './onboardingStorage';
import { clampSlide, isSlideComplete, SlideToEnter } from './SlideToEnter';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getItem = SecureStore.getItemAsync as jest.Mock;
const setItem = SecureStore.setItemAsync as jest.Mock;

beforeEach(() => {
  getItem.mockReset();
  setItem.mockReset();
  getItem.mockResolvedValue(null);
  setItem.mockResolvedValue(undefined);
});

describe('isSlideComplete', () => {
  it('veiksmas įvykdomas nutempus bent 85 % kelio', () => {
    expect(isSlideComplete(84, 100)).toBe(false);
    expect(isSlideComplete(85, 100)).toBe(true);
    expect(isSlideComplete(100, 100)).toBe(true);
  });

  it('kol kapsulės plotis nežinomas, veiksmas nevykdomas', () => {
    expect(isSlideComplete(0, 0)).toBe(false);
    expect(isSlideComplete(50, -10)).toBe(false);
  });
});

describe('clampSlide', () => {
  it('rankenėlė neišeina už kapsulės ribų', () => {
    expect(clampSlide(-30, 200)).toBe(0);
    expect(clampSlide(120, 200)).toBe(120);
    expect(clampSlide(999, 200)).toBe(200);
  });
});

describe('SlideToEnter', () => {
  it('ekrano skaitytuvui tai mygtukas, kurį galima aktyvinti netempiant', async () => {
    const onComplete = jest.fn();
    await render(<SlideToEnter label="Pradėk kelionę" accessibilityHint="Paaiškinimas" onComplete={onComplete} testID="slide" />);
    const slider = screen.getByRole('button', { name: 'Pradėk kelionę' });
    await fireEvent(slider, 'accessibilityAction', { nativeEvent: { actionName: 'activate' } });
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('nežinomas prieinamumo veiksmas nieko nedaro', async () => {
    const onComplete = jest.fn();
    await render(<SlideToEnter label="Pradėk kelionę" accessibilityHint="Paaiškinimas" onComplete={onComplete} testID="slide" />);
    await fireEvent(screen.getByTestId('slide'), 'accessibilityAction', { nativeEvent: { actionName: 'longpress' } });
    expect(onComplete).not.toHaveBeenCalled();
  });
});

describe('OnboardingScreen', () => {
  it('rodo šūkį ir leidžia įžangą praleisti', async () => {
    const onDone = jest.fn();
    await render(<OnboardingScreen onDone={onDone} />);
    expect(screen.getByRole('header', { name: lt.onboarding.headline })).toBeTruthy();
    await fireEvent.press(screen.getByRole('button', { name: lt.onboarding.skip }));
    expect(onDone).toHaveBeenCalledTimes(1);
  });
});

describe('įžangos žyma', () => {
  it('pirmą kartą įžanga reikalinga', async () => {
    expect(await isOnboardingDone()).toBe(false);
  });

  it('pažymėjus įžanga neberodoma', async () => {
    await markOnboardingDone();
    expect(setItem).toHaveBeenCalledWith('autorent_onboarding_done', '1');
    getItem.mockResolvedValue('1');
    expect(await isOnboardingDone()).toBe(true);
  });

  it('saugyklos klaida programėlės nesustabdo', async () => {
    getItem.mockRejectedValue(new Error('saugykla neveikia'));
    setItem.mockRejectedValue(new Error('saugykla neveikia'));
    expect(await isOnboardingDone()).toBe(false);
    await expect(markOnboardingDone()).resolves.toBeUndefined();
  });

  it('saugoma tik žyma – jokių asmens duomenų ar prisijungimo rakto', async () => {
    await markOnboardingDone();
    expect(setItem).toHaveBeenCalledTimes(1);
    expect(setItem.mock.calls[0]).toEqual(['autorent_onboarding_done', '1']);
  });
});

describe('useOnboarding', () => {
  it('kol žyma skaitoma – „loading“, paskui „needed“', async () => {
    const { result } = await renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.status).toBe('needed'));
  });

  it('jau matyta įžanga praleidžiama', async () => {
    getItem.mockResolvedValue('1');
    const { result } = await renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.status).toBe('done'));
  });

  it('užbaigus įžangą būsena pasikeičia iškart ir žyma išsaugoma', async () => {
    const { result } = await renderHook(() => useOnboarding());
    await waitFor(() => expect(result.current.status).toBe('needed'));
    await act(async () => {
      result.current.complete();
    });
    expect(result.current.status).toBe('done');
    expect(setItem).toHaveBeenCalledWith('autorent_onboarding_done', '1');
  });
});