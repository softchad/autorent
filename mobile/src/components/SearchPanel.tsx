import { Ionicons } from '@expo/vector-icons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, MIN_TOUCH_SIZE, radius, spacing, typography } from '@/theme';
import { Button, IconName } from './Button';

type FieldProps = {
  label: string;
  value: string;
  icon: IconName;
  onPress: () => void;
  // true – reikšmė dar nepasirinkta, todėl rodoma blankiau.
  placeholder?: boolean;
  testID?: string;
};

// Vienas paieškos laukas: maža antraštė, reikšmė ir piktograma. Paspaudus atsidaro pasirinkimo langas.
function SearchField({ label, value, icon, onPress, placeholder, testID }: FieldProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      testID={testID}
      style={({ pressed }) => [styles.field, pressed && styles.fieldPressed]}
    >
      <Ionicons name={icon} size={20} color={colors.primary} />
      <View style={styles.fieldTexts}>
        <Text style={typography.label}>{label}</Text>
        <Text style={[styles.value, placeholder && styles.placeholder]} numberOfLines={1}>
          {value}
        </Text>
      </View>
    </Pressable>
  );
}

type Props = {
  locationLabel: string;
  locationValue: string;
  fromLabel: string;
  fromValue: string;
  toLabel: string;
  toValue: string;
  searchLabel: string;
  // Kurios reikšmės dar nepasirinktos.
  locationEmpty?: boolean;
  datesEmpty?: boolean;
  onPressLocation: () => void;
  onPressDates: () => void;
  onSearch: () => void;
  searching?: boolean;
};

// Paieškos skydelis: paėmimo vieta, laikotarpis ir oranžinis paieškos mygtukas.
export function SearchPanel(props: Props) {
  return (
    <View style={styles.panel} testID="search-panel">
      <SearchField
        label={props.locationLabel}
        value={props.locationValue}
        icon="location-outline"
        onPress={props.onPressLocation}
        placeholder={props.locationEmpty}
        testID="search-location"
      />
      <View style={styles.row}>
        <View style={styles.half}>
          <SearchField
            label={props.fromLabel}
            value={props.fromValue}
            icon="calendar-outline"
            onPress={props.onPressDates}
            placeholder={props.datesEmpty}
            testID="search-from"
          />
        </View>
        <View style={styles.half}>
          <SearchField
            label={props.toLabel}
            value={props.toValue}
            icon="calendar-outline"
            onPress={props.onPressDates}
            placeholder={props.datesEmpty}
            testID="search-to"
          />
        </View>
      </View>
      <Button label={props.searchLabel} onPress={props.onSearch} variant="accent" icon="search" loading={props.searching} style={styles.submit} testID="search-submit" />
    </View>
  );
}

const styles = StyleSheet.create({
  panel: {
    gap: spacing.md,
  },
  row: { flexDirection: 'row', gap: spacing.sm },
  half: { flex: 1 },
  field: {
    minHeight: MIN_TOUCH_SIZE + 24,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    backgroundColor: '#0E1525',
    borderWidth: 1,
    borderColor: colors.border,
  },
  fieldPressed: { borderColor: colors.primary },
  fieldTexts: { flex: 1 },
  value: { ...typography.bodyStrong },
  placeholder: { color: colors.textMuted },
  submit: { minHeight: 56, borderRadius: radius.md },
});
