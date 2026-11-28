import { Ionicons } from '@expo/vector-icons';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Location } from '@/api/types';
import { SheetModal } from '@/components/SheetModal';
import { ErrorView, LoadingView } from '@/components/StateViews';
import { lt } from '@/i18n/lt';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';

type OptionProps = {
  title: string;
  subtitle?: string;
  selected: boolean;
  onPress: () => void;
  testID: string;
};

function Option({ title, subtitle, selected, onPress, testID }: OptionProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityLabel={subtitle ? `${title}, ${subtitle}` : title}
      accessibilityState={{ checked: selected }}
      testID={testID}
      style={({ pressed }) => [styles.option, selected && styles.optionSelected, pressed && styles.optionPressed]}
    >
      <Ionicons name={selected ? 'radio-button-on' : 'radio-button-off'} size={22} color={selected ? colors.primary : colors.textMuted} />
      <View style={styles.optionTexts}>
        <Text style={typography.bodyStrong}>{title}</Text>
        {subtitle ? <Text style={typography.caption}>{subtitle}</Text> : null}
      </View>
    </Pressable>
  );
}

type Props = {
  visible: boolean;
  locations: Location[];
  // Padalinių sąrašo užkrovimo būsena: nepavykęs užkrovimas nerodomas kaip tuščias sąrašas.
  status?: 'loading' | 'error' | 'success';
  onRetry?: () => void;
  // null – visi padaliniai.
  selectedId: number | null;
  onSelect: (locationId: number | null) => void;
  onClose: () => void;
};

// Paėmimo vietos pasirinkimas iš realių padalinių sąrašo. Pasirinkus lapas iškart užsidaro.
// „Visi padaliniai“ galima pasirinkti visada, net kai sąrašo užkrauti nepavyko.
export function LocationSheet({ visible, locations, status = 'success', onRetry, selectedId, onSelect, onClose }: Props) {
  return (
    <SheetModal visible={visible} tall title={lt.locationSheet.title} onClose={onClose} closeTestID="location-close" testID="location-sheet">
      <ScrollView style={styles.scroll} contentContainerStyle={styles.list} accessibilityRole="radiogroup">
        <Option title={lt.search.anyLocation} selected={selectedId === null} onPress={() => onSelect(null)} testID="location-any" />
        {status === 'loading' ? <LoadingView message={lt.locationSheet.loading} /> : null}
        {status === 'error' ? <ErrorView message={lt.locationSheet.failed} onRetry={onRetry} /> : null}
        {status === 'success' && locations.map((place) => (
          <Option
            key={place.vietos_id}
            title={place.pavadinimas}
            subtitle={place.adresas}
            selected={selectedId === place.vietos_id}
            onPress={() => onSelect(place.vietos_id)}
            testID={`location-${place.vietos_id}`}
          />
        ))}
      </ScrollView>
    </SheetModal>
  );
}

const styles = StyleSheet.create({
  scroll: { flex: 1 },
  list: { padding: spacing.lg, gap: spacing.sm },
  option: {
    minHeight: MIN_TOUCH_SIZE + 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surface,
  },
  optionSelected: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  optionPressed: { opacity: 0.85 },
  optionTexts: { flex: 1 },
});
