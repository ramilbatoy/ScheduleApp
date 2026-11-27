import { Ionicons } from '@expo/vector-icons';
import { router, usePathname } from 'expo-router';
import type { ComponentProps } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/ui/hooks';

type IconName = ComponentProps<typeof Ionicons>['name'];

type FooterItem =
  | { kind: 'route'; name: 'index' | 'tasks' | 'events'; title: string; icon: IconName; iconActive: IconName }
  | { kind: 'calendar'; title: string; icon: IconName; iconActive: IconName };

/** Day / Calendar / Tasks / Events. Calendar is not a route — it focuses Month on Day. */
const FOOTER: FooterItem[] = [
  { kind: 'route', name: 'index', title: 'Day', icon: 'sunny-outline', iconActive: 'sunny' },
  { kind: 'calendar', title: 'Calendar', icon: 'calendar-outline', iconActive: 'calendar' },
  { kind: 'route', name: 'tasks', title: 'Tasks', icon: 'checkbox-outline', iconActive: 'checkbox' },
  { kind: 'route', name: 'events', title: 'Events', icon: 'ticket-outline', iconActive: 'ticket' },
];

/**
 * Shared bottom tab strip. Used by the tabs layout and stack screens (item detail)
 * that should keep the Day / Calendar / Tasks / Events footer visible.
 */
export function FooterTabBar() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const pathname = usePathname();
  const dashMode = useAppStore((s) => s.dashMode);
  const requestDayFocus = useAppStore((s) => s.requestDayFocus);
  const requestMonthFocus = useAppStore((s) => s.requestMonthFocus);
  const path = (pathname.split('?')[0].replace(/\/+$/, '') || '/').replace('/(tabs)', '') || '/';
  const onDayRoute = path === '/' || path === '/index';

  return (
    <View
      style={{
        flexDirection: 'row',
        backgroundColor: p.surface,
        borderTopColor: p.border,
        borderTopWidth: 1,
        minHeight: 64,
        paddingTop: 6,
        paddingBottom: Math.max(insets.bottom, 6),
      }}
      accessibilityRole="tablist"
      testID="footer-tabs">
      {FOOTER.map((item) => {
        const focused =
          item.kind === 'calendar'
            ? onDayRoute && dashMode === 'month'
            : item.name === 'index'
              ? onDayRoute && dashMode !== 'month'
              : path === `/${item.name}` || path.startsWith(`/${item.name}/`);
        const color = focused ? p.primary : p.textSecondary;
        const icon = focused ? item.iconActive : item.icon;
        const testID = item.kind === 'calendar' ? 'tab-calendar' : `tab-${item.name === 'index' ? 'index' : item.name}`;

        return (
          <Pressable
            key={item.kind === 'calendar' ? 'calendar' : item.name}
            testID={testID}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={item.title}
            onPress={() => {
              if (item.kind === 'calendar') {
                requestMonthFocus();
                router.navigate('/');
                return;
              }
              if (item.name === 'index') {
                requestDayFocus();
                router.navigate('/');
                return;
              }
              router.navigate(`/${item.name}` as '/tasks' | '/events');
            }}
            style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, paddingVertical: 4 }}>
            <Ionicons name={icon} color={String(color)} size={24} />
            <Text style={{ fontSize: 11, fontWeight: '600', lineHeight: 14, color: String(color) }}>{item.title}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}
