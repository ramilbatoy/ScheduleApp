import type { AppTheme } from './themeTypes';
import { useThemeContext } from './ThemeProvider';

/** Resolved semantic theme (colors + legacy aliases). Prefer this over hardcoded hex. */
export function useTheme(): AppTheme {
  return useThemeContext().theme;
}
