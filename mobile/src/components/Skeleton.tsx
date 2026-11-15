import { useEffect, useRef } from 'react';
import {
  Animated,
  DimensionValue,
  StyleSheet,
  View,
} from 'react-native';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { colors, radius, spacing } from '@/theme';

type Props = {
  width?: DimensionValue;
  height: number;
  borderRadius?: number;
};

// Būsimo turinio vieta, kol kraunami duomenys.
export function Skeleton({
  width = '100%',
  height,
  borderRadius = radius.md,
}: Props) {
  const reduced = useReducedMotion();
  const opacity = useRef(new Animated.Value(0.55)).current;

  useEffect(() => {
    if (reduced) {
      opacity.setValue(0.55);
      return;
    }

    const animation = Animated.loop(
      Animated.sequence([
        Animated.timing(opacity, {
          toValue: 1,
          duration: 700,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 0.55,
          duration: 700,
          useNativeDriver: true,
        }),
      ]),
    );

    animation.start();

    return () => animation.stop();
  }, [opacity, reduced]);

  // Tik dekoracija: ekrano skaitytuvui reikšminga tik viso krovimo būsenos žinutė.
  return (
    <Animated.View
      style={[
        styles.block,
        { width, height, borderRadius, opacity },
      ]}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    />
  );
}

// Kelių kortelių vietos katalogo ar rezervacijų sąrašui.
// cardHeight perduokite pagal naudojimo vietą (pvz. VehicleCard aukštį), kad turiniui atsiradus sąrašas nešokinėtų.
export function CardListSkeleton({
  count = 3,
  cardHeight = 264,
  label,
}: {
  count?: number;
  cardHeight?: number;
  label: string;
}) {
  return (
    <View
      style={styles.list}
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={label}
      testID="loading-view"
    >
      {Array.from({ length: count }, (_, index) => (
        <Skeleton
          key={index}
          height={cardHeight}
          borderRadius={radius.card}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  block: {
    backgroundColor: colors.surface,
  },
  list: {
    padding: spacing.lg,
    gap: spacing.lg,
  },
});