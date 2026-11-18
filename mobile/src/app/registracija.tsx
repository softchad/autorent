import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet } from 'react-native';
import { Screen } from '@/components/Screen';
import { RegisterForm } from '@/features/auth/RegisterForm';
import { lt } from '@/i18n/lt';
import { spacing } from '@/theme';
import { brandImages } from '@/theme/images';

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
    <Screen grid testID="screen-register">
      <Stack.Screen options={{ title: lt.register.title }} />
      <Image source={brandImages.logoMark} style={styles.logo} resizeMode="contain" accessibilityLabel={lt.common.appName} />
      <RegisterForm onSuccess={handleSuccess} onGoLogin={goLogin} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Ženklo failo kraštinių santykis 192:180.
  logo: { width: 72, height: 68, alignSelf: 'center', marginBottom: spacing.lg },
});
