import { act, renderHook, waitFor } from '@testing-library/react-native';
import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import { isOnboardingDone, markOnboardingDone, useOnboarding } from './onboardingStorage';

jest.mock('expo-secure-store', () => ({
  getItemAsync: jest.fn(),
  setItemAsync: jest.fn(),
}));

const getSecure = SecureStore.getItemAsync as jest.Mock;
const setSecure = SecureStore.setItemAsync as jest.Mock;

const KEY = 'autorent_onboarding_done';

it('demonstracijoje įžanga rodoma ir su išsaugota žyma, o ją užbaigus atidaroma programėlė', async () => {
  const previous = process.env.EXPO_PUBLIC_DEMO_ONBOARDING;
  process.env.EXPO_PUBLIC_DEMO_ONBOARDING = '1';
  getSecure.mockResolvedValue('1');
  try {
    const first = await renderHook(() => useOnboarding());
    await waitFor(() => expect(first.result.current.status).toBe('needed'));
    await act(async () => first.result.current.complete());
    expect(first.result.current.status).toBe('done');
    await first.unmount();
    const second = await renderHook(() => useOnboarding());
    await waitFor(() => expect(second.result.current.status).toBe('needed'));
  } finally {
    if (previous === undefined) delete process.env.EXPO_PUBLIC_DEMO_ONBOARDING;
    else process.env.EXPO_PUBLIC_DEMO_ONBOARDING = previous;
  }
});

// Paprasta localStorage imitacija, kurioje matomi visi įrašyti raktai.
function createStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: jest.fn((key: string) => data.get(key) ?? null),
    setItem: jest.fn((key: string, value: string) => {
      data.set(key, value);
    }),
  };
}

function installLocalStorage(storage: unknown) {
  Object.defineProperty(globalThis, 'localStorage', { value: storage, configurable: true, writable: true });
}

function removeLocalStorage() {
  Reflect.deleteProperty(globalThis, 'localStorage');
}

function useWeb() {
  jest.replaceProperty(Platform, 'OS', 'web');
}

beforeEach(() => {
  getSecure.mockReset().mockResolvedValue(null);
  setSecure.mockReset().mockResolvedValue(undefined);
  removeLocalStorage();
});

afterEach(() => {
  jest.restoreAllMocks();
  removeLocalStorage();
});

describe('įžangos žyma žiniatinklyje (localStorage)', () => {
  it('išsaugo žymą ir ją perskaito', async () => {
    useWeb();
    const storage = createStorage();
    installLocalStorage(storage);

    expect(await isOnboardingDone()).toBe(false);
    await markOnboardingDone();

    expect(storage.setItem).toHaveBeenCalledWith(KEY, '1');
    expect(await isOnboardingDone()).toBe(true);
  });

  it('įrašo tik įžangos žymą – jokių kitų raktų ar duomenų', async () => {
    useWeb();
    const storage = createStorage();
    installLocalStorage(storage);

    await markOnboardingDone();

    expect([...storage.data.entries()]).toEqual([[KEY, '1']]);
  });

  it('žiniatinklyje nenaudoja SecureStore', async () => {
    useWeb();
    installLocalStorage(createStorage());

    await markOnboardingDone();
    await isOnboardingDone();

    expect(getSecure).not.toHaveBeenCalled();
    expect(setSecure).not.toHaveBeenCalled();
  });

  it('kita reikšmė nelaikoma žyma', async () => {
    useWeb();
    const storage = createStorage();
    storage.data.set(KEY, '0');
    installLocalStorage(storage);

    expect(await isOnboardingDone()).toBe(false);
  });

  it('localStorage neegzistuoja – įžanga rodoma, o išsaugojimas nemeta klaidos', async () => {
    useWeb();

    expect(await isOnboardingDone()).toBe(false);
    await expect(markOnboardingDone()).resolves.toBeUndefined();
  });

  it('prieiga prie localStorage meta klaidą (pvz. uždrausta) – nesustabdo programėlės', async () => {
    useWeb();
    Object.defineProperty(globalThis, 'localStorage', {
      get() {
        throw new Error('SecurityError');
      },
      configurable: true,
    });

    expect(await isOnboardingDone()).toBe(false);
    await expect(markOnboardingDone()).resolves.toBeUndefined();
  });

  it('skaitymo ir rašymo klaidos (pvz. pilna saugykla) nesustabdo programėlės', async () => {
    useWeb();
    installLocalStorage({
      getItem: jest.fn(() => {
        throw new Error('klaida');
      }),
      setItem: jest.fn(() => {
        throw new Error('QuotaExceededError');
      }),
    });

    expect(await isOnboardingDone()).toBe(false);
    await expect(markOnboardingDone()).resolves.toBeUndefined();
  });

  it('useOnboarding žiniatinklyje: užbaigus įžangą žyma lieka localStorage', async () => {
    useWeb();
    const storage = createStorage();
    installLocalStorage(storage);

    const first = await renderHook(() => useOnboarding());
    await waitFor(() => expect(first.result.current.status).toBe('needed'));
    await act(async () => {
      first.result.current.complete();
    });
    expect(first.result.current.status).toBe('done');
    await first.unmount();

    // Perkrovus puslapį įžanga nebeberodoma.
    const second = await renderHook(() => useOnboarding());
    await waitFor(() => expect(second.result.current.status).toBe('done'));
  });
});

describe('įžangos žyma telefone (SecureStore)', () => {
  it.each(['ios', 'android'] as const)('%s: naudoja SecureStore, o ne localStorage', async (os) => {
    jest.replaceProperty(Platform, 'OS', os);
    const storage = createStorage();
    installLocalStorage(storage);

    await markOnboardingDone();
    getSecure.mockResolvedValue('1');
    expect(await isOnboardingDone()).toBe(true);

    expect(setSecure).toHaveBeenCalledWith(KEY, '1');
    expect(getSecure).toHaveBeenCalledWith(KEY);
    expect(storage.getItem).not.toHaveBeenCalled();
    expect(storage.setItem).not.toHaveBeenCalled();
  });

  it('SecureStore klaida nesustabdo programėlės', async () => {
    jest.replaceProperty(Platform, 'OS', 'ios');
    getSecure.mockRejectedValue(new Error('klaida'));
    setSecure.mockRejectedValue(new Error('klaida'));

    expect(await isOnboardingDone()).toBe(false);
    await expect(markOnboardingDone()).resolves.toBeUndefined();
  });
});
