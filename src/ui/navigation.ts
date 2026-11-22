import { router, useFocusEffect } from 'expo-router';
import { useCallback } from 'react';
import { BackHandler, Platform } from 'react-native';

/** Today tab (main dashboard). */
export const DASHBOARD_HREF = '/' as const;

/**
 * Pop one screen when the stack has history; otherwise replace to the Today dashboard.
 * Never dispatch an unhandled GO_BACK.
 */
export function goBackOrDashboard(): void {
  if (router.canGoBack()) {
    router.back();
    return;
  }
  router.replace(DASHBOARD_HREF);
}

/** Android hardware back → same safe path as the header back control. */
export function useSafeAndroidBack(): void {
  useFocusEffect(
    useCallback(() => {
      if (Platform.OS !== 'android') return undefined;
      const sub = BackHandler.addEventListener('hardwareBackPress', () => {
        goBackOrDashboard();
        return true;
      });
      return () => sub.remove();
    }, []),
  );
}
