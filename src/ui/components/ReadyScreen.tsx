import type { ReactNode } from 'react';
import { View } from 'react-native';

import { useAppStore } from '@/state/appStore';
import { LoadingState } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';

/**
 * Root Stack / tabs stay mounted while storage opens. Gate any screen that
 * calls `useServices()` / `useSettings()` so first paint cannot throw.
 */
export function ReadyScreen({ children, testID = 'ready-screen' }: { children: ReactNode; testID?: string }) {
  const ready = useAppStore((s) => s.status === 'ready');
  const p = useTheme();
  if (!ready) {
    return (
      <View style={{ flex: 1, backgroundColor: p.background, justifyContent: 'center' }} testID={testID}>
        <LoadingState label="Opening your schedule…" />
      </View>
    );
  }
  return <>{children}</>;
}
