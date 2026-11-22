import { createContext, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { PaperProvider } from 'react-native-paper';

import { useAppStore } from '../state/appStore';
import { buildPaperTheme } from './paperTheme';
import { DEFAULT_PRESET_ID } from './presets';
import { resolveTheme } from './resolveTheme';
import type { AppearanceMode, AppTheme, CustomColors, ThemePresetId, ThemeSnapshot } from './themeTypes';

interface ThemeContextValue {
  theme: AppTheme;
  appearance: AppearanceMode;
  presetId: ThemePresetId;
  customColors: CustomColors | null;
  /** Non-null while Theme Settings is previewing unsaved edits. */
  preview: ThemeSnapshot | null;
  setPreview: (snapshot: ThemeSnapshot | null) => void;
  paperTheme: ReturnType<typeof buildPaperTheme>;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

/**
 * Resolves the active semantic theme from persisted settings (+ optional
 * preview override), then feeds Paper MD3 from those tokens.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const system = useColorScheme();
  const settings = useAppStore((s) => s.settings);
  const [preview, setPreview] = useState<ThemeSnapshot | null>(null);

  const appearance: AppearanceMode = preview?.appearance ?? settings?.theme ?? 'system';
  const presetId: ThemePresetId =
    (preview?.presetId as ThemePresetId | undefined) ??
    (settings?.themePreset as ThemePresetId | undefined) ??
    DEFAULT_PRESET_ID;
  const customColors: CustomColors | null =
    preview !== null ? preview.customColors : (settings?.themeCustomColors ?? null);

  const theme = useMemo(
    () =>
      resolveTheme({
        appearance,
        systemScheme: system === 'dark' ? 'dark' : 'light',
        presetId,
        customColors,
      }),
    [appearance, system, presetId, customColors],
  );

  const paperTheme = useMemo(() => buildPaperTheme(theme), [theme]);

  const value = useMemo(
    () => ({
      theme,
      appearance,
      presetId: theme.presetId,
      customColors,
      preview,
      setPreview,
      paperTheme,
    }),
    [theme, appearance, customColors, preview, paperTheme],
  );

  return (
    <ThemeContext.Provider value={value}>
      <PaperProvider theme={paperTheme}>{children}</PaperProvider>
    </ThemeContext.Provider>
  );
}

export function useThemeContext(): ThemeContextValue {
  const ctx = useContext(ThemeContext);
  if (!ctx) {
    // Fallback for rare cases outside provider (tests / early splash).
    const fallback = resolveTheme({ appearance: 'system', systemScheme: 'light', presetId: DEFAULT_PRESET_ID });
    return {
      theme: fallback,
      appearance: 'system',
      presetId: DEFAULT_PRESET_ID,
      customColors: null,
      preview: null,
      setPreview: () => undefined,
      paperTheme: buildPaperTheme(fallback),
    };
  }
  return ctx;
}
