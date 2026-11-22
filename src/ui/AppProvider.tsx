import { router } from 'expo-router';
import { useCallback, useEffect, type ReactNode } from 'react';
import { AppState, View } from 'react-native';

import { openAppDatabase } from '../db/openDatabase';
import { AppServices } from '../domain/services/container';
import { createNotificationPort, subscribeToNotificationTaps } from '../platform/notifications';
import { useAppStore } from '../state/appStore';
import { ErrorState, LoadingState } from './components/primitives';
import { errorMessage, useTheme, useToast } from './hooks';

let opened: Promise<AppServices> | null = null;

async function openServices(): Promise<AppServices> {
  const db = await openAppDatabase();
  const services = new AppServices(db, undefined, createNotificationPort());
  const result = await services.bootstrap();
  if (result.carry.moved > 0) {
    useToast.getState().show(`${result.carry.moved} unfinished task${result.carry.moved === 1 ? '' : 's'} carried over to today`);
  }
  return services;
}

function msUntilNextMidnight(): number {
  const now = new Date();
  const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
  return next.getTime() - now.getTime();
}

/**
 * Opens + migrates local storage and runs startup maintenance before
 * rendering the app; re-runs day-boundary maintenance on resume and at midnight.
 */
export function AppProvider({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const services = useAppStore((s) => s.services);
  const p = useTheme();

  const start = useCallback(() => {
    const store = useAppStore.getState();
    store.setLoading();
    opened ??= openServices();
    opened
      .then(async (svc) => store.setReady(svc, await svc.settings.get()))
      .catch((e) => {
        opened = null;
        store.setError(errorMessage(e));
      });
  }, []);

  useEffect(start, [start]);

  useEffect(() => {
    if (!services) return;
    const maintain = () =>
      services
        .maintainIfNewDay()
        .then((r) => {
          if (!r) return;
          useAppStore.getState().invalidate();
          if (r.carry.moved > 0) useToast.getState().show(`${r.carry.moved} unfinished task${r.carry.moved === 1 ? '' : 's'} carried over to today`);
        })
        .catch((e) => useToast.getState().show(errorMessage(e), 'error'));

    const sub = AppState.addEventListener('change', (s) => {
      if (s === 'active') maintain();
    });
    let timer: ReturnType<typeof setTimeout>;
    const schedule = () => {
      timer = setTimeout(() => {
        maintain();
        schedule();
      }, msUntilNextMidnight());
    };
    schedule();
    const unsubTaps = subscribeToNotificationTaps((id) => router.push({ pathname: '/item/[id]', params: { id } }));
    return () => {
      sub.remove();
      clearTimeout(timer);
      unsubTaps();
    };
  }, [services]);

  if (status === 'ready') return <>{children}</>;
  return (
    <View style={{ flex: 1, justifyContent: 'center', backgroundColor: p.background }}>
      {status === 'error' ? (
        <ErrorState message={`Local storage could not be opened. ${error ?? ''}`} onRetry={start} />
      ) : (
        <LoadingState label="Opening your schedule…" />
      )}
    </View>
  );
}
