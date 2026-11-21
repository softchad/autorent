import { StyleSheet, Text, View } from 'react-native';
import { TermsSection } from '@/api/types';
import { Card } from '@/components/Card';
import { spacing, typography } from '@/theme';

type Props = {
  sections: TermsSection[];
};

// Sąlygų skyriai kaip kortelės su punktų sąrašu. Naudojama automobilio ekrane.
export function TermsSections({ sections }: Props) {
  return (
    <View>
      {sections.map((section) => (
        <Card key={section.kodas} testID={`terms-${section.kodas}`}>
          <Text style={styles.title} accessibilityRole="header">
            {section.pavadinimas}
          </Text>
          {section.punktai.map((point) => (
            <View key={point} style={styles.point}>
              <Text style={typography.body} importantForAccessibility="no" accessibilityElementsHidden>
                •
              </Text>
              <Text style={styles.pointText}>{point}</Text>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  title: { ...typography.heading, marginBottom: spacing.sm },
  point: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  pointText: { ...typography.body, flex: 1 },
});
