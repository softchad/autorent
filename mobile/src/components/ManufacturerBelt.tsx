import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, fonts, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { brandKey } from '@/theme/images';
import { BRAND_LOGO_PATHS } from './brandLogos';

type ItemProps = {
  label: string;
  // SVG kelias; jei markės ženklo neturime, rodomas tik visas pavadinimas (be inicialų ir be tuščio apskritimo).
  logoPath?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
};

function BeltItem({ label, logoPath, selected, onPress, testID }: ItemProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected }}
      testID={testID}
      style={[styles.item, selected && styles.circleSelected]}
    >
      {logoPath ? <View style={styles.circle}>
        <Svg width={24} height={24} viewBox="0 0 24 24">
          <Path d={logoPath} fill={selected ? colors.textOnBrand : colors.text} />
        </Svg>
      </View> : null}
      <Text style={[styles.label, selected && styles.labelSelected]} numberOfLines={1}>
        {label}
      </Text>
    </Pressable>
  );
}

type Props = {
  // Markės iš realaus automobilių sąrašo.
  brands: string[];
  // null – pasirinkta „Visi“.
  selected: string | null;
  onSelect: (brand: string | null) => void;
  allLabel: string;
};

// Horizontaliai slenkama gamintojų juosta; paspaudus markę katalogas filtruojamas pagal ją.
export function ManufacturerBelt({ brands, selected, onSelect, allLabel }: Props) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.container} contentContainerStyle={styles.belt} testID="manufacturer-belt">
      <BeltItem label={allLabel} selected={selected === null} onPress={() => onSelect(null)} testID="brand-all" />
      {brands.map((brand) => (
        <BeltItem
          key={brand}
          label={brand}
          logoPath={BRAND_LOGO_PATHS[brandKey(brand)]}
          selected={selected === brand}
          // Antras tos pačios markės paspaudimas filtrą išjungia.
          onPress={() => onSelect(selected === brand ? null : brand)}
          testID={`brand-${brandKey(brand)}`}
        />
      ))}
    </ScrollView>
  );
}

const CIRCLE = 24;

const styles = StyleSheet.create({
  container: { marginHorizontal: spacing.lg, borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border, backgroundColor: '#0E1525' },
  belt: { gap: spacing.xs, padding: spacing.sm },
  item: { minHeight: Math.max(46, MIN_TOUCH_SIZE), flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingHorizontal: spacing.md, borderRadius: radius.md, borderWidth: 1, borderColor: 'transparent', backgroundColor: '#0E1525' },
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: radius.pill,
    backgroundColor: 'transparent',
    borderWidth: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  circleSelected: { backgroundColor: colors.brand, borderColor: colors.brand, borderWidth: 1 },
  label: { ...typography.caption, fontSize: 12, lineHeight: 16 },
  // Tekstas ant colors.brand fono: textOnBrand duoda ~7:1, o colors.primary tik ~4:1 (per mažai 12 px tekstui).
  labelSelected: { color: colors.textOnBrand, fontFamily: fonts.semibold },
});
