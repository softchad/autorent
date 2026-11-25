import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, Text, View } from 'react-native';
import { colors, radius, spacing, typography } from '@/theme';
import { brandImages } from '@/theme/images';

type Props = { title: string; subtitle: string };

export function AuthHeader({ title, subtitle }: Props) {
  return (
    <LinearGradient colors={[colors.primarySoft, colors.surfaceAlt]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.hero}>
      <View style={styles.heading}>
        <Text style={styles.title} accessibilityRole="header">{title}</Text>
        <View style={styles.mark}>
          <Image source={brandImages.logoMark} style={styles.logo} resizeMode="contain" accessible={false} />
        </View>
      </View>
      <Text style={styles.subtitle}>{subtitle}</Text>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  hero: { borderRadius: radius.card, borderWidth: 1, borderColor: colors.brand, padding: spacing.xl, marginBottom: spacing.lg, gap: spacing.md },
  heading: { flexDirection: 'row', alignItems: 'center', gap: spacing.lg },
  title: { ...typography.title, fontSize: 30, lineHeight: 38, flex: 1 },
  mark: { width: 64, height: 64, padding: spacing.sm, justifyContent: 'center', alignItems: 'center', borderRadius: radius.lg, borderWidth: 1, borderColor: colors.brand, backgroundColor: colors.background },
  logo: { width: '100%', height: '100%' },
  subtitle: { ...typography.body, color: colors.textMuted },
});
