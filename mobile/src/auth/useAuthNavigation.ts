import { useRouter } from 'expo-router';

// Atidaro prisijungimą / registraciją taip, kad po jų vartotojas grįžtų į ekraną, iš kurio atėjo.
export function useAuthNavigation() {
  const router = useRouter();
  return {
    goLogin: () => router.push({ pathname: '/prisijungimas', params: { griztiAtgal: '1' } }),
    goRegister: () => router.push({ pathname: '/registracija', params: { griztiAtgal: '1' } }),
  };
}
