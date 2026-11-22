import { useCallback, useEffect, useRef, useState } from 'react';
import { useColorScheme } from 'react-native';
import { create } from 'zustand';

import type { AppServices } from '../domain/services/container';
import { useAppStore } from '../state/appStore';
import { darkPalette, lightPalette, type Palette } from './theme';

export function useTheme(): Palette {
  const system = useColorScheme();
  const pref = useAppStore((s) => s.settings?.theme ?? 'system');
  const scheme = pref === 'system' ? (system === 'dark' ? 'dark' : 'light') : pref;
  return scheme === 'dark' ? darkPalette : lightPalette;
}

export interface QueryState<T> {
  data: T | undefined;
  error: string | null;
  loading: boolean;
  reload: () => void;
}

/** Runs `fn` against the services and re-runs whenever data changes or `deps` change. */
export function useQuery<T>(fn: (s: AppServices) => Promise<T>, deps: unknown[]): QueryState<T> {
  const services = useAppStore((s) => s.services);
  const version = useAppStore((s) => s.dataVersion);
  const [state, setState] = useState<{ data: T | undefined; error: string | null; loading: boolean }>({
    data: undefined,
    error: null,
    loading: true,
  });
  const [nonce, setNonce] = useState(0);
  const fnRef = useRef(fn);
  fnRef.current = fn;

  useEffect(() => {
    if (!services) return;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fnRef
      .current(services)
      .then((data) => !cancelled && setState({ data, error: null, loading: false }))
      .catch((e: unknown) => !cancelled && setState({ data: undefined, error: errorMessage(e), loading: false }));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [services, version, nonce, ...deps]);

  const reload = useCallback(() => setNonce((n) => n + 1), []);
  return { ...state, reload };
}

export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  return String(e);
}

interface ToastState {
  message: string | null;
  tone: 'info' | 'error' | 'success';
  key: number;
  show(message: string, tone?: 'info' | 'error' | 'success'): void;
  hide(): void;
}

export const useToast = create<ToastState>((set) => ({
  message: null,
  tone: 'info',
  key: 0,
  show: (message, tone = 'info') => set((s) => ({ message, tone, key: s.key + 1 })),
  hide: () => set({ message: null }),
}));

/**
 * Wraps a write: runs it, invalidates cached queries, and surfaces failures
 * as a toast instead of throwing into the render tree.
 */
export function useAction() {
  const services = useAppStore((s) => s.services);
  const invalidate = useAppStore((s) => s.invalidate);
  const show = useToast((s) => s.show);
  return useCallback(
    async <T>(fn: (s: AppServices) => Promise<T>, success?: string): Promise<T | undefined> => {
      if (!services) return undefined;
      try {
        const result = await fn(services);
        invalidate();
        if (success) show(success, 'success');
        return result;
      } catch (e) {
        show(errorMessage(e), 'error');
        invalidate();
        return undefined;
      }
    },
    [services, invalidate, show],
  );
}
