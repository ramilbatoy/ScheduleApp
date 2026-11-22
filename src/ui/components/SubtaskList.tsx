import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import type { SubtaskNode } from '@/domain/models';
import { countSubtasks, flattenSubtaskTree } from '@/domain/services/subtaskService';
import { confirm } from '@/ui/components/dialogs';
import { AppText, Button, Icon, Input } from '@/ui/components/primitives';
import { useAction, useTheme } from '@/ui/hooks';
import { radius, spacing, TOUCH } from '@/ui/theme';

const INDENT = 18;

export function SubtaskProgressBadge({ nodes }: { nodes: SubtaskNode[] }) {
  const p = useTheme();
  const { total, completed } = countSubtasks(nodes);
  if (!total) return null;
  return (
    <AppText variant="caption" color={completed === total ? p.success : p.textMuted}>
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
    <View style={styles.agendaNest} testID={testID}>
      {flat.map((n) => (
        <View key={n.id} style={[styles.agendaRow, { paddingLeft: spacing.md + n.depth * INDENT }]}>
          <Pressable
            testID={testID ? `${testID}-toggle-${n.id}` : undefined}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: n.completed }}
            accessibilityLabel={n.completed ? `Mark ${n.title} not done` : `Mark ${n.title} done`}
            hitSlop={6}
            onPress={() => run((s) => s.subtasks.toggleComplete(n.id))}
            style={styles.miniCheck}>
            <Icon name={n.completed ? 'checkmark-circle' : 'ellipse-outline'} size={20} color={n.completed ? p.success : p.textMuted} />
          </Pressable>
          <AppText
            variant="caption"
            numberOfLines={2}
            style={[{ flex: 1 }, n.completed && { textDecorationLine: 'line-through' }]}
            color={n.completed ? p.textMuted : p.text}>
            {n.title}
          </AppText>
        </View>
      ))}
    </View>
  );
}

/**
 * Full subtask editor for detail / edit screens: add, nest, tick, edit title/notes, delete.
 */
export function SubtaskEditor({
  occurrenceId,
  nodes,
  readOnly,
  testID = 'subtasks',
}: {
  occurrenceId: string;
  nodes: SubtaskNode[];
  readOnly?: boolean;
  testID?: string;
}) {
  const p = useTheme();
  const run = useAction();
  const [draft, setDraft] = useState('');
  const [parentId, setParentId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editNotes, setEditNotes] = useState('');
  const flat = flattenSubtaskTree(nodes);
  const { total, completed } = countSubtasks(nodes);
  const parentLabel = parentId ? flat.find((n) => n.id === parentId)?.title : null;

  async function add() {
    const title = draft.trim();
    if (!title) return;
    const ok = await run((s) => s.subtasks.add(occurrenceId, { title, parentSubtaskId: parentId }), 'Subtask added');
    if (ok) {
      setDraft('');
      setParentId(null);
    }
  }

  async function saveEdit() {
    if (!editingId) return;
    const ok = await run((s) => s.subtasks.update(editingId, { title: editTitle, notes: editNotes }), 'Subtask saved');
    if (ok) setEditingId(null);
  }

  async function remove(id: string, title: string) {
    if (!(await confirm('Delete subtask?', `"${title}" and any nested subtasks will be removed.`, 'Delete', true))) return;
    await run((s) => s.subtasks.remove(id), 'Subtask deleted');
  }

  return (
    <View style={[styles.editor, { borderColor: p.border, backgroundColor: p.surface }]} testID={testID}>
      <View style={styles.editorHeader}>
        <AppText variant="label" muted>
          SUBTASKS{total ? ` · ${completed}/${total}` : ''}
        </AppText>
      </View>

      {flat.length === 0 ? (
        <AppText muted style={{ paddingHorizontal: spacing.md, paddingBottom: spacing.sm }}>
          Break this task into smaller steps. Nest under a subtask for a third layer.
        </AppText>
      ) : null}

      {flat.map((n) => (
        <View key={n.id} style={[styles.editRow, { borderTopColor: p.border, paddingLeft: spacing.md + n.depth * INDENT }]}>
          {editingId === n.id ? (
            <View style={{ flex: 1, gap: spacing.sm, paddingVertical: spacing.sm }}>
              <Input testID={`${testID}-edit-title`} value={editTitle} onChangeText={setEditTitle} placeholder="Title" maxLength={200} />
              <Input testID={`${testID}-edit-notes`} value={editNotes} onChangeText={setEditNotes} placeholder="Details / notes" multiline />
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
                onPress={() => run((s) => s.subtasks.toggleComplete(n.id))}
                style={styles.miniCheck}
                disabled={readOnly}>
                <Icon name={n.completed ? 'checkmark-circle' : 'ellipse-outline'} size={22} color={n.completed ? p.success : p.textMuted} />
              </Pressable>
              <View style={{ flex: 1, paddingVertical: spacing.sm, gap: 2 }}>
                <AppText style={n.completed ? { textDecorationLine: 'line-through' } : undefined} color={n.completed ? p.textMuted : p.text}>
                  {n.title}
                </AppText>
                {n.notes ? (
                  <AppText variant="caption" muted numberOfLines={3}>
                    {n.notes}
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
                      setParentId(null);
                    }}
                    style={styles.iconHit}>
                    <Icon name="create-outline" size={18} color={p.textMuted} />
                  </Pressable>
                  <Pressable
                    testID={`${testID}-delete-${n.id}`}
                    accessibilityLabel={`Delete ${n.title}`}
                    hitSlop={8}
                    onPress={() => remove(n.id, n.title)}
                    style={styles.iconHit}>
                    <Icon name="trash-outline" size={18} color={p.danger} />
                  </Pressable>
                </View>
              ) : null}
            </>
          )}
        </View>
      ))}

      {!readOnly ? (
        <View style={[styles.addBlock, { borderTopColor: p.border }]}>
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
              style={{ flex: 1 }}
            />
            <Button testID={`${testID}-add`} label="Add" compact onPress={add} disabled={!draft.trim()} />
          </View>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  agendaNest: { paddingBottom: spacing.sm, gap: 2 },
  agendaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, paddingRight: spacing.md },
  miniCheck: { width: TOUCH * 0.7, height: TOUCH * 0.7, alignItems: 'center', justifyContent: 'center' },
  editor: { borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  editorHeader: { paddingHorizontal: spacing.md, paddingTop: spacing.md, paddingBottom: spacing.sm },
  editRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm, borderTopWidth: StyleSheet.hairlineWidth, paddingRight: spacing.sm },
  rowActions: { flexDirection: 'row', alignItems: 'center', paddingTop: spacing.sm },
  iconHit: { width: 32, height: 32, alignItems: 'center', justifyContent: 'center' },
  addBlock: { borderTopWidth: StyleSheet.hairlineWidth, padding: spacing.md, gap: spacing.sm },
  nestBanner: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  addRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
