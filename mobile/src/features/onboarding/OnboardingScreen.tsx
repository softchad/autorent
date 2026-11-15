import { LinearGradient } from 'expo-linear-gradient';
import { StatusBar } from 'expo-status-bar';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { lt } from '@/i18n/lt';
import { colors, MIN_TOUCH_SIZE, spacing, typography } from '@/theme';
import { brandImages } from '@/theme/images';
import { SlideToEnter } from './SlideToEnter';

type Props = {
  // Kviečiama ir nutempus kapsulę, ir paspaudus „Praleisti“.
  onDone: () => void;
};

// Pirmojo paleidimo ekranas: nuotrauka per visą ekraną, šūkis ir „patrauk, kad pradėtum“ kapsulė.
export function OnboardingScreen({ onDone }: Props) {
  return (
    <View style={styles.background} testID="screen-onboarding">
      <StatusBar style="light" />
      <Image source={brandImages.onboarding} style={styles.photo} resizeMode="cover" accessibilityIgnoresInvertColors />
      {/* Viršus ir apačia užtamsinami, kad logotipas ir tekstas būtų įskaitomi. */}
      <LinearGradient
        colors={['rgba(11, 18, 31, 0.85)', 'rgba(11, 18, 31, 0.05)', 'rgba(11, 18, 31, 0.6)', 'rgba(11, 18, 31, 0.97)']}
        locations={[0, 0.3, 0.62, 1]}
        style={styles.shade}
      />
      <SafeAreaView style={styles.content}>
        <View style={styles.top}>
          <Image source={brandImages.logoFull} style={styles.logo} resizeMode="contain" accessibilityLabel={lt.common.appName} />
          <Pressable
            onPress={onDone}
            accessibilityRole="button"
            accessibilityLabel={lt.onboarding.skip}
            accessibilityHint={lt.onboarding.skipHint}
            hitSlop={8}
            style={styles.skip}
            testID="onboarding-skip"
          >
            <Text style={styles.skipText}>{lt.onboarding.skip}</Text>
          </Pressable>
        </View>
        <Text style={styles.headline} accessibilityRole="header">
          {lt.onboarding.headline}
        </Text>
        <View style={styles.bottom}>
          <SlideToEnter label={lt.onboarding.slide} accessibilityHint={lt.onboarding.slideHint} onComplete={onDone} testID="onboarding-slide" />
        </View>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  background: { flex: 1, backgroundColor: colors.background },
  photo: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  content: { flex: 1, justifyContent: 'space-between', padding: spacing.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  // Logotipo failo kraštinių santykis 720:85.
  logo: { width: 152, height: 18 },
  skip: { minHeight: MIN_TOUCH_SIZE, minWidth: MIN_TOUCH_SIZE, alignItems: 'flex-end', justifyContent: 'center' },
  skipText: { ...typography.bodyStrong, color: colors.text },
  bottom: { gap: spacing.xl, paddingBottom: spacing.sm },
  headline: { ...typography.display, position: 'absolute', top: '19%', left: spacing.xl, right: spacing.xl },
});