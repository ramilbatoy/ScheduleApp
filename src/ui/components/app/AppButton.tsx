import { ActivityIndicator, Pressable, StyleSheet, type StyleProp, type ViewStyle } from 'react-native';

import { radius, spacing, TOUCH, useTheme } from '@/theme';
import { AppText } from '../primitives';
import { AppIcon, type AppIconName } from './AppIcon';

type Tone = 'primary' | 'secondary' | 'danger' | 'ghost';

export function AppButton({
  label,
  onPress,
  tone = 'primary',
  icon,
  disabled,
  loading,
  style,
  testID,
  compact,
}: {
  label: string;
  onPress: () => void;
  tone?: Tone;
  icon?: AppIconName;
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
  testID?: string;
  compact?: boolean;
}) {
  const p = useTheme();
  const bg = { primary: p.primary, secondary: p.surfaceVariant, danger: p.error, ghost: 'transparent' }[tone];
  const fg = { primary: p.onPrimary, secondary: p.text, danger: p.onPrimary, ghost: p.primary }[tone];
  return (
    <Pressable
      testID={testID}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        compact && styles.compact,
        { backgroundColor: bg, opacity: disabled ? 0.5 : pressed ? 0.8 : 1 },
        style,
      ]}>
      {loading ? <ActivityIndicator color={fg} /> : icon ? <AppIcon name={icon} size={18} color={fg} /> : null}
      <AppText variant="label" color={fg} numberOfLines={1} style={styles.label}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: TOUCH,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    overflow: 'visible',
  },
  compact: { minHeight: 40, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  label: { flexShrink: 0, textAlign: 'center' },
});
