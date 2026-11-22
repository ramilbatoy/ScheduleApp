import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { todayKey } from '@/domain/dates';
import type { Folder } from '@/domain/models';
import { useAppStore, useServices } from '@/state/appStore';
import { AgendaFilterBar, useAgendaFilterState } from '@/ui/components/AgendaFilterBar';
import { AgendaRow, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { choose, confirm } from '@/ui/components/dialogs';
import { FolderForm } from '@/ui/components/FolderForm';
import { MenuButton } from '@/ui/components/MenuButton';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, Input, LoadingState, type IconName } from '@/ui/components/primitives';
import { useAction, useQuery, useTheme, useToast } from '@/ui/hooks';
import { goBackOrDashboard, useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

export default function FolderDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const services = useServices();
  const invalidate = useAppStore((s) => s.invalidate);
  const toast = useToast((s) => s.show);
  const run = useAction();
  useSafeAndroidBack();
  const today = todayKey(services.clock);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const filterCtl = useAgendaFilterState({ status: 'all' });
  const card = useQuery((s) => s.folders.card(id), [id]);
  const tasks = useQuery(
    (s) =>
      s.agenda.list({
        ...filterCtl.filter,
        folderId: id,
        status: filterCtl.state.status,
      }),
    [id, filterCtl.state.text, filterCtl.state.status, filterCtl.state.priority, filterCtl.state.categoryId, filterCtl.state.sort],
  );
  const folder = card.data;

  async function quickAdd() {
    const name = title.trim();
    if (!name || !folder) return;
    if (folder.status === 'archived') {
      toast('Restore this folder before adding tasks.', 'error');
      return;
    }
    const ok = await run(
      (s) =>
        s.tasks.create({
          kind: 'task',
          title: name,
          notes: '',
          categoryId: null,
          folderId: folder.id,
          priority: folder.priority,
          priorityExplicit: false,
          date: today,
          allDay: false,
          startTime: null,
          endTime: null,
          deadlineAt: null,
          reminderOffsetMinutes: null,
          deadlineReminderOffsetMinutes: null,
          recurrence: null,
        }),
      'Task added',
    );
    if (ok) {
      setTitle('');
      invalidate();
    }
  }

  async function onDelete(current: Folder) {
    const count = card.data?.taskCount ?? 0;
    if (count === 0) {
      if (!(await confirm('Delete this folder?', `"${current.name}" will be removed. It has no tasks.`, 'Delete', true))) return;
      const ok = await run((s) => s.folders.delete(current.id, { mode: 'unassign' }).then(() => true), 'Folder deleted');
      if (ok) goBackOrDashboard();
      return;
    }
    const mode = await choose<'unassign' | 'move'>(
      'Delete folder?',
      `${count} item${count === 1 ? '' : 's'} will stay on your schedule. What should happen to them?`,
      [
        { label: 'Leave unassigned', value: 'unassign', tone: 'secondary' },
        { label: 'Move to another folder', value: 'move', tone: 'primary' },
      ],
    );
    if (!mode) return;
    if (mode === 'unassign') {
      const ok = await run((s) => s.folders.delete(current.id, { mode: 'unassign' }).then(() => true), 'Folder deleted');
      if (ok) goBackOrDashboard();
      return;
    }
    const others = (await services.folders.list()).filter((f) => f.id !== current.id && f.status !== 'archived');
    if (!others.length) {
      toast('There is no other folder to move tasks into.', 'error');
      return;
    }
    const target = await choose<string>(
      'Move tasks to',
      'Pick an active folder.',
      others.map((f) => ({ label: f.name, value: f.id, tone: 'secondary' as const })),
    );
    if (!target) return;
    const ok = await run((s) => s.folders.delete(current.id, { mode: 'move', folderId: target }).then(() => true), 'Folder deleted');
    if (ok) goBackOrDashboard();
  }

  if (card.error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Folder' }} />
        <EmptyState icon="folder-open-outline" title="Not available" message={card.error} action={<Button label="Go back" tone="secondary" onPress={goBackOrDashboard} />} />
      </>
    );
  }
  if (!folder) return <LoadingState />;

  const due =
    folder.target.remainingDays === null
      ? 'No target date'
      : folder.target.overdue && folder.progress.percent < 100
        ? `${Math.abs(folder.target.remainingDays)} day${Math.abs(folder.target.remainingDays) === 1 ? '' : 's'} overdue`
        : folder.target.remainingDays === 0
          ? 'Due today'
          : `${folder.target.remainingDays} day${folder.target.remainingDays === 1 ? '' : 's'} left`;

  return (
    <>
      <Stack.Screen options={{ title: folder.name, headerRight: () => <MenuButton /> }} />
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: `${folder.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={folder.icon as IconName} color={folder.color} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="title">{folder.name}</AppText>
              {folder.description ? <AppText muted>{folder.description}</AppText> : null}
            </View>
          </View>
          <AppText variant="caption" muted>
            {folder.progress.completed} completed · {folder.progress.pending} pending · {folder.progress.overdue} overdue · {folder.progress.percent}%
            {folder.progress.events ? ` · ${folder.progress.events} events` : ''}
          </AppText>
          <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: p.surfaceVariant, overflow: 'hidden' }}>
            <View style={{ width: `${folder.progress.percent}%`, height: 8, backgroundColor: folder.color }} />
          </View>
          <AppText color={folder.target.overdue && folder.progress.percent < 100 ? p.overdue : p.textSecondary}>{due}</AppText>
          <AppText variant="caption" muted>
            Folder priority {PRIORITY_LABEL[folder.priority]}
            {folder.status !== 'active' ? ` · ${folder.status}` : ''}
          </AppText>
        </Card>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Button testID="folder-edit" label="Edit" icon="create-outline" tone="secondary" compact onPress={() => setEditing(true)} />
          {folder.status === 'archived' ? (
            <Button testID="folder-restore" label="Restore" icon="arrow-undo-outline" tone="secondary" compact onPress={() => run((s) => s.folders.restore(folder.id), 'Restored')} />
          ) : (
            <Button testID="folder-archive" label="Archive" icon="archive-outline" tone="secondary" compact onPress={() => run((s) => s.folders.archive(folder.id), 'Archived')} />
          )}
          {folder.status !== 'completed' ? (
            <Button label="Mark complete" icon="checkmark" tone="secondary" compact onPress={() => run((s) => s.folders.complete(folder.id), 'Completed')} />
          ) : (
            <Button label="Reopen" icon="refresh" tone="secondary" compact onPress={() => run((s) => s.folders.restore(folder.id), 'Reopened')} />
          )}
          <Button testID="folder-delete" label="Delete" icon="trash-outline" tone="ghost" compact onPress={() => onDelete(folder)} />
        </View>
        <Card>
          <AppText variant="label" muted>
            QUICK ADD
          </AppText>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={{ flex: 1 }}>
              <Input testID="folder-quick-title" value={title} onChangeText={setTitle} placeholder="Task title" onSubmitEditing={quickAdd} />
            </View>
            <Button testID="folder-quick-add" label="Add" icon="add" onPress={quickAdd} disabled={!title.trim() || folder.status === 'archived'} />
          </View>
          <AppText variant="caption" muted>
            New tasks inherit the folder priority until you set one. Assigned dates stay on the task.
          </AppText>
        </Card>
        <AgendaFilterBar
          testID="folder-tasks"
          state={filterCtl.state}
          onText={filterCtl.setText}
          onStatus={filterCtl.setStatus}
          onPriority={filterCtl.setPriority}
          onCategoryId={filterCtl.setCategoryId}
          onSort={filterCtl.setSort}
          matchCount={tasks.data?.length}
          searchPlaceholder="Search in this folder"
        />
        {tasks.error ? <ErrorState message={tasks.error} onRetry={tasks.reload} /> : null}
        {!tasks.data && !tasks.error ? <LoadingState /> : null}
        {tasks.data && tasks.data.length === 0 ? <AppText muted>No tasks in this folder for these filters.</AppText> : null}
        <View style={{ gap: spacing.sm }}>
          {tasks.data?.map((a, i) => (
            <AgendaRow key={a.occurrence.id} a={a} showDate testID={`folder-task-${i}`} />
          ))}
        </View>
        <Button label="Open full editor" tone="ghost" icon="options-outline" onPress={() => router.push({ pathname: '/item/edit', params: { kind: 'task', folderId: folder.id, date: today } })} />
      </ScrollView>
      <FolderForm visible={editing} folder={folder} onClose={() => setEditing(false)} onSaved={() => card.reload()} />
    </>
  );
}
