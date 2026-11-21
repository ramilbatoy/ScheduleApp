import { useCallback, useEffect, type ReactNode } from 'react';
import { View } from 'react-native';

import { openAppDatabase } from '../db/openDatabase';
import { AppServices } from '../domain/services/container';
import { useAppStore } from '../state/appStore';
import { ErrorState, LoadingState } from './components/primitives';
import { errorMessage, useTheme } from './hooks';

let opened: Promise<AppServices> | null = null;

async function openServices(): Promise<AppServices> {
  const db = await openAppDatabase();
  const services = new AppServices(db);
  await services.bootstrap();
  return services;
}

/** Opens + migrates local storage and runs startup maintenance before rendering the app. */
export function AppProvider({ children }: { children: ReactNode }) {
  const status = useAppStore((s) => s.status);
  const error = useAppStore((s) => s.error);
  const p = useTheme();

  const start = useCallback(() => {
    const store = useAppStore.getState();
    store.setLoading();
    opened ??= openServices();
    opened
      .then(async (services) => store.setReady(services, await services.settings.get()))
      .catch((e) => {
        opened = null;
        store.setError(errorMessage(e));
      });
  }, []);

  useEffect(start, [start]);

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
