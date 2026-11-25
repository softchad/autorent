import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { ReactNode } from 'react';
import { Image, ImageSourcePropType, Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, overlays, radius, spacing, typography } from '@/theme';

type Props = {
  title: string;
  // Antra eilutė po pavadinimu, pvz. „2022 · Sedanas · Vilnius“.
  subtitle: string;
  // Jau suformatuota kaina („45,00 €“) ir jos vienetas („/ diena“).
  price: string;
  priceUnit: string;
  image: ImageSourcePropType;
  onPress: () => void;
  accessibilityLabel: string;
  accessibilityHint?: string;
  // Ženklelis viršutiniame kairiajame kampe (pvz. „Laisvas pasirinktomis dienomis“).
  badge?: ReactNode;
  highlighted?: boolean;
  // Trumpa žyma viršutiniame dešiniajame kampe (pvz. „2022 · Vilnius“).
  tag?: string;
  testID?: string;
};

// Didelė automobilio kortelė: nuotrauka per visą plotą, tekstas apačioje ant tamsėjančio fono.
export function VehicleCard({ title, subtitle, price, priceUnit, image, onPress, accessibilityLabel, accessibilityHint, badge, highlighted = false, tag, testID }: Props) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityHint={accessibilityHint}
      testID={testID}
      style={({ pressed }) => [styles.card, highlighted && styles.highlighted, pressed && styles.pressed]}
    >
      <View style={styles.image}>
        <Image source={image} style={styles.fill} resizeMode="contain" accessibilityIgnoresInvertColors />
        {/* Apačioje nuotrauka užtamsinama, kad baltas tekstas būtų įskaitomas ant bet kokios nuotraukos. */}
        <LinearGradient colors={['rgba(11, 18, 31, 0.94)', 'rgba(11, 18, 31, 0.05)', 'rgba(11, 18, 31, 0.96)']} locations={[0.25, 0.6, 1]} style={styles.shade} />
        {badge ? <View style={styles.badge}>{badge}</View> : null}
        {tag ? (
          <View style={styles.tag}>
            <Text style={styles.tagText}>{tag}</Text>
          </View>
        ) : null}
        <View style={styles.heading}>
          <View style={styles.texts}>
            <Text style={styles.title} numberOfLines={1}>{title}</Text>
            <Text style={styles.subtitle} numberOfLines={1}>{subtitle}</Text>
          </View>
          <View style={styles.arrow}>
            <Ionicons name="arrow-forward" size={22} color={colors.text} />
          </View>
        </View>
        <View style={styles.bottom}>
          <View style={styles.texts}>
            <View style={styles.priceRow}>
              <Text style={styles.price}>{price}</Text>
              <Text style={styles.priceUnit}>{priceUnit}</Text>
            </View>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    height: 306,
    borderRadius: radius.card,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    marginBottom: spacing.lg,
    overflow: 'hidden',
  },
  pressed: { transform: [{ scale: 0.985 }], borderColor: colors.primary },
  highlighted: { borderColor: colors.accent },
  image: { flex: 1, justifyContent: 'flex-end' },
  fill: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, width: '100%', height: '100%' },
  heading: { position: 'absolute', top: spacing.lg, left: spacing.lg, right: spacing.lg, flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
  shade: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0 },
  badge: { position: 'absolute', top: 96, left: spacing.lg },
  tag: {
    position: 'absolute',
    bottom: spacing.lg,
    right: spacing.lg,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radius.pill,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  tagText: { ...typography.caption, color: colors.text },
  bottom: { flexDirection: 'row', alignItems: 'flex-end', padding: spacing.lg, gap: spacing.md },
  texts: { flex: 1 },
  title: { ...typography.title, fontSize: 24, lineHeight: 30 },
  subtitle: { ...typography.caption, color: colors.text, opacity: 0.86 },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: spacing.sm },
  price: { ...typography.price },
  priceUnit: { ...typography.caption, color: colors.text, opacity: 0.86 },
  // Apvali rodyklė – kortelė atidaro automobilio ekraną.
  arrow: {
    width: 52,
    height: 52,
    borderRadius: radius.pill,
    backgroundColor: overlays.glass,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
