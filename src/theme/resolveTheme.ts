import type { AppearanceMode } from './themeTypes';
import { applyCustomColors, toAppTheme } from './colors';
import { DEFAULT_PRESET_ID, getPreset, isThemePresetId } from './presets';
import type { AppTheme, CustomColors, ThemePresetId, ThemeSnapshot } from './themeTypes';

export function resolveScheme(appearance: AppearanceMode, system: 'light' | 'dark' | null | undefined): 'light' | 'dark' {
  if (appearance === 'light' || appearance === 'dark') return appearance;
  return system === 'dark' ? 'dark' : 'light';
}

export function resolveTheme(opts: {
  appearance: AppearanceMode;
  systemScheme: 'light' | 'dark' | null | undefined;
  presetId?: string | null;
  customColors?: CustomColors | null;
}): AppTheme {
  const presetId: ThemePresetId = isThemePresetId(opts.presetId) ? opts.presetId : DEFAULT_PRESET_ID;
  const preset = getPreset(presetId);
  const scheme = resolveScheme(opts.appearance, opts.systemScheme);
  const base = scheme === 'dark' ? preset.dark : preset.light;
  const colors = applyCustomColors(base, opts.customColors, scheme);
  return toAppTheme(colors, scheme, presetId);
}

export function snapshotEquals(a: ThemeSnapshot | null | undefined, b: ThemeSnapshot | null | undefined): boolean {
  if (!a && !b) return true;
  if (!a || !b) return false;
  return (
    a.presetId === b.presetId &&
    a.appearance === b.appearance &&
    JSON.stringify(a.customColors ?? null) === JSON.stringify(b.customColors ?? null)
  );
}
