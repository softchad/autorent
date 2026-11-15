import { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useReducedMotion } from '@/hooks/useReducedMotion';
import { lt } from '@/i18n/lt';
import { colors, overlays, radius, spacing, typography } from '@/theme';
import { IconButton } from './Button';

type Props = {
  visible: boolean;
  title: string;
  onClose: () => void;
  children: ReactNode;
  // Apatinė juosta su veiksmų mygtukais (pvz. „Patvirtinti datas“).
  footer?: ReactNode;
  // true – lapas užima beveik visą ekraną (ilgam turiniui, pvz. filtrams).
  // Turinys pats nesislenka: ilgą sąrašą kviečiantis kodas turi įdėti savo ScrollView / FlatList,
  // o trumpas turinys (nepažymėjus tall) privalo tilpti į 92 % ekrano aukščio.
  tall?: boolean;
  closeTestID?: string;
  testID?: string;
};

// Iš apačios iškylantis tamsus lapas pasirinkimams: datoms, vietai, filtrams.
export function SheetModal({ visible, title, onClose, children, footer, tall = false, closeTestID, testID }: Props) {
  // Įjungus „mažinti judesį“ (arba kol nustatymas dar nenuskaitytas) lapas atsiranda be slinkimo animacijos.
  const reduced = useReducedMotion();

  return (
    <Modal visible={visible} animationType={reduced ? 'none' : 'slide'} transparent onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root}>
        {/* Paspaudus užtamsintą foną lapas uždaromas; ekrano skaitytuvui tam skirtas mygtukas „Uždaryti“. */}
        <Pressable
          style={styles.scrim}
          onPress={onClose}
          accessible={false}
          importantForAccessibility="no"
          testID={testID ? `${testID}-scrim` : undefined}
        />
        <SafeAreaView edges={['bottom']} style={[styles.sheet, tall && styles.tall]} testID={testID}>
          <View style={styles.handle} />
          <View style={styles.header}>
            <Text style={styles.title} accessibilityRole="header">
              {title}
            </Text>
            <IconButton icon="close" accessibilityLabel={lt.common.close} onPress={onClose} size={44} testID={closeTestID} />
          </View>
          <View style={tall ? styles.bodyTall : undefined}>{children}</View>
          {footer ? <View style={styles.footer}>{footer}</View> : null}
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end' },
  scrim: { position: 'absolute', top: 0, right: 0, bottom: 0, left: 0, backgroundColor: overlays.scrim },
  sheet: {
    maxHeight: '92%',
    backgroundColor: colors.surfaceAlt,
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    borderBottomWidth: 0,
    borderColor: colors.borderStrong,
  },
  tall: { height: '92%' },
  bodyTall: { flex: 1 },
  handle: {
    alignSelf: 'center',
    width: 44,
    height: 5,
    borderRadius: radius.pill,
    backgroundColor: colors.borderStrong,
    marginTop: spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    paddingBottom: spacing.sm,
    gap: spacing.md,
  },
  title: { ...typography.heading, flex: 1 },
  footer: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.lg,
    borderTopWidth: 1,
    borderTopColor: colors.border,
  },
});