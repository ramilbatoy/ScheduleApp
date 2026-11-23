import { useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { PRIORITIES, type Priority } from '@/domain/models';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

import { AppText, Icon } from './primitives';

type Props = {
  value: Priority;
  /** When false and a folder is set, priority is inherited from the folder. */
  priorityExplicit: boolean;
  folderId: string | null;
  folderPriority?: Priority | null;
  onChange: (next: { priority: Priority; priorityExplicit: boolean }) => void;
  /** Hide the helper caption under the trigger (Quick Add compact row). */
  compact?: boolean;
  testID?: string;
};

/**
 * Compact priority picker. Levels only — no "Inherit folder" option.
 * When `priorityExplicit` is false and a folder is set, the trigger shows e.g. "High (Auto)".
 */
export function PrioritySelectDropdown({
  value,
  priorityExplicit,
  folderId,
  folderPriority,
  onChange,
  compact,
  testID = 'priority-select',
}: Props) {
  const p = useTheme();
  const [open, setOpen] = useState(false);
  const inheriting = !priorityExplicit && !!folderId;
  const effective = inheriting && folderPriority ? folderPriority : value;
  const triggerLabel = inheriting
    ? `${PRIORITY_LABEL[effective]} (Auto)`
    : PRIORITY_LABEL[effective];

  function pick(priority: Priority) {
    onChange({ priority, priorityExplicit: true });
    setOpen(false);
  }

  return (
    <View testID={testID}>
      <Pressable
        testID={`${testID}-trigger`}
        accessibilityRole="button"
        accessibilityLabel={inheriting ? `Priority: ${PRIORITY_LABEL[effective]} Auto` : `Priority: ${PRIORITY_LABEL[effective]}`}
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen(true)}
        style={[styles.trigger, { backgroundColor: p.surface, borderColor: p.border }]}>
        <Icon name="flag" size={18} color={p.priority[effective]} />
        <AppText style={{ flex: 1 }} numberOfLines={1} color={p.text}>
          {triggerLabel}
        </AppText>
        <Icon name="chevron-down" size={18} color={p.textSecondary} />
      </Pressable>
      {!compact ? (
        inheriting ? (
          <AppText variant="caption" muted testID={`${testID}-inherited`}>
            Auto from folder. Pick a level to set it on this item.
          </AppText>
        ) : (
          <AppText variant="caption" muted>
            Set on this item. It will not change when the folder priority changes.
          </AppText>
        )
      ) : null}

      <Modal transparent visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <View style={styles.fill}>
          <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={() => setOpen(false)} accessibilityLabel="Close priority picker" />
          <View style={[styles.sheet, { backgroundColor: p.surface }]} accessibilityViewIsModal>
            <AppText variant="title">Priority</AppText>
            {inheriting ? (
              <AppText variant="caption" muted>
                Currently {PRIORITY_LABEL[effective]} (Auto) from the folder.
              </AppText>
            ) : null}
            <ScrollView style={{ maxHeight: 360 }} contentContainerStyle={{ gap: 4 }}>
              {PRIORITIES.map((pr) => {
                const selected = !inheriting && value === pr;
                return (
                  <Pressable
                    key={pr}
                    testID={`${testID}-${pr}`}
                    accessibilityRole="button"
                    onPress={() => pick(pr)}
                    style={[styles.option, selected && { backgroundColor: p.primarySoft }]}>
                    <View style={[styles.dot, { backgroundColor: p.priority[pr] }]} />
                    <AppText color={selected ? p.primary : p.text}>{PRIORITY_LABEL[pr]}</AppText>
                  </Pressable>
                );
              })}
            </ScrollView>
            <Pressable accessibilityRole="button" onPress={() => setOpen(false)} style={styles.cancel}>
              <AppText color={p.primary}>Cancel</AppText>
            </Pressable>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  backdrop: { ...StyleSheet.absoluteFill },
  sheet: {
    borderRadius: radius.xl,
    padding: spacing.lg,
    gap: spacing.md,
    maxWidth: 440,
    width: '100%',
    alignSelf: 'center',
    zIndex: 1,
  },
  trigger: {
    minHeight: 48,
    borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  option: {
    minHeight: 48,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  dot: { width: 12, height: 12, borderRadius: 6 },
  cancel: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
});
