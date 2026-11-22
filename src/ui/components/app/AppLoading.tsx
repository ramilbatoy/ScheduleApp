import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { spacing, useTheme } from '@/theme';
import { AppText } from '../primitives';

export function AppLoading({ label = 'Loading…' }: { label?: string }) {
  const p = useTheme();
  return (
    <View style={styles.empty} accessibilityLabel={label}>
      <ActivityIndicator color={p.primary} />
      <AppText muted>{label}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  empty: { alignItems: 'center', justifyContent: 'center', padding: spacing.xl, gap: spacing.sm, width: '100%' },
});
