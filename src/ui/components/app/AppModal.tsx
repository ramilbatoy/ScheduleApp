import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from '../primitives';
import { AppIcon } from './AppIcon';

export function AppModal({
  visible,
  title,
  onDismiss,
  children,
  contentStyle,
  testID,
}: {
  visible: boolean;
  title?: string;
  onDismiss: () => void;
  children: ReactNode;
  contentStyle?: StyleProp<ViewStyle>;
  testID?: string;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="slide" onRequestClose={onDismiss}>
      <View style={[styles.backdrop, { backgroundColor: p.overlay }]} testID={testID}>
        <View
          style={[
            styles.sheet,
            {
              backgroundColor: p.surface,
              paddingBottom: Math.max(insets.bottom, spacing.lg),
              borderColor: p.border,
            },
            contentStyle,
          ]}>
          <View style={styles.header}>
            {title ? (
              <AppText variant="title" style={{ flex: 1 }}>
                {title}
              </AppText>
            ) : (
              <View style={{ flex: 1 }} />
            )}
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Close"
              onPress={onDismiss}
              hitSlop={8}
              style={({ pressed }) => [styles.close, pressed && { backgroundColor: p.surfaceVariant }]}>
              <AppIcon name="close" size={22} color={p.text} />
            </Pressable>
          </View>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.md,
    maxHeight: '92%',
    gap: spacing.md,
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  close: { minWidth: 40, minHeight: 40, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
});
