import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const TOKEN_KEY = 'autorent.customer.token';

// Žiniatinklyje expo-secure-store neveikia, todėl tokenas laikomas tik šio modulio atmintyje.
// Jis galioja tik dabartinėje sesijoje ir dingsta perkrovus puslapį.
// localStorage ir sessionStorage tokenui sąmoningai nenaudojami.
let webToken: string | null = null;

function isWeb(): boolean {
  return Platform.OS === 'web';
}

export async function saveToken(token: string): Promise<void> {
  if (isWeb()) {
    webToken = token;
    return;
  }
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function loadToken(): Promise<string | null> {
  if (isWeb()) {
    return webToken;
  }
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

// Nepavykus ištrinti, Promise atmetamas: tokenas gali likti įrenginyje.
// Sesijos kodas šią klaidą privalo apdoroti ir nelaikyti vartotojo atsijungusiu,
// kitaip kitą kartą paleidus programėlę loadToken grąžintų seną tokeną.
export async function clearToken(): Promise<void> {
  if (isWeb()) {
    webToken = null;
    return;
  }
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}
