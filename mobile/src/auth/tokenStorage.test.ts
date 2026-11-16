import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';
import {
  clearToken,
  loadToken,
  saveToken,
} from './tokenStorage';

// SecureStore pakeistas mock'u: šie testai tikrina tik mūsų kodo elgesį
// (kokie kvietimai daromi ir kaip perduodamos klaidos), o ne tikrą įrenginio saugyklą.
jest.mock('expo-secure-store', () => ({
  setItemAsync: jest.fn(),
  getItemAsync: jest.fn(),
  deleteItemAsync: jest.fn(),
}));

const mockedStore = jest.mocked(SecureStore);
const TOKEN_KEY = 'autorent.customer.token';

beforeEach(() => {
  // resetAllMocks pašalina ir nepanaudotus mock*Once, todėl jie nepersikelia į kitą testą.
  jest.resetAllMocks();
  mockedStore.setItemAsync.mockResolvedValue(undefined);
  mockedStore.getItemAsync.mockResolvedValue(null);
  mockedStore.deleteItemAsync.mockResolvedValue(undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('tokenStorage native (SecureStore mock)', () => {
  beforeEach(() => {
    jest.replaceProperty(Platform, 'OS', 'ios');
  });

  it('saveToken perduoda tokeną SecureStore su pastoviu raktu', async () => {
    await saveToken('abc.def.ghi');

    expect(mockedStore.setItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedStore.setItemAsync).toHaveBeenCalledWith(TOKEN_KEY, 'abc.def.ghi');
  });

  it('loadToken grąžina SecureStore reikšmę', async () => {
    mockedStore.getItemAsync.mockResolvedValue('abc.def.ghi');

    await expect(loadToken()).resolves.toBe('abc.def.ghi');
    expect(mockedStore.getItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });

  it('loadToken skaitymo klaidos atveju grąžina null', async () => {
    mockedStore.getItemAsync.mockRejectedValue(new Error('Saugyklos klaida'));

    await expect(loadToken()).resolves.toBeNull();
  });

  it('clearToken kviečia SecureStore trynimą su pastoviu raktu', async () => {
    await expect(clearToken()).resolves.toBeUndefined();

    expect(mockedStore.deleteItemAsync).toHaveBeenCalledTimes(1);
    expect(mockedStore.deleteItemAsync).toHaveBeenCalledWith(TOKEN_KEY);
  });

  it('saveToken klaidą perduoda kviečiančiam kodui', async () => {
    mockedStore.setItemAsync.mockRejectedValue(new Error('Rašymo klaida'));

    await expect(saveToken('t1')).rejects.toThrow('Rašymo klaida');
  });

  it('clearToken klaidą perduoda kviečiančiam kodui', async () => {
    mockedStore.deleteItemAsync.mockRejectedValue(new Error('Trynimo klaida'));

    await expect(clearToken()).rejects.toThrow('Trynimo klaida');
  });
});

describe('tokenStorage web (tik atmintyje)', () => {
  beforeEach(async () => {
    jest.replaceProperty(Platform, 'OS', 'web');
    await clearToken();
  });

  it('išsaugo ir perskaito tokeną dabartinėje sesijoje', async () => {
    await saveToken('web.token');

    await expect(loadToken()).resolves.toBe('web.token');
  });

  it('po išvalymo tokeno nebėra', async () => {
    await saveToken('web.token');
    await clearToken();

    await expect(loadToken()).resolves.toBeNull();
  });

  it('nenaudoja SecureStore, localStorage ir sessionStorage', async () => {
    // Jest aplinkoje naršyklės saugyklų nėra, todėl laikinai įdedame šnipus.
    const makeStorage = () => ({
      setItem: jest.fn(),
      getItem: jest.fn(),
      removeItem: jest.fn(),
    });
    const fakeLocal = makeStorage();
    const fakeSession = makeStorage();
    const globals = globalThis as Record<string, unknown>;
    globals.localStorage = fakeLocal;
    globals.sessionStorage = fakeSession;

    try {
      await saveToken('web.token');
      await loadToken();
      await clearToken();
    } finally {
      delete globals.localStorage;
      delete globals.sessionStorage;
    }

    expect(mockedStore.setItemAsync).not.toHaveBeenCalled();
    expect(mockedStore.getItemAsync).not.toHaveBeenCalled();
    expect(mockedStore.deleteItemAsync).not.toHaveBeenCalled();
    for (const storage of [fakeLocal, fakeSession]) {
      expect(storage.setItem).not.toHaveBeenCalled();
      expect(storage.getItem).not.toHaveBeenCalled();
      expect(storage.removeItem).not.toHaveBeenCalled();
    }
  });

  it('naujai įkėlus modulį (perkrovus puslapį) tokeno nebelieka', async () => {
    await saveToken('web.token');

    await jest.isolateModulesAsync(async () => {
      const { Platform: freshPlatform } = require('react-native');
      jest.replaceProperty(freshPlatform, 'OS', 'web');
      const fresh: typeof import('./tokenStorage') = require('./tokenStorage');

      await expect(fresh.loadToken()).resolves.toBeNull();
    });
  });
});
