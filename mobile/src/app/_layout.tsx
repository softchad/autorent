import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fontAssets, useFonts } from '@/theme/fontAssets';
import { OnboardingScreen } from '@/features/onboarding/OnboardingScreen';
import { useOnboarding } from '@/features/onboarding/onboardingStorage';
import { lt } from '@/i18n/lt';
import { colors, fonts } from '@/theme';
import { AuthProvider } from '@/auth/AuthContext';

// Šakninis išdėstymas: kiekvienas failas src/app aplanke tampa ekranu (kaip Next.js App Router).
// (tabs) grupė – trys apatiniai skirtukai; kiti ekranai atsidaro virš jų su „Atgal“ mygtuku.
export default function RootLayout() {
  // Jei šrifto užkrauti nepavyko, programėlė vis tiek atsidaro su sisteminiu šriftu.
  const [fontsLoaded, fontError] = useFonts(fontAssets);
  // Įžanga rodoma tik pirmą kartą; ji nepriklauso nuo prisijungimo.
  const onboarding = useOnboarding();

  if ((!fontsLoaded && !fontError) || onboarding.status === 'loading') {
    return null;
  }
  if (onboarding.status === 'needed') {
    return <OnboardingScreen onDone={onboarding.complete} />;
  }
  return (
    <AuthProvider>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.background },
          headerShadowVisible: false,
          headerTintColor: colors.text,
          headerTitleStyle: { color: colors.text, fontFamily: fonts.semibold },
          headerBackTitle: lt.common.back,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
      </Stack>
    </AuthProvider>
  );
}