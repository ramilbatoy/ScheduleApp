import { useEffect, useState, type ReactNode } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { APP_HEADER_NAME, displayLogo, logoDataUri } from '@/domain/branding';
import { useAppStore } from '@/state/appStore';
import { useTheme } from '@/ui/hooks';
import { goBackOrDashboard } from '@/ui/navigation';
import { spacing } from '@/ui/theme';

import { MenuButton } from './MenuButton';
import { AppText, IconButton } from './primitives';

/** Content row under the status bar. Logo height stays inside this. */
export const APP_HEADER_ROW = 56;
const LOGO_HEIGHT = 32;
const LOGO_MAX_WIDTH = 168;

/** Name or logo, never both. A bad image falls back to the name. */
export function HeaderBrand({ testID = 'header-brand' }: { testID?: string }) {
  const branding = useAppStore((s) => s.settings?.branding);
  const logo = displayLogo(branding);
  const uri = logo ? logoDataUri(logo) : null;
  const [failed, setFailed] = useState(false);
  const [ratio, setRatio] = useState<number | null>(null);

  useEffect(() => {
    setFailed(false);
    setRatio(null);
  }, [uri]);

  if (!uri || failed) {
    return (
      <AppText variant="title" numberOfLines={1} style={styles.name} testID={`${testID}-name`}>
        {APP_HEADER_NAME}
      </AppText>
    );
  }

  const width = ratio ? Math.min(LOGO_MAX_WIDTH, Math.max(LOGO_HEIGHT, LOGO_HEIGHT * ratio)) : LOGO_HEIGHT;
  return (
    <Image
      testID={`${testID}-logo`}
      accessible
      accessibilityRole="image"
      accessibilityLabel={APP_HEADER_NAME}
      source={{ uri }}
      resizeMode="contain"
      onError={() => setFailed(true)}
      onLoad={(e) => {
        const w = e.nativeEvent.source?.width;
        const h = e.nativeEvent.source?.height;
        if (w > 0 && h > 0) setRatio(w / h);
      }}
      style={{ height: LOGO_HEIGHT, width, maxWidth: LOGO_MAX_WIDTH }}
    />
  );
}

/**
 * One header for the tab navigator and the root stack.
 * Hamburger, then the brand. Back sits on the right so the brand stays next to the menu.
 */
export function AppHeader({ showBack = false, right }: { showBack?: boolean; right?: ReactNode }) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View
      testID="app-header"
      accessibilityRole="header"
      style={{ backgroundColor: p.surface, borderBottomColor: p.border, borderBottomWidth: StyleSheet.hairlineWidth }}>
      <View style={{ height: insets.top }} />
      <View style={styles.row}>
        <MenuButton />
        <HeaderBrand />
        <View style={{ flex: 1 }} />
        {right}
        {showBack ? <IconButton icon="chevron-back" label="Back" color={p.text} onPress={goBackOrDashboard} testID="header-back" /> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    height: APP_HEADER_ROW,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    overflow: 'hidden',
  },
  name: { flexShrink: 1 },
});
