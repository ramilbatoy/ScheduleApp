import { Platform, type TextStyle } from 'react-native';

import type { Priority } from '../domain/models';

/** Android includes extra font padding that clips label text inside tight buttons/chips. */
const androidText: TextStyle = Platform.OS === 'android' ? { includeFontPadding: false } : {};

export interface Palette {
  scheme: 'light' | 'dark';
  background: string;
  surface: string;
  surfaceAlt: string;
  border: string;
  text: string;
  textMuted: string;
  textInverse: string;
  primary: string;
  primarySoft: string;
  onPrimary: string;
  success: string;
  successSoft: string;
  warning: string;
  warningSoft: string;
  danger: string;
  dangerSoft: string;
  info: string;
  infoSoft: string;
  overlay: string;
  priority: Record<Priority, string>;
}

export const lightPalette: Palette = {
  scheme: 'light',
  background: '#F5F6FA',
  surface: '#FFFFFF',
  surfaceAlt: '#EEF0F6',
  border: '#E1E4EC',
  text: '#111827',
  textMuted: '#5B6475',
  textInverse: '#FFFFFF',
  primary: '#4F46E5',
  primarySoft: '#E8E7FD',
  onPrimary: '#FFFFFF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#DC2626',
  dangerSoft: '#FEE2E2',
  info: '#0369A1',
  infoSoft: '#E0F2FE',
  overlay: 'rgba(15, 23, 42, 0.45)',
  priority: { low: '#64748B', medium: '#2563EB', high: '#D97706', urgent: '#DC2626' },
};

export const darkPalette: Palette = {
  scheme: 'dark',
  background: '#0D111C',
  surface: '#161C2B',
  surfaceAlt: '#1F2738',
  border: '#2A3346',
  text: '#E8EBF2',
  textMuted: '#9AA4B8',
  textInverse: '#0D111C',
  primary: '#8B85FF',
  primarySoft: '#2A2853',
  onPrimary: '#0D111C',
  success: '#4ADE80',
  successSoft: '#123222',
  warning: '#FBBF24',
  warningSoft: '#3A2C0B',
  danger: '#F87171',
  dangerSoft: '#3D1717',
  info: '#38BDF8',
  infoSoft: '#0C2C3F',
  overlay: 'rgba(0, 0, 0, 0.6)',
  priority: { low: '#94A3B8', medium: '#60A5FA', high: '#FBBF24', urgent: '#F87171' },
};

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24, xxl: 32 } as const;
export const radius = { sm: 6, md: 10, lg: 14, xl: 20, pill: 999 } as const;

export const type = {
  display: { fontSize: 28, fontWeight: '700' as const, lineHeight: 34, ...androidText },
  title: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26, ...androidText },
  heading: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22, ...androidText },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21, ...androidText },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18, ...androidText },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, ...androidText },
};

/** Minimum touch target per Android accessibility guidance. */
export const TOUCH = 48;
