import { StyleSheet, Text, View } from 'react-native';

import { radius, typography, useTheme } from '@/theme';
import { AppIcon, type AppIconName } from './AppIcon';

export function AppBadge({
  label,
  color,
  background,
  icon,
  tone,
}: {
  label: string;
  color?: string;
  background?: string;
  icon?: AppIconName;
  /** Semantic tone when color/background omitted. */
  tone?: 'success' | 'warning' | 'error' | 'info' | 'pending' | 'completed' | 'overdue';
}) {
  const p = useTheme();
  const toneColor = tone
    ? {
        success: p.success,
        warning: p.warning,
        error: p.error,
        info: p.info,
        pending: p.pending,
        completed: p.completed,
        overdue: p.overdue,
      }[tone]
    : p.text;
  const toneBg = tone
    ? {
        success: p.successSoft,
        warning: p.warningSoft,
        error: p.errorSoft,
        info: p.infoSoft,
        pending: p.primarySoft,
        completed: p.successSoft,
        overdue: p.errorSoft,
      }[tone]
    : p.surfaceVariant;
  const fg = color ?? toneColor;
  const bg = background ?? toneBg;
  return (
    <View style={[styles.badge, { backgroundColor: bg }]}>
      {icon ? <AppIcon name={icon} size={11} color={fg} /> : null}
      <Text style={[typography.caption, { color: fg, fontWeight: '600' }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 6, paddingVertical: 2, borderRadius: radius.sm },
});
