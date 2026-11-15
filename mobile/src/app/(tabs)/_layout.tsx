import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';
import { ComponentProps } from 'react';
import { ColorValue } from 'react-native';
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
  return (
    <Tabs
      screenOptions={{
        // Kiekvienas skirtukas turi savo antraštę ekrane, todėl navigacijos antraštė nerodoma.
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textMuted,
        tabBarStyle: { backgroundColor: colors.surfaceAlt, borderTopColor: colors.border, borderTopWidth: 1 },
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        sceneStyle: { backgroundColor: colors.background },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{ title: lt.tabs.cars, tabBarIcon: tabIcon('car-sport', 'car-sport-outline'), tabBarButtonTestID: 'tab-cars' }}
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
        name="paskyra"
        options={{ title: lt.tabs.account, tabBarIcon: tabIcon('person', 'person-outline'), tabBarButtonTestID: 'tab-account' }}
      />
    </Tabs>
  );
}