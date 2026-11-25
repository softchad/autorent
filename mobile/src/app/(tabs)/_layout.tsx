import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ComponentProps } from 'react';
import { ColorValue, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { lt } from '@/i18n/lt';
import { colors, fonts } from '@/theme';

type IconName = ComponentProps<typeof Ionicons>['name'];

// Aktyvaus skirtuko piktograma užpildyta, neaktyvaus – tik kontūras (būsena matoma ne vien iš spalvos).
function tabIcon(active: IconName, inactive: IconName) {
  return ({ color, size, focused }: { color: ColorValue; size: number; focused: boolean }) => (
    <Ionicons name={focused ? active : inactive} color={color as string} size={size} />
  );
}

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const bottom = Math.max(insets.bottom, 12);
  return (
    <Tabs
      safeAreaInsets={{ bottom: 0 }}
      screenOptions={{
        // Kiekvienas skirtukas turi savo antraštę ekrane, todėl navigacijos antraštė nerodoma.
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.text,
        tabBarActiveBackgroundColor: 'rgba(15, 89, 123, 0.65)',
        tabBarStyle: [styles.bar, { bottom }],
        tabBarBackground: () => (
          <LinearGradient
            colors={['rgba(15, 89, 123, 0.78)', 'rgba(11, 18, 31, 0.84)']}
            style={styles.glass}
            pointerEvents="none"
          />
        ),
        tabBarItemStyle: styles.item,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 11, paddingBottom: 7 },
        sceneStyle: { backgroundColor: colors.background, paddingBottom: bottom + 84 },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: lt.tabs.cars, tabBarIcon: tabIcon('car-sport', 'car-sport-outline'), tabBarButtonTestID: 'tab-cars', sceneStyle: { backgroundColor: colors.background, paddingBottom: 0 } }}
      />
      <Tabs.Screen
        name="rezervacijos"
        options={{
          title: lt.tabs.reservations,
          tabBarIcon: tabIcon('calendar', 'calendar-outline'),
          tabBarButtonTestID: 'tab-reservations',
        }}
      />
      <Tabs.Screen
        name="zinutes"
        options={{ title: lt.tabs.messages, tabBarIcon: tabIcon('chatbubbles', 'chatbubbles-outline'), tabBarButtonTestID: 'tab-messages' }}
      />
      <Tabs.Screen
        name="paskyra"
        options={{ title: lt.tabs.account, tabBarIcon: tabIcon('person', 'person-outline'), tabBarButtonTestID: 'tab-account' }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  bar: {
    position: 'absolute',
    start: 16,
    end: 16,
    height: 72,
    borderRadius: 32,
    borderTopWidth: 0,
    backgroundColor: 'transparent',
    paddingHorizontal: 5,
    paddingVertical: 5,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.25,
    shadowRadius: 14,
    elevation: 8,
  },
  glass: {
    position: 'absolute',
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    borderRadius: 32,
    borderWidth: 1,
    borderColor: colors.brand,
  },
  item: { borderRadius: 27, paddingTop: 5 },
});
