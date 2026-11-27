import { create } from 'zustand';

import type { AppSettings } from '../domain/models';
import type { AppServices } from '../domain/services/container';

type Status = 'loading' | 'ready' | 'error';

/** Day tab Day|Week|Month segment. Footer Calendar focuses Month on the Day route. */
export type DashMode = 'today' | 'week' | 'month';

interface AppState {
  status: Status;
  error: string | null;
  services: AppServices | null;
  settings: AppSettings | null;
  /** Bumped after every durable write so screens re-query. Cache only; never a source of truth. */
  dataVersion: number;
  drawerOpen: boolean;
  /** UI-only Day|Week|Month focus on the Day (`index`) route. */
  dashMode: DashMode;
  /** Bumped when the Day footer tab asks to reset to today's civil date. */
  dayFocusToken: number;
  setReady(services: AppServices, settings: AppSettings): void;
  setError(message: string): void;
  setLoading(): void;
  setSettings(settings: AppSettings): void;
  invalidate(): void;
  openDrawer(): void;
  closeDrawer(): void;
  setDashMode(mode: DashMode): void;
  /** Footer Day tab: Month/Week → Day segment and jump the date strip to today. */
  requestDayFocus(): void;
  /** Footer Calendar icon: Day route with Month segment (no `/calendar` route). */
  requestMonthFocus(): void;
}

export const useAppStore = create<AppState>((set) => ({
  status: 'loading',
  error: null,
  services: null,
  settings: null,
  dataVersion: 0,
  drawerOpen: false,
  dashMode: 'today',
  dayFocusToken: 0,
  setReady: (services, settings) => set({ status: 'ready', services, settings, error: null }),
  setError: (message) => set({ status: 'error', error: message }),
  setLoading: () => set({ status: 'loading', error: null }),
  setSettings: (settings) =>
    set((s) => ({ settings, drawerOpen: settings.navigation.drawerEnabled ? s.drawerOpen : false })),
  invalidate: () => set((s) => ({ dataVersion: s.dataVersion + 1 })),
  openDrawer: () => set((s) => (s.settings?.navigation.drawerEnabled ? { drawerOpen: true } : { drawerOpen: false })),
  closeDrawer: () => set({ drawerOpen: false }),
  setDashMode: (dashMode) => set({ dashMode }),
  requestDayFocus: () => set((s) => ({ dashMode: 'today', dayFocusToken: s.dayFocusToken + 1 })),
  requestMonthFocus: () => set({ dashMode: 'month' }),
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
