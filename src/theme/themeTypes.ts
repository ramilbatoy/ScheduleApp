import type { Priority } from '../domain/models';

/** Appearance preference persisted in app_settings.theme */
export type AppearanceMode = 'system' | 'light' | 'dark';

export type ThemePresetId =
  | 'ocean-blue'
  | 'midnight-navy'
  | 'emerald-green'
  | 'forest-green'
  | 'purple'
  | 'sunset-orange'
  | 'rose-pink'
  | 'minimal-gray'
  | 'classic-light'
  | 'dark-mode';

/** Editable semantic color keys (custom theme editor). */
export type CustomColorKey =
  | 'primary'
  | 'secondary'
  | 'accent'
  | 'background'
  | 'surface'
  | 'surfaceVariant'
  | 'text'
  | 'textSecondary'
  | 'border'
  | 'outline'
  | 'success'
  | 'warning'
  | 'error'
  | 'info'
  | 'completed'
  | 'pending'
  | 'overdue'
  | 'disabled';

export type CustomColors = Partial<Record<CustomColorKey, string>>;

export const CUSTOM_COLOR_KEYS: CustomColorKey[] = [
  'primary',
  'secondary',
  'accent',
  'background',
  'surface',
  'surfaceVariant',
  'text',
  'textSecondary',
  'border',
  'outline',
  'success',
  'warning',
  'error',
  'info',
  'completed',
  'pending',
  'overdue',
  'disabled',
];

export interface SemanticColors {
  primary: string;
  secondary: string;
  accent: string;
  background: string;
  surface: string;
  surfaceVariant: string;
  text: string;
  textSecondary: string;
  border: string;
  outline: string;
  success: string;
  warning: string;
  error: string;
  info: string;
  completed: string;
  pending: string;
  overdue: string;
  disabled: string;
  /** Derived / helper tokens */
  onPrimary: string;
  primarySoft: string;
  successSoft: string;
  warningSoft: string;
  errorSoft: string;
  infoSoft: string;
  overlay: string;
  textInverse: string;
  priority: Record<Priority, string>;
}

/**
 * Resolved runtime theme. Includes semantic names plus legacy aliases so
 * existing screens (`danger`, `textMuted`, `surfaceAlt`) keep compiling
 * while migrating to the new vocabulary.
 */
export interface AppTheme extends SemanticColors {
  scheme: 'light' | 'dark';
  presetId: ThemePresetId;
  /** Legacy aliases */
  danger: string;
  dangerSoft: string;
  textMuted: string;
  surfaceAlt: string;
}

export interface ThemeSnapshot {
  presetId: ThemePresetId;
  customColors: CustomColors | null;
  appearance: AppearanceMode;
}

export interface ThemePreset {
  id: ThemePresetId;
  name: string;
  /** Swatch shown in the picker (usually light primary). */
  swatch: string;
  light: SemanticColors;
  dark: SemanticColors;
}
