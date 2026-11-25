import { ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { Edge, SafeAreaView } from 'react-native-safe-area-context';
import { colors, spacing } from '@/theme';
import { GridBackground } from './GridBackground';

type Props = {
  children: ReactNode;
  // false – kai ekrano turinys pats yra sąrašas (FlatList), kuris slenka savarankiškai.
  scroll?: boolean;
  // Apatinė juosta (pvz. kaina ir mygtukas), kuri lieka matoma slenkant.
  footer?: ReactNode;
  testID?: string;
  // false – kai turinys (pvz. katalogo sąrašas) pats nustato kraštų tarpus.
  padded?: boolean;
  // true – ekranas be navigacijos antraštės, todėl pats palieka vietos būsenos juostai.
  topInset?: boolean;
  bottomInset?: boolean;
  // true – fone rodomas techninis tinklelis.
  grid?: boolean;
};

// Bendras ekrano rėmas: saugios zonos, tamsus fonas ir vienodi kraštų tarpai.
export function Screen({ children, scroll = true, footer, testID, padded = true, topInset = false, bottomInset = true, grid = false }: Props) {
  const edges: Edge[] = topInset ? ['top', 'left', 'right'] : ['left', 'right'];
  if (bottomInset) edges.push('bottom');
  return (
    <SafeAreaView style={styles.safeArea} edges={edges} testID={testID}>
      {grid ? <GridBackground /> : null}
      {scroll ? (
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" indicatorStyle="white">
          {children}
        </ScrollView>
      ) : (
        <View style={[padded && styles.content, styles.fill]}>{children}</View>
      )}
      {footer ? <View style={styles.footer}>{footer}</View> : null}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1, backgroundColor: colors.background },
  content: { padding: spacing.lg },
  fill: { flex: 1 },
  footer: {
    padding: spacing.lg,
    backgroundColor: colors.surfaceAlt,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});
