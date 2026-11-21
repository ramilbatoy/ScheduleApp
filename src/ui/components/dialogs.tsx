import { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { create } from 'zustand';

import { useTheme, useToast } from '../hooks';
import { radius, spacing } from '../theme';
import { AppText, Button } from './primitives';

export interface DialogAction<T> {
  label: string;
  value: T;
  tone?: 'primary' | 'secondary' | 'danger' | 'ghost';
}

interface DialogRequest {
  title: string;
  message?: string;
  actions: DialogAction<unknown>[];
  resolve: (v: unknown) => void;
}

const useDialogStore = create<{ current: DialogRequest | null; set(d: DialogRequest | null): void }>((set) => ({
  current: null,
  set: (current) => set({ current }),
}));

/**
 * Cross-platform choice dialog (Alert.alert has no multi-button support on web).
 * Resolves with the chosen action's value, or `null` if dismissed.
 */
export function choose<T>(title: string, message: string | undefined, actions: DialogAction<T>[]): Promise<T | null> {
  return new Promise((resolve) => {
    const prev = useDialogStore.getState().current;
    prev?.resolve(null);
    useDialogStore.getState().set({ title, message, actions: actions as DialogAction<unknown>[], resolve: resolve as (v: unknown) => void });
  });
}

export async function confirm(title: string, message: string, confirmLabel = 'Confirm', danger = false): Promise<boolean> {
  const r = await choose(title, message, [
    { label: 'Cancel', value: false, tone: 'secondary' },
    { label: confirmLabel, value: true, tone: danger ? 'danger' : 'primary' },
  ]);
  return r === true;
}

export function DialogHost() {
  const p = useTheme();
  const current = useDialogStore((s) => s.current);
  const set = useDialogStore((s) => s.set);
  const close = (v: unknown) => {
    current?.resolve(v);
    set(null);
  };
  return (
    <Modal transparent visible={!!current} animationType="fade" onRequestClose={() => close(null)}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={() => close(null)}>
        <Pressable style={[styles.dialog, { backgroundColor: p.surface }]} onPress={() => undefined} accessibilityRole="alert">
          <AppText variant="title">{current?.title ?? ''}</AppText>
          {current?.message ? <AppText muted>{current.message}</AppText> : null}
          <View style={styles.actions}>
            {current?.actions.map((a) => (
              <Button key={a.label} label={a.label} tone={a.tone ?? 'primary'} onPress={() => close(a.value)} testID={`dialog-${a.label}`} />
            ))}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function ToastHost() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const { message, tone, key, hide } = useToast();
  useEffect(() => {
    if (!message) return;
    const t = setTimeout(hide, tone === 'error' ? 5000 : 2500);
    return () => clearTimeout(t);
  }, [message, key, tone, hide]);
  if (!message) return null;
  const bg = tone === 'error' ? p.danger : tone === 'success' ? p.success : p.text;
  return (
    <View pointerEvents="box-none" style={[styles.toastWrap, { bottom: insets.bottom + 76 }]}>
      <Pressable onPress={hide} style={[styles.toast, { backgroundColor: bg }]} accessibilityLiveRegion="polite" testID="toast">
        <AppText color={p.scheme === 'dark' && tone === 'info' ? p.background : '#FFFFFF'}>{message}</AppText>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.xl },
  dialog: { borderRadius: radius.xl, padding: spacing.xl, gap: spacing.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
  toastWrap: { position: 'absolute', left: spacing.lg, right: spacing.lg, alignItems: 'center' },
  toast: { paddingHorizontal: spacing.lg, paddingVertical: spacing.md, borderRadius: radius.md, maxWidth: 520 },
});
