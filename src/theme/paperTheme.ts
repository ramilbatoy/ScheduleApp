import { MD3DarkTheme, MD3LightTheme, type MD3Theme } from 'react-native-paper';

import type { AppTheme } from './themeTypes';

/** Map semantic tokens onto Paper MD3 without making Paper the source of truth. */
export function buildPaperTheme(theme: AppTheme): MD3Theme {
  const base = theme.scheme === 'dark' ? MD3DarkTheme : MD3LightTheme;
  return {
    ...base,
    dark: theme.scheme === 'dark',
    roundness: 10,
    colors: {
      ...base.colors,
      primary: theme.primary,
      onPrimary: theme.onPrimary,
      primaryContainer: theme.primarySoft,
      onPrimaryContainer: theme.text,
      secondary: theme.secondary,
      onSecondary: theme.onPrimary,
      secondaryContainer: theme.surfaceVariant,
      onSecondaryContainer: theme.text,
      tertiary: theme.accent,
      onTertiary: theme.onPrimary,
      tertiaryContainer: theme.surfaceVariant,
      onTertiaryContainer: theme.text,
      error: theme.error,
      onError: theme.textInverse,
      errorContainer: theme.errorSoft,
      onErrorContainer: theme.error,
      background: theme.background,
      onBackground: theme.text,
      surface: theme.surface,
      onSurface: theme.text,
      surfaceVariant: theme.surfaceVariant,
      onSurfaceVariant: theme.textSecondary,
      outline: theme.outline,
      outlineVariant: theme.border,
      shadow: theme.scheme === 'dark' ? '#000000' : '#000000',
      scrim: theme.overlay,
      inverseSurface: theme.text,
      inverseOnSurface: theme.background,
      inversePrimary: theme.primary,
      elevation: {
        ...base.colors.elevation,
        level0: theme.background,
        level1: theme.surface,
        level2: theme.surfaceVariant,
        level3: theme.surfaceVariant,
        level4: theme.surfaceVariant,
        level5: theme.surfaceVariant,
      },
    },
  };
}
