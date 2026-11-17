import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { Image, StyleSheet } from 'react-native';
import { Screen } from '@/components/Screen';
import { LoginForm } from '@/features/auth/LoginForm';
import { lt } from '@/i18n/lt';
import { spacing } from '@/theme';
import { brandImages } from '@/theme/images';

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

  // Registracijos maršruto dar nėra, todėl onGoRegister neperduodamas ir nuoroda nerodoma.
  return (
    <Screen grid testID="screen-login">
      <Stack.Screen options={{ title: lt.login.title }} />
      <Image source={brandImages.logoMark} style={styles.logo} resizeMode="contain" accessibilityLabel={lt.common.appName} />
      <LoginForm onSuccess={handleSuccess} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  // Ženklo failo kraštinių santykis 192:180.
  logo: { width: 72, height: 68, alignSelf: 'center', marginBottom: spacing.lg },
});
