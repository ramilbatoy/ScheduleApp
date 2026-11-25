import { Platform, type TextStyle } from 'react-native';

/** Android includes extra font padding that clips label text inside tight buttons/chips. */
const androidText: TextStyle = Platform.OS === 'android' ? { includeFontPadding: false } : {};

export const typography = {
  display: { fontSize: 18, fontWeight: '700' as const, lineHeight: 24, ...androidText },
  title: { fontSize: 16, fontWeight: '700' as const, lineHeight: 22, ...androidText },
  heading: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22, ...androidText },
  body: { fontSize: 15, fontWeight: '400' as const, lineHeight: 21, ...androidText },
  label: { fontSize: 13, fontWeight: '600' as const, lineHeight: 18, ...androidText },
  caption: { fontSize: 12, fontWeight: '400' as const, lineHeight: 16, ...androidText },
};

/** AppHeader / drawer brand stays larger than the global title token. */
export const BRAND_TITLE: TextStyle = { fontSize: 20, fontWeight: '700', lineHeight: 26, ...androidText };

/** @deprecated Prefer `typography` — kept for existing `type.*` imports. */
export const type = typography;
