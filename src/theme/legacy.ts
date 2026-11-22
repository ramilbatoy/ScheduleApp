/**
 * Back-compat exports for code that still imports palettes from `@/ui/theme`.
 * Runtime theming uses ThemeProvider + presets; these are Classic Light defaults only.
 */
import { getPreset } from './presets';
import { toAppTheme } from './colors';
import { radius, spacing, TOUCH } from './spacing';
import { type, typography } from './typography';
import type { AppTheme } from './themeTypes';

export type Palette = AppTheme;

const classic = getPreset('classic-light');

export const lightPalette: Palette = toAppTheme(classic.light, 'light', 'classic-light');
export const darkPalette: Palette = toAppTheme(classic.dark, 'dark', 'classic-light');

export { radius, spacing, TOUCH, type, typography };
