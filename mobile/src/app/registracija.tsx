import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Screen } from '@/components/Screen';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { AuthHeader } from '@/features/auth/AuthHeader';
import { lt } from '@/i18n/lt';

export default function RegisterScreen() {
  const router = useRouter();
  // „griztiAtgal“ – ekranas atidarytas iš kito srauto, todėl po registracijos grįžtame ten pat.
  const params = useLocalSearchParams<{ griztiAtgal?: string }>();

  function handleSuccess() {
    if (params.griztiAtgal === '1' && router.canGoBack()) {
      router.back();
    } else {
      router.replace('/');
    }
  }

  // replace, ne push: perjungiant registraciją ir prisijungimą istorija neauga. Perduodamas tik griztiAtgal.
  function goLogin() {
    router.replace({ pathname: '/prisijungimas', params: params.griztiAtgal === '1' ? { griztiAtgal: '1' } : {} });
  }

  return (
    <Screen testID="screen-register">
      <Stack.Screen options={{ title: lt.register.title }} />
      <AuthHeader title={lt.register.heading} subtitle={lt.register.intro} />
      <RegisterForm onSuccess={handleSuccess} onGoLogin={goLogin} />
    </Screen>
  );
}

