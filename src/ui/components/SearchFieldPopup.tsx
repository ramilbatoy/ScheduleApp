import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View, type LayoutRectangle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { IconButton, Input } from './primitives';

/**
 * Inline search field anchored to the search icon (not a top-of-screen banner).
 * The trailing control clears typed text; tap outside dismisses.
 */
export function SearchFieldPopup({
  visible,
  value,
  onChangeText,
  onClose,
  placeholder,
  testID,
  /** Screen coords of the search icon; field opens beside/over it. */
  anchor,
}: {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  placeholder: string;
  testID: string;
  anchor?: LayoutRectangle | null;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const [winW, setWinW] = useState(360);

  const fieldWidth = Math.min(320, Math.max(220, (anchor?.width ?? 0) + 200));
  const left = (() => {
    if (!anchor) return spacing.lg;
    // Prefer aligning the field’s right edge near the icon so it doesn’t spill off-screen.
    const preferred = anchor.x + anchor.width - fieldWidth;
    return Math.max(spacing.md, Math.min(preferred, winW - fieldWidth - spacing.md));
  })();
  const top = (() => {
    if (!anchor) return Math.max(insets.top, spacing.md) + spacing.sm;
    // Sit just under the icon row when possible; clamp below the status bar.
    return Math.max(insets.top + spacing.xs, anchor.y + anchor.height + 4);
  })();

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View
        style={styles.root}
        pointerEvents="box-none"
        testID={`${testID}-overlay`}
        onLayout={(e) => {
          const w = e.nativeEvent.layout.width;
          if (w > 0) setWinW(w);
        }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss search"
          style={styles.backdrop}
          onPress={onClose}
        />
        <View
          pointerEvents="box-none"
          style={[styles.anchor, { top, left, width: fieldWidth }]}>
          <View
            style={[
              styles.field,
              {
                backgroundColor: p.surface,
                borderColor: p.border,
              },
            ]}>
            <View style={{ flex: 1 }}>
              <Input
                testID={testID}
                value={value}
                onChangeText={onChangeText}
                placeholder={placeholder}
                autoFocus
                clearButtonMode="never"
              />
            </View>
            <IconButton
              icon="close-circle"
              label="Clear search"
              onPress={() => onChangeText('')}
              testID={`${testID}-clear`}
              color={value ? p.textSecondary : p.border}
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill, backgroundColor: 'transparent' },
  anchor: {
    position: 'absolute',
    zIndex: 1,
  },
  field: {
    flexDirection: 'row',
    gap: spacing.sm,
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: spacing.sm,
    elevation: 12,
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 4 },
  },
});
