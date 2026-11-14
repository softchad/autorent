import { Lexend_400Regular } from '@expo-google-fonts/lexend/400Regular';
import { Lexend_500Medium } from '@expo-google-fonts/lexend/500Medium';
import { Lexend_600SemiBold } from '@expo-google-fonts/lexend/600SemiBold';
import { Lexend_700Bold } from '@expo-google-fonts/lexend/700Bold';
import { fonts } from './fonts';

export { useFonts } from '@expo-google-fonts/lexend/useFonts';

// Įkeliami tik keturi naudojami šrifto storiai.
export const fontAssets = {
  [fonts.regular]: Lexend_400Regular,
  [fonts.medium]: Lexend_500Medium,
  [fonts.semibold]: Lexend_600SemiBold,
  [fonts.bold]: Lexend_700Bold,
};