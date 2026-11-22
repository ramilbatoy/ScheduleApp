import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { EditScope } from '@/domain/services/taskService';
import { ItemForm } from '@/ui/screens/ItemForm';

import { useTheme } from '../hooks';
import { radius, spacing } from '../theme';
import { IconButton } from './primitives';

/** Full-screen modal hosting the shared ItemForm for in-place edit from month cells. */
export function TaskEditModal({
  occurrenceId,
  scope,
  visible,
  onClose,
}: {
  occurrenceId: string | null;
  scope: EditScope;
  visible: boolean;
  onClose: () => void;
}) {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  if (!visible || !occurrenceId) return null;
  return (
    <Modal visible animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose} testID="task-edit-modal">
      <View style={[styles.root, { backgroundColor: p.background, paddingTop: insets.top, paddingBottom: insets.bottom }]}>
        <View style={[styles.header, { borderBottomColor: p.border }]}>
          <Pressable style={{ width: 44 }} />
          <View style={{ flex: 1 }} />
          <IconButton icon="close" label="Close" onPress={onClose} testID="task-edit-close" />
        </View>
        <ItemForm key={`${occurrenceId}:${scope}`} params={{ id: occurrenceId, scope }} embedded onDone={onClose} />
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
  },
});
