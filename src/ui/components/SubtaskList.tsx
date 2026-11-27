import { useCallback, useEffect, useRef, useState, type ComponentRef, type RefObject } from 'react';
import { Keyboard, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { combineDateTime, deadlineHasClockTime, formatDateKey, formatDeadline, formatTime, toDateKey, todayKey } from '@/domain/dates';
import type { SubtaskNode } from '@/domain/models';
import { countSubtasks, flattenSubtaskTree } from '@/domain/services/subtaskService';
import { useServices } from '@/state/appStore';
import { confirm } from '@/ui/components/dialogs';
import { DatePickerModal, TimePickerModal } from '@/ui/components/Pickers';
import { AppText, Button, Icon, Input, SelectButton } from '@/ui/components/primitives';
import { useAction, useTheme } from '@/ui/hooks';
import { radius, spacing, TOUCH } from '@/ui/theme';

const INDENT = 18;

export function SubtaskProgressBadge({ nodes }: { nodes: SubtaskNode[] }) {
  const p = useTheme();
  const { total, completed } = countSubtasks(nodes);
  if (!total) return null;
  return (
    <AppText variant="caption" color={completed === total ? p.success : p.textSecondary}>
      {completed}/{total} subtasks
    </AppText>
  );
}

/** Compact nested checklist under an agenda row (tick only; open detail to edit). */
export function AgendaSubtasks({ nodes, testID }: { nodes: SubtaskNode[]; testID?: string }) {
  const p = useTheme();
  const run = useAction();
  const flat = flattenSubtaskTree(nodes);
  if (!flat.length) return null;
  return (
    <View style={styles.agendaNest} testID={testID} accessibilityLabel="Subtasks">
      {flat.map((n) => (
        <View
          key={n.id}
          style={[
            styles.agendaRow,
            {
              paddingLeft: spacing.sm + n.depth * INDENT,
              borderLeftColor: n.depth === 0 ? p.primary : p.border,
            },
          ]}>
          <Pressable
            testID={testID ? `${testID}-toggle-${n.id}` : undefined}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: n.completed }}
            accessibilityLabel={n.completed ? `Mark ${n.title} not completed` : `Mark ${n.title} completed`}
            hitSlop={6}
            onPress={() => run((s) => s.subtasks.toggleComplete(n.id))}
            style={styles.miniCheck}>
            <Icon name={n.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={n.completed ? p.success : p.textSecondary} />
          </Pressable>
          <View style={{ flex: 1, gap: 1 }}>
            <AppText
              variant="caption"
              numberOfLines={2}
              style={n.completed ? { textDecorationLine: 'line-through' } : undefined}
              color={n.completed ? p.textSecondary : p.text}>
              {n.title}
            </AppText>
            {n.deadlineAt ? (
              <AppText variant="caption" muted numberOfLines={1}>
                Due {formatDeadline(n.deadlineAt)}
              </AppText>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

function deadlineParts(iso: string | null): { date: string | null; time: string | null } {
  if (!iso) return { date: null, time: null };
  const d = new Date(iso);
  return {
    date: toDateKey(d),
    // Midnight means “date only” — do not treat it as a set clock time.
    time: deadlineHasClockTime(iso)
      ? `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
      : null,
  };
}

/**
 * Full subtask editor for detail / edit screens: add, nest, tick, edit title/notes/deadline, delete.
 */
export function SubtaskEditor({
  occurrenceId,
  nodes,
  readOnly,
  testID = 'subtasks',
  scrollRef,
}: {
  occurrenceId: string;
  nodes: SubtaskNode[];
  readOnly?: boolean;
  testID?: string;
  /** Parent scroll view. Focusing the new-subtask field scrolls it above the keyboard. */
  scrollRef?: RefObject<ComponentRef<typeof ScrollView> | null>;
}) {
  const p = useTheme();
  const run = useAction();
  const services = useServices();
  const today = todayKey(services.clock);
  const [draft, setDraft] = useState('');
  const [draftNotes, setDraftNotes] = useState('');
  const [draftDeadline, setDraftDeadline] = useState<string | null>(null);
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const [editDeadline, setEditDeadline] = useState<string | null>(null);
  const [picker, setPicker] = useState<null | 'draftDate' | 'draftTime' | 'editDate' | 'editTime'>(null);
  const flat = flattenSubtaskTree(nodes);
  const { total, completed } = countSubtasks(nodes);
  const composerRef = useRef<ComponentRef<typeof View>>(null);
  const composerFocused = useRef(false);
  const revealComposer = useCallback(() => {
    const scroll = scrollRef?.current;
    const anchor = composerRef.current;
    if (!scroll || !anchor) return;
    if (typeof scroll.scrollResponderScrollNativeHandleToKeyboard === 'function') {
      scroll.scrollResponderScrollNativeHandleToKeyboard(anchor, 160, true);
      return;
    }
    scroll.scrollToEnd({ animated: true });
  }, [scrollRef]);
  useEffect(() => {
    const event = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const sub = Keyboard.addListener(event, () => {
      if (composerFocused.current) revealComposer();
    });
    return () => sub.remove();
  }, [revealComposer]);
  const parentLabel = parentId ? flat.find((n) => n.id === parentId)?.title : null;
  const draftParts = deadlineParts(draftDeadline);
  const editParts = deadlineParts(editDeadline);

  async function add() {
    const title = draft.trim();
    if (!title) return;
    const ok = await run(
      (s) =>
        s.subtasks.add(occurrenceId, {
          title,
          notes: draftNotes.trim() || undefined,
          parentSubtaskId: parentId,
          deadlineAt: draftDeadline,
        }),
      'Subtask added',
    );
    if (ok) {
      setDraft('');
      setDraftNotes('');
      setDraftDeadline(null);
      setParentId(null);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    const ok = await run(
      (s) => s.subtasks.update(editingId, { title: editTitle, notes: editNotes, deadlineAt: editDeadline }),
      'Subtask saved',
    );
    if (ok) setEditingId(null);
  }

  async function remove(id: string, title: string) {
    if (!(await confirm('Delete subtask?', `"${title}" and any nested subtasks will be removed.`, 'Delete', true))) return;
    await run((s) => s.subtasks.remove(id), 'Subtask deleted');
  }

  return (
    <View
      style={[styles.editor, { borderColor: p.border, backgroundColor: p.surface, borderLeftColor: p.primary }]}
      testID={testID}
      accessibilityLabel="Subtask checklist under main task">
      <View style={styles.editorHeader}>
        <AppText variant="label" muted>
          SUBTASKS{total ? ` · ${completed}/${total}` : ''}
        </AppText>
        <AppText variant="caption" muted>
          Nested under this main task
        </AppText>
      </View>

      {flat.length === 0 ? (
        <AppText muted style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          Break this task into smaller steps. Nest under a subtask for a third layer.
        </AppText>
      ) : null}

      {flat.map((n) => (
        <View
          key={n.id}
          style={[
            styles.editRow,
            {
              borderTopColor: p.border,
              paddingLeft: spacing.md + n.depth * INDENT,
              borderLeftColor: n.depth === 0 ? p.primary : p.border,
              borderLeftWidth: 2,
              backgroundColor: n.depth === 0 ? p.surfaceVariant : undefined,
            },
          ]}>
          {editingId === n.id ? (
            <View style={{ flex: 1, gap: spacing.sm, paddingVertical: spacing.sm }}>
              <Input testID={`${testID}-edit-title`} value={editTitle} onChangeText={setEditTitle} placeholder="Title" maxLength={200} />
              <Input testID={`${testID}-edit-notes`} value={editNotes} onChangeText={setEditNotes} placeholder="Details / notes" multiline />
              <View style={{ flexDirection: 'row', gap: spacing.md }}>
                <View style={{ flex: 3 }}>
                  <SelectButton
                    testID={`${testID}-edit-deadline-date`}
                    icon="hourglass-outline"
                    placeholder="No deadline"
                    value={editParts.date ? formatDateKey(editParts.date, 'MMM d, yyyy') : null}
                    onPress={() => setPicker('editDate')}
                    onClear={() => setEditDeadline(null)}
                  />
                </View>
                    {editParts.date ? (
                  <View style={{ flex: 2 }}>
                    <SelectButton
                      testID={`${testID}-edit-deadline-time`}
                      icon="time-outline"
                      placeholder="None"
                      value={editParts.time ? formatTime(editParts.time) : null}
                      onPress={() => setPicker('editTime')}
                      onClear={editParts.time ? () => editParts.date && setEditDeadline(combineDateTime(editParts.date, null).toISOString()) : undefined}
                    />
                  </View>
                ) : null}
              </View>
              <View style={{ flexDirection: 'row', gap: spacing.sm }}>
                <Button label="Cancel" tone="secondary" compact onPress={() => setEditingId(null)} style={{ flex: 1 }} />
                <Button testID={`${testID}-save-edit`} label="Save" compact onPress={saveEdit} disabled={!editTitle.trim()} style={{ flex: 1 }} />
              </View>
            </View>
          ) : (
            <>
              <Pressable
                testID={`${testID}-toggle-${n.id}`}
                accessibilityRole="checkbox"
                accessibilityState={{ checked: n.completed }}
                accessibilityLabel={n.completed ? `Mark ${n.title} not completed` : `Mark ${n.title} completed`}
                onPress={() => run((s) => s.subtasks.toggleComplete(n.id))}
                style={styles.miniCheck}
                disabled={readOnly}>
                <Icon name={n.completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={n.completed ? p.success : p.textSecondary} />
              </Pressable>
              <View style={{ flex: 1, paddingVertical: spacing.sm, gap: 2 }}>
                <AppText style={n.completed ? { textDecorationLine: 'line-through' } : undefined} color={n.completed ? p.textSecondary : p.text}>
                  {n.title}
                </AppText>
                {n.notes ? (
                  <AppText variant="caption" muted numberOfLines={3}>
                    {n.notes}
                  </AppText>
                ) : null}
                {n.deadlineAt ? (
                  <AppText variant="caption" color={p.textSecondary} testID={`${testID}-deadline-${n.id}`}>
                    Due {formatDeadline(n.deadlineAt)}
                  </AppText>
                ) : null}
              </View>
              {!readOnly ? (
                <View style={styles.rowActions}>
                  <Pressable
                    testID={`${testID}-nest-${n.id}`}
                    accessibilityLabel={`Add nested under ${n.title}`}
                    hitSlop={8}
                    onPress={() => {
                      setParentId(n.id);
                      setEditingId(null);
                    }}
                    style={styles.iconHit}>
                    <Icon name="git-branch-outline" size={18} color={p.primary} />
                  </Pressable>
                  <Pressable
                    testID={`${testID}-edit-${n.id}`}
                    accessibilityLabel={`Edit ${n.title}`}
                    hitSlop={8}
                    onPress={() => {
                      setEditingId(n.id);
                      setEditTitle(n.title);
                      setEditNotes(n.notes);
                      setEditDeadline(n.deadlineAt);
                      setParentId(null);
                    }}
                    style={styles.iconHit}>
                    <Icon name="create-outline" size={18} color={p.textSecondary} />
                  </Pressable>
                  <Pressable
                    testID={`${testID}-delete-${n.id}`}
                    accessibilityLabel={`Delete ${n.title}`}
                    hitSlop={8}
                    onPress={() => remove(n.id, n.title)}
                    style={styles.iconHit}>
                    <Icon name="trash-outline" size={18} color={p.error} />
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ))}

      {!readOnly ? (
        <View ref={composerRef} collapsable={false} style={[styles.addBlock, { borderTopColor: p.border }]}>
          {parentId ? (
            <View style={styles.nestBanner}>
              <AppText variant="caption" color={p.info} style={{ flex: 1 }}>
                Nesting under “{parentLabel}”
              </AppText>
              <Pressable onPress={() => setParentId(null)} accessibilityLabel="Cancel nesting">
                <AppText variant="caption" color={p.primary}>
                  Clear
                </AppText>
              </Pressable>
            </View>
          ) : null}
          <View style={styles.addRow}>
            <Input
              testID={`${testID}-new-title`}
              value={draft}
              onChangeText={setDraft}
              placeholder={parentId ? 'Nested subtask title' : 'Add a subtask'}
              maxLength={200}
              onSubmitEditing={add}
              onFocus={() => {
                composerFocused.current = true;
                setTimeout(revealComposer, Platform.OS === 'android' ? 280 : 80);
              }}
              onBlur={() => {
                composerFocused.current = false;
              }}
              style={{ flex: 1 }}
            />
            <Button testID={`${testID}-add`} label="Add" compact onPress={add} disabled={!draft.trim()} />
          </View>
          <Input
            testID={`${testID}-new-notes`}
            value={draftNotes}
            onChangeText={setDraftNotes}
            placeholder="Note (optional)"
            multiline
            onFocus={() => {
              composerFocused.current = true;
              setTimeout(revealComposer, Platform.OS === 'android' ? 280 : 80);
            }}
            onBlur={() => {
              composerFocused.current = false;
            }}
          />
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 3 }}>
              <SelectButton
                testID={`${testID}-new-deadline-date`}
                icon="hourglass-outline"
                placeholder="No deadline"
                value={draftParts.date ? formatDateKey(draftParts.date, 'MMM d, yyyy') : null}
                onPress={() => setPicker('draftDate')}
                onClear={() => setDraftDeadline(null)}
              />
            </View>
            {draftParts.date ? (
              <View style={{ flex: 2 }}>
                <SelectButton
                  testID={`${testID}-new-deadline-time`}
                  icon="time-outline"
                  placeholder="None"
                  value={draftParts.time ? formatTime(draftParts.time) : null}
                  onPress={() => setPicker('draftTime')}
                  onClear={draftParts.time ? () => draftParts.date && setDraftDeadline(combineDateTime(draftParts.date, null).toISOString()) : undefined}
                />
              </View>
            ) : null}
          </View>
        </View>
      ) : null}

      <DatePickerModal
        visible={picker === 'draftDate'}
        value={draftParts.date}
        today={today}
        title="Subtask deadline"
        onChange={(d) => setDraftDeadline(combineDateTime(d, draftParts.time).toISOString())}
        onClose={() => setPicker(null)}
      />
      <TimePickerModal
        visible={picker === 'draftTime'}
        value={draftParts.time}
        title="Deadline time"
        onChange={(t) => draftParts.date && setDraftDeadline(combineDateTime(draftParts.date, t).toISOString())}
        onClose={() => setPicker(null)}
      />
      <DatePickerModal
        visible={picker === 'editDate'}
        value={editParts.date}
        today={today}
        title="Subtask deadline"
        onChange={(d) => setEditDeadline(combineDateTime(d, editParts.time).toISOString())}
        onClose={() => setPicker(null)}
      />
      <TimePickerModal
        visible={picker === 'editTime'}
        value={editParts.time}
        title="Deadline time"
        onChange={(t) => editParts.date && setEditDeadline(combineDateTime(editParts.date, t).toISOString())}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  agendaNest: { paddingBottom: spacing.xs, gap: 2 },
  agendaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingRight: spacing.sm,
    paddingVertical: 2,
    borderLeftWidth: 2,
    marginVertical: 1,
  },
  miniCheck: { width: TOUCH * 0.7, height: TOUCH * 0.7, alignItems: 'center', justifyContent: 'center' },
  editor: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, borderLeftWidth: 3, overflow: 'hidden' },
  editorHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm, gap: 2 },
  editRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingRight: spacing.sm },
  rowActions: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  iconHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  nestBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
