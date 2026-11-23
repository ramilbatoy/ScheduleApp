import { router, usePathname } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Animated, BackHandler, Modal, PanResponder, Platform, Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { activeDrawerItem, type NavItemId } from '@/domain/navigationPrefs';
import { useAppStore } from '@/state/appStore';
import { useQuery, useTheme } from '@/ui/hooks';

import { HeaderBrand } from './AppHeader';
import { AppText, Icon, type IconName } from './primitives';
import { radius, spacing } from '../theme';

const LINKS: { id: NavItemId; label: string; icon: IconName; href: '/' | '/calendar' | '/tasks' | '/projects' | '/stats' | '/categories' | '/theme-settings' | '/settings' | '/about' }[] = [
  { id: 'today', label: 'Day', icon: 'sunny-outline', href: '/' },
  { id: 'calendar', label: 'Calendar', icon: 'calendar-outline', href: '/calendar' },
  { id: 'tasks', label: 'Tasks', icon: 'checkbox-outline', href: '/tasks' },
  { id: 'projects', label: 'Folders', icon: 'folder-outline', href: '/projects' },
  { id: 'statistics', label: 'Statistics', icon: 'stats-chart-outline', href: '/stats' },
  { id: 'categories', label: 'Categories', icon: 'pricetags-outline', href: '/categories' },
  { id: 'theme', label: 'Theme', icon: 'color-palette-outline', href: '/theme-settings' },
  { id: 'backup', label: 'Backup & Restore', icon: 'download-outline', href: '/settings' },
  { id: 'settings', label: 'Settings', icon: 'settings-outline', href: '/settings' },
  { id: 'about', label: 'About NeoOrganizer', icon: 'information-circle-outline', href: '/about' },
];

/** Left drawer. Tabs stay; this is an extra way to reach the same screens. */
export function NavDrawer() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const panelWidth = Math.min(320, Math.round(width * 0.86));
  const open = useAppStore((s) => s.drawerOpen);
  const close = useAppStore((s) => s.closeDrawer);
  const active = activeDrawerItem(usePathname());
  const settings = useAppStore((s) => s.settings);
  const progress = useQuery((s) => (open ? s.agenda.dashboard() : Promise.resolve(null)), [open]);
  const [translate] = useState(() => new Animated.Value(-panelWidth));

  const items = useMemo(() => {
    const order = settings?.navigation.order ?? [];
    return order.map((id) => LINKS.find((l) => l.id === id)).filter((l): l is (typeof LINKS)[number] => !!l);
  }, [settings?.navigation.order]);

  useEffect(() => {
    Animated.timing(translate, { toValue: open ? 0 : -panelWidth, duration: 180, useNativeDriver: true }).start();
  }, [open, panelWidth, translate]);

  useEffect(() => {
    if (!open || Platform.OS === 'web') return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => sub.remove();
  }, [open, close]);

  useEffect(() => {
    if (!open || Platform.OS !== 'web' || typeof window === 'undefined') return undefined;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, close]);

  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, g) => g.dx < -8 && Math.abs(g.dx) > Math.abs(g.dy),
        onPanResponderMove: (_, g) => {
          if (g.dx < 0) translate.setValue(Math.max(g.dx, -panelWidth));
        },
        onPanResponderRelease: (_, g) => {
          if (g.dx < -48 || g.vx < -0.4) close();
          else Animated.spring(translate, { toValue: 0, useNativeDriver: true }).start();
        },
      }),
    [close, panelWidth, translate],
  );

  if (!settings?.navigation.drawerEnabled) return null;

  const done = progress.data?.completed ?? 0;
  const total = progress.data?.total ?? 0;

  function go(href: (typeof LINKS)[number]['href']) {
    close();
    router.navigate(href);
  }

  return (
    <Modal visible={open} transparent animationType="none" onRequestClose={close} statusBarTranslucent accessibilityViewIsModal>
      <View style={styles.fill}>
        <Animated.View
          {...pan.panHandlers}
          accessibilityRole="menu"
          style={[
            styles.panel,
            {
              width: panelWidth,
              backgroundColor: p.surface,
              paddingTop: insets.top + spacing.md,
              paddingBottom: insets.bottom + spacing.md,
              transform: [{ translateX: translate }],
            },
          ]}>
          <View style={styles.headerRow}>
            <View style={{ flex: 1, gap: 2 }}>
              <HeaderBrand testID="drawer-brand" />
              <AppText variant="caption" muted>
                Offline-first. Stays on this device.
              </AppText>
            </View>
            <Pressable accessibilityRole="button" accessibilityLabel="Close menu" onPress={close} hitSlop={8} testID="close-drawer" style={styles.close}>
              <Icon name="close" size={22} />
            </Pressable>
          </View>
          {progress.data ? (
            <AppText variant="caption" muted testID="drawer-today-progress">
              Today {done} of {total} done
            </AppText>
          ) : null}
          <View style={{ gap: spacing.xs }}>
            {items.map((item) => {
              const selected = item.id === active;
              return (
                <Pressable
                  key={item.id}
                  testID={`drawer-${item.id}`}
                  accessibilityRole="menuitem"
                  accessibilityState={{ selected }}
                  accessibilityLabel={item.label}
                  onPress={() => go(item.href)}
                  style={({ pressed }) => [
                    styles.item,
                    {
                      backgroundColor: selected ? p.primarySoft : pressed ? p.surfaceVariant : 'transparent',
                      borderRadius: radius.md,
                    },
                  ]}>
                  <Icon name={item.icon} color={selected ? p.primary : p.textSecondary} />
                  <AppText color={selected ? p.primary : undefined} style={selected ? { fontWeight: '700' } : undefined}>
                    {item.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Animated.View>
        <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={close} accessibilityLabel="Close menu" accessibilityRole="button" />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, flexDirection: 'row' },
  panel: { paddingHorizontal: spacing.lg, gap: spacing.md, zIndex: 2 },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  item: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingHorizontal: spacing.sm },
  backdrop: { flex: 1 },
});
