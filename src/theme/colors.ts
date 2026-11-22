import type { Priority } from '../domain/models';
import type { AppTheme, CustomColorKey, CustomColors, SemanticColors, ThemePresetId } from './themeTypes';
import { CUSTOM_COLOR_KEYS } from './themeTypes';

const HEX = /^#([0-9A-Fa-f]{6}|[0-9A-Fa-f]{3})$/;

export function isValidHex(value: string): boolean {
  return HEX.test(value.trim());
}

/** Normalize `#abc` → `#AABBCC`; returns null if invalid. */
export function normalizeHex(value: string): string | null {
  const v = value.trim();
  if (!HEX.test(v)) return null;
  if (v.length === 4) {
    const r = v[1]!;
    const g = v[2]!;
    const b = v[3]!;
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }
  return v.toUpperCase();
}

function parseRgb(hex: string): { r: number; g: number; b: number } | null {
  const n = normalizeHex(hex);
  if (!n) return null;
  return {
    r: parseInt(n.slice(1, 3), 16),
    g: parseInt(n.slice(3, 5), 16),
    b: parseInt(n.slice(5, 7), 16),
  };
}

/** Relative luminance 0–1 (sRGB). */
export function relativeLuminance(hex: string): number {
  const rgb = parseRgb(hex);
  if (!rgb) return 0;
  const lin = [rgb.r, rgb.g, rgb.b].map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * lin[0]! + 0.7152 * lin[1]! + 0.0722 * lin[2]!;
}

/** WCAG contrast ratio between two hex colors. */
export function contrastRatio(fg: string, bg: string): number {
  const a = relativeLuminance(fg);
  const b = relativeLuminance(bg);
  const lighter = Math.max(a, b);
  const darker = Math.min(a, b);
  return (lighter + 0.05) / (darker + 0.05);
}

export function contrastOk(fg: string, bg: string, min = 4.5): boolean {
  return contrastRatio(fg, bg) >= min;
}

export function pickOnColor(bg: string, light = '#FFFFFF', dark = '#0D111C'): string {
  return relativeLuminance(bg) > 0.45 ? dark : light;
}

function clampByte(n: number): number {
  return Math.max(0, Math.min(255, Math.round(n)));
}

function toHex(r: number, g: number, b: number): string {
  return `#${[r, g, b].map((c) => clampByte(c).toString(16).padStart(2, '0')).join('').toUpperCase()}`;
}

/** Mix toward white (light) or black (dark) for soft surfaces. */
export function softVariant(hex: string, scheme: 'light' | 'dark', amount = 0.85): string {
  const rgb = parseRgb(hex);
  if (!rgb) return hex;
  if (scheme === 'light') {
    return toHex(rgb.r + (255 - rgb.r) * amount, rgb.g + (255 - rgb.g) * amount, rgb.b + (255 - rgb.b) * amount);
  }
  return toHex(rgb.r * (1 - amount * 0.7), rgb.g * (1 - amount * 0.7), rgb.b * (1 - amount * 0.7));
}

export function defaultPriority(scheme: 'light' | 'dark'): Record<Priority, string> {
  return scheme === 'light'
    ? { low: '#64748B', medium: '#2563EB', high: '#D97706', urgent: '#DC2626' }
    : { low: '#94A3B8', medium: '#60A5FA', high: '#FBBF24', urgent: '#F87171' };
}

export function withDerived(base: Omit<SemanticColors, 'onPrimary' | 'primarySoft' | 'successSoft' | 'warningSoft' | 'errorSoft' | 'infoSoft' | 'overlay' | 'textInverse' | 'priority'> & Partial<Pick<SemanticColors, 'onPrimary' | 'primarySoft' | 'successSoft' | 'warningSoft' | 'errorSoft' | 'infoSoft' | 'overlay' | 'textInverse' | 'priority'>>, scheme: 'light' | 'dark'): SemanticColors {
  return {
    ...base,
    onPrimary: base.onPrimary ?? pickOnColor(base.primary),
    primarySoft: base.primarySoft ?? softVariant(base.primary, scheme),
    successSoft: base.successSoft ?? softVariant(base.success, scheme),
    warningSoft: base.warningSoft ?? softVariant(base.warning, scheme),
    errorSoft: base.errorSoft ?? softVariant(base.error, scheme),
    infoSoft: base.infoSoft ?? softVariant(base.info, scheme),
    overlay: base.overlay ?? (scheme === 'light' ? 'rgba(15, 23, 42, 0.45)' : 'rgba(0, 0, 0, 0.6)'),
    textInverse: base.textInverse ?? pickOnColor(base.text, '#FFFFFF', '#0D111C'),
    priority: base.priority ?? defaultPriority(scheme),
  };
}

export function applyCustomColors(base: SemanticColors, custom: CustomColors | null | undefined, scheme: 'light' | 'dark'): SemanticColors {
  if (!custom) return base;
  const next = { ...base };
  for (const key of CUSTOM_COLOR_KEYS) {
    const raw = custom[key];
    if (!raw) continue;
    const hex = normalizeHex(raw);
    if (!hex) continue;
    next[key] = hex;
  }
  return withDerived(next, scheme);
}

export function toAppTheme(colors: SemanticColors, scheme: 'light' | 'dark', presetId: ThemePresetId): AppTheme {
  return {
    ...colors,
    scheme,
    presetId,
    danger: colors.error,
    dangerSoft: colors.errorSoft,
    textMuted: colors.textSecondary,
    surfaceAlt: colors.surfaceVariant,
  };
}

export function sanitizeCustomColors(input: unknown): CustomColors | null {
  if (!input || typeof input !== 'object') return null;
  const out: CustomColors = {};
  let any = false;
  for (const key of CUSTOM_COLOR_KEYS) {
    const v = (input as Record<string, unknown>)[key];
    if (typeof v !== 'string') continue;
    const hex = normalizeHex(v);
    if (!hex) continue;
    out[key] = hex;
    any = true;
  }
  return any ? out : null;
}

export function customColorLabel(key: CustomColorKey): string {
  const labels: Record<CustomColorKey, string> = {
    primary: 'Primary',
    secondary: 'Secondary',
    accent: 'Accent',
    background: 'Background',
    surface: 'Surface',
    surfaceVariant: 'Surface variant',
    text: 'Text',
    textSecondary: 'Secondary text',
    border: 'Border',
    outline: 'Outline',
    success: 'Success',
    warning: 'Warning',
    error: 'Error',
    info: 'Info',
    completed: 'Completed',
    pending: 'Pending',
    overdue: 'Overdue',
    disabled: 'Disabled',
  };
  return labels[key];
}
