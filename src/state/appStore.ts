import { create } from 'zustand';

import type { AppSettings } from '../domain/models';
import type { AppServices } from '../domain/services/container';

type Status = 'loading' | 'ready' | 'error';

interface AppState {
  status: Status;
  error: string | null;
  services: AppServices | null;
  settings: AppSettings | null;
  /** Bumped after every durable write so screens re-query. Cache only; never a source of truth. */
  dataVersion: number;
  setReady(services: AppServices, settings: AppSettings): void;
  setError(message: string): void;
  setLoading(): void;
  setSettings(settings: AppSettings): void;
  invalidate(): void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'loading',
  error: null,
  services: null,
  settings: null,
  dataVersion: 0,
  setReady: (services, settings) => set({ status: 'ready', services, settings, error: null }),
  setError: (message) => set({ status: 'error', error: message }),
  setLoading: () => set({ status: 'loading', error: null }),
  setSettings: (settings) => set({ settings }),
  invalidate: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
}));

export function useServices(): AppServices {
  const services = useAppStore((s) => s.services);
  if (!services) throw new Error('Services used before the database finished opening.');
  return services;
}

export function useSettings(): AppSettings {
  const settings = useAppStore((s) => s.settings);
  if (!settings) throw new Error('Settings used before load.');
  return settings;
}
