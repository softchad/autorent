import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { fontAssets, useFonts } from '@/theme/fontAssets';

// Kiekvienas failas src/app aplanke tampa programėlės ekranu.
export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts(fontAssets);

  // Laukiame šriftų. Jei jų įkelti nepavyksta, leidžiame atidaryti programėlę.
  if (!fontsLoaded && !fontError) {
    return null;
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack />
    </>
  );
}