import { Image, ImageSourcePropType, StyleSheet, Text, View } from 'react-native';
import { colors, overlays, radius, spacing, typography } from '@/theme';

type Props = {
  title: string;
  subtitle: string;
  price: string;
  priceUnit: string;
  image: ImageSourcePropType;
  testID?: string;
};

// Maža permatoma automobilio kortelė, „plūduriuojanti“ virš žemėlapio kairiajame apatiniame kampe.
export function FloatingCarSummary({ title, subtitle, price, priceUnit, image, testID }: Props) {
  return (
    <View style={styles.card} accessible accessibilityLabel={`${title}. ${subtitle}. ${price} ${priceUnit}`} testID={testID}>
      <Image source={image} style={styles.image} resizeMode="cover" accessibilityIgnoresInvertColors />
      <View style={styles.texts}>
        <Text style={styles.title} numberOfLines={1}>
          {title}
        </Text>
        <Text style={typography.caption} numberOfLines={1}>
          {subtitle}
        </Text>
        <View style={styles.priceRow}>
          <Text style={styles.price}>{price}</Text>
          <Text style={typography.caption}>{priceUnit}</Text>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    width: '100%',
    padding: spacing.sm,
    paddingRight: spacing.lg,
    borderRadius: radius.lg + 4,
    backgroundColor: overlays.glass,
    borderWidth: 1,
    borderColor: overlays.glassBorder,
  },
  image: { width: '40%', height: 100, borderRadius: radius.lg, backgroundColor: colors.surface },
  texts: { flexShrink: 1 },
  title: { ...typography.bodyStrong },
  priceRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.xs, marginTop: 2 },
  price: { ...typography.bodyStrong, color: colors.primary },
});