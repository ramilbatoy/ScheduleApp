import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { IconButton, Input } from './primitives';

/**
 * Shared Day / Week / Month (and folder) search field.
 * Uses a transparent Modal so the field stacks above filters, calendar, and list rows.
 * Typing still updates the filter state under the modal.
 */
export function SearchFieldPopup({
  visible,
  value,
  onChangeText,
  onClose,
  placeholder,
  testID,
}: {
  visible: boolean;
  value: string;
  onChangeText: (text: string) => void;
  onClose: () => void;
  placeholder: string;
  testID: string;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <View style={styles.root} pointerEvents="box-none" testID={`${testID}-overlay`}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss search"
          style={[styles.backdrop, { backgroundColor: p.overlay }]}
          onPress={onClose}
        />
        <View
          pointerEvents="box-none"
          style={[styles.anchor, { paddingTop: Math.max(insets.top, spacing.md) + spacing.sm }]}>
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
                clearButtonMode="while-editing"
              />
            </View>
            <IconButton icon="close" label="Close search" onPress={onClose} testID={`${testID}-close`} />
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFill },
  anchor: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: spacing.lg,
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
