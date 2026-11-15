import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { overlays } from '@/theme';

const CELL = 36;

// Kiek linijų reikia, kad tinklelis uždengtų nurodytą ilgį.
export function gridLineCount(length: number): number {
  return Math.max(0, Math.ceil(length / CELL));
}

// Vos matomas techninis tinklelis ekrano fone (kaip svetainės paskyros puslapyje). Tik dekoracija.
export function GridBackground() {
  const { width, height } = useWindowDimensions();
  const columns = Array.from({ length: gridLineCount(width) }, (_, index) => index);
  const rows = Array.from({ length: gridLineCount(height) }, (_, index) => index);

  return (
    <View
      style={StyleSheet.absoluteFill}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      testID="grid-background"
    >
      {columns.map((index) => (
        <View key={`c${index}`} style={[styles.vertical, { left: index * CELL }]} />
      ))}
      {rows.map((index) => (
        <View key={`r${index}`} style={[styles.horizontal, { top: index * CELL }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  vertical: { position: 'absolute', top: 0, bottom: 0, width: 1, backgroundColor: overlays.gridLine },
  horizontal: { position: 'absolute', left: 0, right: 0, height: 1, backgroundColor: overlays.gridLine },
});