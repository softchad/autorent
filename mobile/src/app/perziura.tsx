import { Redirect, Stack } from 'expo-router';
import { ReactNode, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Badge } from '@/components/Badge';
import { Button, IconButton } from '@/components/Button';
import { Card } from '@/components/Card';
import { Chip } from '@/components/Chip';
import { ExpandableSheet } from '@/components/ExpandableSheet';
import { FloatingCarSummary } from '@/components/FloatingCarSummary';
import { GridBackground } from '@/components/GridBackground';
import { ManufacturerBelt } from '@/components/ManufacturerBelt';
import { ReservationBar } from '@/components/ReservationBar';
import { Screen } from '@/components/Screen';
import { SearchPanel } from '@/components/SearchPanel';
import { Skeleton } from '@/components/Skeleton';
import { EmptyView, ErrorView } from '@/components/StateViews';
import { TextField } from '@/components/TextField';
import { VehicleCard } from '@/components/VehicleCard';
import { lt } from '@/i18n/lt';
import { colors, radius, spacing, typography } from '@/theme';
import { getCarPhoto } from '@/theme/images';
import { formatDateCompact, formatMoney } from '@/utils/format';

// PAVYZDINIAI DUOMENYS – tik dizaino peržiūrai. Tikri automobiliai į šį ekraną nekraunami.
const SAMPLE_BRANDS = ['Toyota', 'BMW', 'Audi', 'Tesla', 'Volkswagen'];
const SAMPLE_CARS = [
  { id: 1, brand: 'BMW', model: 'X5', details: '2023 · Visureigis · Vilnius', price: 89 },
  { id: 2, brand: 'Tesla', model: 'Model 3', details: '2024 · Sedanas · Kaunas', price: 75 },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <Text style={typography.label}>{title}</Text>
      {children}
    </View>
  );
}

// Dizaino sistemos peržiūra: visi bendri komponentai viename ekrane. Pasiekiama tik kūrimo režimu.
export default function DesignPreviewScreen() {
  const [brand, setBrand] = useState<string | null>(null);
  const [chip, setChip] = useState('price_asc');
  const [text, setText] = useState('');

  if (!__DEV__) {
    return <Redirect href="/" />;
  }
  const preview = lt.preview;
  const car = SAMPLE_CARS[0];

  return (
    <Screen testID="screen-preview">
      <Stack.Screen options={{ title: preview.title }} />
      <Badge label={preview.note} tone="warning" testID="preview-note" />

      <Section title={preview.search}>
        <SearchPanel
          locationLabel={lt.search.location}
          locationValue="Vilnius Centras"
          fromLabel={lt.search.from}
          fromValue={formatDateCompact('2026-10-31')}
          toLabel={lt.search.to}
          toValue={formatDateCompact('2026-11-04')}
          searchLabel={lt.search.submit}
          onPressLocation={() => {}}
          onPressDates={() => {}}
          onSearch={() => {}}
        />
      </Section>

      <Section title={lt.brands.title}>
        <View style={styles.bleed}>
          <ManufacturerBelt brands={SAMPLE_BRANDS} selected={brand} onSelect={setBrand} allLabel={lt.brands.all} />
        </View>
      </Section>

      <Section title={preview.cards}>
        {SAMPLE_CARS.map((item) => (
          <VehicleCard
            key={item.id}
            title={`${item.brand} ${item.model}`}
            subtitle={item.details}
            price={formatMoney(item.price)}
            priceUnit={lt.vehicle.perDay}
            image={getCarPhoto(item.brand)}
            onPress={() => {}}
            accessibilityLabel={`${item.brand} ${item.model}`}
            badge={item.id === 1 ? <Badge label={preview.sampleBadge} tone="success" /> : undefined}
          />
        ))}
      </Section>

      <Section title={preview.map}>
        {/* Žemėlapio vietoje – tinklelis: tikras žemėlapis atsiranda automobilio ekrane. */}
        <View style={styles.mapMock}>
          <GridBackground />
          <IconButton icon="chevron-back" accessibilityLabel={lt.common.back} onPress={() => {}} variant="glass" style={styles.mapBack} />
          <View style={styles.mapSummary}>
            <FloatingCarSummary
              title={`${car.brand} ${car.model}`}
              subtitle={car.details}
              price={formatMoney(car.price)}
              priceUnit={lt.vehicle.perDay}
              image={getCarPhoto(car.brand)}
            />
          </View>
          <ExpandableSheet
            header={<Text style={styles.sheetTitle}>{`${car.brand} ${car.model}`}</Text>}
            collapsedHeight={96}
            expandedHeight={300}
            expandLabel={lt.vehicle.expand}
            collapseLabel={lt.vehicle.collapse}
            testID="preview-sheet"
          >
            <Text style={typography.body}>{preview.sheetBody}</Text>
          </ExpandableSheet>
        </View>
        <ReservationBar label={lt.vehicle.reserveNow} price={formatMoney(car.price)} priceUnit={lt.vehicle.perDay} onPress={() => {}} />
      </Section>

      <Section title={preview.controls}>
        <Button label={lt.search.submit} onPress={() => {}} variant="accent" icon="search" />
        <Button label={lt.common.confirm} onPress={() => {}} />
        <Button label={lt.common.cancel} onPress={() => {}} variant="secondary" />
        <Button label={lt.common.close} onPress={() => {}} variant="ghost" />
        <View style={styles.row}>
          {(['price_asc', 'price_desc', 'newest'] as const).map((key) => (
            <Chip key={key} label={preview.chips[key]} selected={chip === key} onPress={() => setChip(key)} />
          ))}
        </View>
        <View style={styles.row}>
          <Badge label={preview.badges.success} tone="success" />
          <Badge label={preview.badges.warning} tone="warning" />
          <Badge label={preview.badges.danger} tone="danger" />
          <Badge label={preview.badges.info} tone="info" />
        </View>
        <TextField label={preview.field} value={text} onChangeText={setText} hint={preview.fieldHint} />
      </Section>

      <Section title={preview.states}>
        <Skeleton height={72} borderRadius={radius.lg} />
        <Card>
          <EmptyView title={preview.emptyTitle} message={preview.emptyMessage} />
        </Card>
        <Card>
          <ErrorView message={preview.errorMessage} onRetry={() => {}} />
        </Card>
      </Section>
    </Screen>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: spacing.xl, gap: spacing.md },
  // Juosta slenka nuo ekrano krašto iki krašto, todėl panaikinamas ekrano kraštų tarpas.
  bleed: { marginHorizontal: -spacing.lg },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  mapMock: {
    height: 420,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceAlt,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  mapBack: { position: 'absolute', top: spacing.lg, left: spacing.lg },
  mapSummary: { position: 'absolute', left: spacing.lg, bottom: 112 },
  sheetTitle: { ...typography.heading, paddingHorizontal: spacing.lg },
});