import { useAppStore } from '@/state/appStore';

import { IconButton } from './primitives';

/** Header control for the navigation drawer. Hidden when the drawer is turned off. */
export function MenuButton() {
  const enabled = useAppStore((s) => s.settings?.navigation.drawerEnabled ?? false);
  const open = useAppStore((s) => s.openDrawer);
  if (!enabled) return null;
  return <IconButton icon="menu" label="Open menu" onPress={open} testID="open-drawer" />;
}
