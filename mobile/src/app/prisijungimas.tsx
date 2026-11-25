import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { LoginForm } from '@/features/auth/LoginForm';
import { AuthHeader } from '@/features/auth/AuthHeader';
import { lt } from '@/i18n/lt';

export default function LoginScreen() {
  const router = useRouter();
  // „griztiAtgal“ – ekranas atidarytas iš kito srauto, todėl po prisijungimo grįžtame ten pat.
  const params = useLocalSearchParams<{ griztiAtgal?: string }>();

  function handleSuccess() {
    if (params.griztiAtgal === '1' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  // replace, ne push: perjungiant prisijungimą ir registraciją istorija neauga, o po sėkmės
  // router.back() grąžina į ekraną, iš kurio srautas pradėtas. Perduodamas tik griztiAtgal.
  function goRegister() {
    router.replace({ pathname: '/registracija', params: params.griztiAtgal === '1' ? { griztiAtgal: '1' } : {} });
  }

  return (
    <Screen testID="screen-login">
      <Stack.Screen options={{ title: lt.login.title }} />
      <AuthHeader title={lt.login.heading} subtitle={lt.login.intro} />
      <LoginForm onSuccess={handleSuccess} onGoRegister={goRegister} />
    </Screen>
  );
}

