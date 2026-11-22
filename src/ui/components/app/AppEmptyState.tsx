import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { AppText } from '../primitives';
import { AppIcon, type AppIconName } from './AppIcon';

export function AppEmptyState({
  icon,
  title,
  message,
  action,
}: {
  icon: AppIconName;
  title: string;
  message?: string;
  action?: ReactNode;
}) {
  const p = useTheme();
  return (
    <View style={styles.empty}>
      <AppIcon name={icon} size={36} color={p.textSecondary} />
      <AppText variant="heading" style={{ textAlign: 'center' }}>
        {title}
      </AppText>
      {message ? (
        <AppText muted style={{ textAlign: 'center' }}>
          {message}
        </AppText>
      ) : null}
      {action ? <View style={styles.action}>{action}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, width: '100%' },
  action: { alignSelf: 'center', maxWidth: '100%' },
});
