import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router/js-tabs';
import type { ComponentProps } from 'react';

import { AppHeader } from '@/ui/components/AppHeader';
import { useTheme } from '@/ui/hooks';

type IconName = ComponentProps<typeof Ionicons>['name'];

const TABS: { name: string; title: string; icon: IconName; iconActive: IconName }[] = [
  { name: 'index', title: 'Day', icon: 'sunny-outline', iconActive: 'sunny' },
  { name: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { name: 'tasks', title: 'Tasks', icon: 'checkbox-outline', iconActive: 'checkbox' },
  { name: 'events', title: 'Events', icon: 'ticket-outline', iconActive: 'ticket' },
];

/** Reachable from the drawer. Kept in the tabs navigator so the bar stays, but not shown as tabs. */
const HIDDEN_TABS: { name: string; title: string }[] = [
  { name: 'stats', title: 'Statistics' },
  { name: 'settings', title: 'Settings' },
  { name: 'projects', title: 'Folders' },
];

export default function TabLayout() {
  const p = useTheme();
  return (
    <Tabs
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: p.textSecondary,
        tabBarStyle: { backgroundColor: p.surface, borderTopColor: p.border, minHeight: 64, paddingTop: 6 },
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', lineHeight: 14 },
      }}>
      {TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButtonTestID: `tab-${t.name}`,
            tabBarIcon: ({ color, focused, size }) => (
              <Ionicons name={focused ? t.iconActive : t.icon} color={String(color)} size={size} />
            ),
          }}
        />
      ))}
      {/*
        Statistics, Settings, and Folders stay in the tabs navigator so the bottom bar remains,
        but they are not tab items. Reach them from the drawer (Folders, Statistics, Settings).
        Do NOT use href: null — Expo Router maps that to options.hidden and TabVisibilityRedirect
        bounces the route back to the initial Day tab.
      */}
      {HIDDEN_TABS.map((t) => (
        <Tabs.Screen
          key={t.name}
          name={t.name}
          options={{
            title: t.title,
            tabBarButton: () => null,
            tabBarItemStyle: { display: 'none', width: 0, height: 0, overflow: 'hidden' },
          }}
        />
      ))}
    </Tabs>
  );
}
