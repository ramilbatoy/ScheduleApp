import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';

import { useTheme } from '@/theme';

export type AppIconName = ComponentProps<typeof Ionicons>['name'];

/** Single icon set wrapper (Ionicons via @expo/vector-icons — see theme-ui-audit). */
export function AppIcon({
  name,
  size = 20,
  color,
}: {
  name: AppIconName;
  size?: number;
  color?: string;
}) {
  const p = useTheme();
  return <Ionicons name={name} size={size} color={color ?? p.text} />;
}
