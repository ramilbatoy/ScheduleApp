import type { ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { radius, spacing, useTheme } from '@/theme';
import { AppText } from '../primitives';
import { AppButton } from './AppButton';

export function AppDialog({
  visible,
  title,
  message,
  children,
  onDismiss,
  actions,
  testID,
}: {
  visible: boolean;
  title: string;
  message?: string;
  children?: ReactNode;
  onDismiss: () => void;
  actions?: { label: string; onPress: () => void; tone?: 'primary' | 'secondary' | 'danger' | 'ghost'; testID?: string }[];
  testID?: string;
}) {
  const p = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onDismiss}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={onDismiss} testID={testID}>
        <Pressable style={[styles.dialog, { backgroundColor: p.surface }]} onPress={() => undefined} accessibilityRole="alert">
          <AppText variant="title">{title}</AppText>
          {message ? <AppText muted>{message}</AppText> : null}
          {children}
          {actions?.length ? (
            <View style={styles.actions}>
              {actions.map((a) => (
                <AppButton key={a.label} label={a.label} tone={a.tone ?? 'primary'} onPress={a.onPress} testID={a.testID} />
              ))}
            </View>
          ) : null}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
