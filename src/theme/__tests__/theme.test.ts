import {
  contrastOk,
  contrastRatio,
  isValidHex,
  normalizeHex,
  sanitizeCustomColors,
} from '../colors';
import { DEFAULT_PRESET_ID, getPreset, THEME_PRESETS } from '../presets';
import { resolveScheme, resolveTheme } from '../resolveTheme';

describe('theme colors helpers', () => {
  it('validates and normalizes HEX', () => {
    expect(isValidHex('#4F46E5')).toBe(true);
    expect(isValidHex('#abc')).toBe(true);
    expect(isValidHex('nope')).toBe(false);
    expect(normalizeHex('#abc')).toBe('#AABBCC');
    expect(normalizeHex('  #4f46e5 ')).toBe('#4F46E5');
    expect(normalizeHex('bad')).toBeNull();
  });

  it('computes contrast', () => {
    expect(contrastRatio('#000000', '#FFFFFF')).toBeGreaterThan(20);
    expect(contrastOk('#111827', '#FFFFFF')).toBe(true);
    expect(contrastOk('#EEEEEE', '#FFFFFF')).toBe(false);
  });

  it('sanitizes custom color maps', () => {
    expect(sanitizeCustomColors({ primary: '#4F46E5', junk: '#000' })).toEqual({ primary: '#4F46E5' });
    expect(sanitizeCustomColors({ primary: 'nope' })).toBeNull();
    expect(sanitizeCustomColors(null)).toBeNull();
  });
});

describe('theme presets', () => {
  it('ships 10 named presets with light and dark palettes', () => {
    expect(THEME_PRESETS).toHaveLength(10);
    for (const preset of THEME_PRESETS) {
      expect(preset.light.primary).toMatch(/^#/);
      expect(preset.dark.primary).toMatch(/^#/);
      expect(preset.light.background).not.toBe(preset.dark.background);
      expect(preset.light.overdue).toBeTruthy();
      expect(preset.dark.completed).toBeTruthy();
    }
    expect(getPreset('missing').id).toBe(DEFAULT_PRESET_ID);
  });
});

describe('resolveTheme', () => {
  it('follows system / light / dark appearance', () => {
    expect(resolveScheme('system', 'dark')).toBe('dark');
    expect(resolveScheme('light', 'dark')).toBe('light');
    expect(resolveScheme('dark', 'light')).toBe('dark');
  });

  it('applies custom color overrides on the active scheme', () => {
    const theme = resolveTheme({
      appearance: 'light',
      systemScheme: 'dark',
      presetId: 'ocean-blue',
      customColors: { primary: '#FF0000', overdue: '#00FF00' },
    });
    expect(theme.scheme).toBe('light');
    expect(theme.presetId).toBe('ocean-blue');
    expect(theme.primary).toBe('#FF0000');
    expect(theme.overdue).toBe('#00FF00');
    expect(theme.danger).toBe(theme.error);
    expect(theme.textMuted).toBe(theme.textSecondary);
    expect(theme.surfaceAlt).toBe(theme.surfaceVariant);
  });
});
