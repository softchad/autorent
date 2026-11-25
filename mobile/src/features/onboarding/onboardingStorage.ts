import * as SecureStore from 'expo-secure-store';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

// Saugoma tik žyma „įžanga jau matyta“. Ji nesusijusi su prisijungimu: atsijungus įžanga iš naujo nerodoma.
const ONBOARDING_KEY = 'autorent_onboarding_done';
const DONE = '1';

// Žiniatinklyje expo-secure-store neveikia, todėl tik šiai (neslaptai) žymai naudojamas localStorage.
// Prisijungimo duomenų, raktų ar kitos informacijos į localStorage nerašome. Telefone lieka SecureStore.
// Naršyklėje localStorage gali būti neprieinamas arba mesti klaidą (privatus režimas, uždrausti slapukai).
function getWebStorage(): Storage | null {
  try {
    return typeof localStorage === 'undefined' ? null : localStorage;
  } catch {
    return null;
  }
}

export async function isOnboardingDone(): Promise<boolean> {
  try {
    if (Platform.OS === 'web') {
      return getWebStorage()?.getItem(ONBOARDING_KEY) === DONE;
    }
    return (await SecureStore.getItemAsync(ONBOARDING_KEY)) === DONE;
  } catch {
    // Saugyklos perskaityti nepavyko – įžangą geriau parodyti dar kartą nei užstrigti.
    return false;
  }
}

export async function markOnboardingDone(): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      getWebStorage()?.setItem(ONBOARDING_KEY, DONE);
      return;
    }
    await SecureStore.setItemAsync(ONBOARDING_KEY, DONE);
  } catch {
    // Neišsaugojus įžanga tiesiog bus parodyta ir kitą kartą.
  }
}

export type OnboardingStatus = 'loading' | 'needed' | 'done';

// Būsena šakniniam išdėstymui: ar rodyti įžangą, ar iškart programėlę.
export function useOnboarding(): { status: OnboardingStatus; complete: () => void } {
  const [status, setStatus] = useState<OnboardingStatus>('loading');

  useEffect(() => {
    if (__DEV__ && process.env.EXPO_PUBLIC_DEMO_ONBOARDING === '1') {
      setStatus('needed');
      return;
    }
    let active = true;
    isOnboardingDone().then((done) => {
      if (active) setStatus(done ? 'done' : 'needed');
    });
    return () => {
      active = false;
    };
  }, []);

  const complete = useCallback(() => {
    // Programėlė atidaroma iškart; žymos įrašymo nelaukiame.
    setStatus('done');
    void markOnboardingDone();
  }, []);

  return { status, complete };
}
