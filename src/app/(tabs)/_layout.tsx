import { Tabs } from 'expo-router/js-tabs';

import { AppHeader } from '@/ui/components/AppHeader';
import { FooterTabBar } from '@/ui/components/FooterTabBar';
import { useTheme } from '@/ui/hooks';

/** Reachable from the drawer. Kept in the tabs navigator so the bar stays, but not shown as tabs. */
const HIDDEN_TABS: { name: string; title: string }[] = [
  { name: 'stats', title: 'Statistics' },
  { name: 'settings', title: 'Settings' },
  { name: 'projects', title: 'Folders' },
  { name: 'folder/[id]', title: 'Folder' },
];

export default function TabLayout() {
  const p = useTheme();
  return (
    <Tabs
      tabBar={() => <FooterTabBar />}
      screenOptions={{
        headerShown: true,
        header: () => <AppHeader />,
        tabBarActiveTintColor: p.primary,
        tabBarInactiveTintColor: p.textSecondary,
      }}>
      <Tabs.Screen name="index" options={{ title: 'Day' }} />
      <Tabs.Screen name="tasks" options={{ title: 'Tasks' }} />
      <Tabs.Screen name="events" options={{ title: 'Events' }} />
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
