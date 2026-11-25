import { router, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { todayKey } from '@/domain/dates';
import { PRIORITIES, type Folder, type Priority } from '@/domain/models';
import type { SortKey, StatusFilter } from '@/domain/services/agendaService';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import {
  AGENDA_SORT_OPTIONS,
  AGENDA_STATUS_OPTIONS,
  useAgendaFilterState,
} from '@/ui/components/AgendaFilterBar';
import { AgendaRow, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { CompactFilterToolbar } from '@/ui/components/CompactFilterToolbar';
import { choose, confirm } from '@/ui/components/dialogs';
import { FolderForm } from '@/ui/components/FolderForm';
import { OptionsModal, Sheet } from '@/ui/components/Pickers';
import { type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, IconButton, Input, LoadingState, type IconName } from '@/ui/components/primitives';
import { useAction, useQuery, useTheme, useToast } from '@/ui/hooks';
import { goBackOrDashboard, useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

type FolderPicker = 'status' | 'priority' | 'category' | 'sort';

export default function FolderDetailScreen() {
  const { id, focus } = useLocalSearchParams<{ id: string; focus?: string }>();
  const focusId = typeof focus === 'string' ? focus : undefined;
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const listTop = useRef(0);
  const p = useTheme();
  const services = useServices();
  const settings = useSettings();
  const invalidate = useAppStore((s) => s.invalidate);
  const toast = useToast((s) => s.show);
  const run = useAction();
  useSafeAndroidBack();
  const today = todayKey(services.clock);
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState('');
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [picker, setPicker] = useState<FolderPicker | null>(null);
  const [layout, setLayout] = useState<ListLayout>('grid');
  const filterCtl = useAgendaFilterState({ status: 'all' });
  const card = useQuery((s) => s.folders.card(id), [id]);
  const categories = useQuery((s) => s.categories.list(), []);
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
  const category = categories.data?.find((c) => c.id === filterCtl.state.categoryId);
  const statusLabel = AGENDA_STATUS_OPTIONS.find((s) => s.value === filterCtl.state.status)?.label ?? 'All';
  const statuses = AGENDA_STATUS_OPTIONS.filter((s) => s.value !== 'upcoming');

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
      <View style={{ flex: 1, backgroundColor: p.background, padding: spacing.lg }}>
        <EmptyState icon="folder-open-outline" title="Not available" message={card.error} action={<Button label="Go back" tone="secondary" onPress={goBackOrDashboard} />} />
      </View>
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
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView ref={scrollRef} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 120 }}>
        <Card>
          <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
            <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: `${folder.color}22`, alignItems: 'center', justifyContent: 'center' }}>
              <Icon name={folder.icon as IconName} color={folder.color} />
            </View>
            <View style={{ flex: 1 }}>
              <AppText variant="title" testID="folder-name">
                {folder.name}
              </AppText>
              {folder.description ? <AppText muted>{folder.description}</AppText> : null}
            </View>
            <IconButton testID="folder-options" icon="ellipsis-horizontal" label="Folder options" onPress={() => setOptionsOpen(true)} />
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

        {settings.showFolderQuickAdd ? (
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
        ) : null}

        <CompactFilterToolbar
          testID="folder-tasks"
          searchValue={filterCtl.state.text}
          searchOpen={searchOpen}
          onSearchOpenChange={setSearchOpen}
          onSearchChange={filterCtl.setText}
          searchPlaceholder="Search in this folder"
          filtersOpen={filtersOpen}
          onFiltersOpenChange={setFiltersOpen}
          layout={layout}
          onLayoutChange={setLayout}
          filterRows={[
            {
              testID: 'folder-filter-status',
              icon: 'filter-outline',
              label: 'Status',
              value: statusLabel,
              onPress: () => setPicker('status'),
            },
            {
              testID: 'folder-filter-priority',
              icon: 'flag',
              label: 'Priority',
              value: filterCtl.state.priority ? PRIORITY_LABEL[filterCtl.state.priority] : 'Any',
              onPress: () => setPicker('priority'),
            },
            {
              testID: 'folder-filter-category',
              icon: 'pricetag-outline',
              label: 'Category',
              value: category?.name ?? 'Any',
              onPress: () => setPicker('category'),
            },
            {
              testID: 'folder-filter-sort',
              icon: 'swap-vertical',
              label: 'Sort',
              value: AGENDA_SORT_OPTIONS.find((s) => s.value === filterCtl.state.sort)?.label ?? 'Date',
              onPress: () => setPicker('sort'),
            },
          ]}
        />

        {typeof tasks.data?.length === 'number' ? (
          <AppText variant="caption" muted>
            {tasks.data.length} match{tasks.data.length === 1 ? '' : 'es'}
          </AppText>
        ) : null}

        {tasks.error ? <ErrorState message={tasks.error} onRetry={tasks.reload} /> : null}
        {!tasks.data && !tasks.error ? <LoadingState /> : null}
        {tasks.data && tasks.data.length === 0 ? <AppText muted>No tasks in this folder for these filters.</AppText> : null}
        <View
          style={layout === 'grid' ? styles.grid : { gap: spacing.sm }}
          onLayout={(e) => {
            listTop.current = e.nativeEvent.layout.y;
          }}>
          {tasks.data?.map((a, i) => {
            const highlighted = focusId === a.occurrence.id;
            return (
              <View
                key={a.occurrence.id}
                style={[layout === 'grid' ? styles.gridCell : undefined, highlighted ? { borderWidth: 2, borderColor: p.primary, borderRadius: radius.md } : undefined]}
                onLayout={(e) => {
                  if (!highlighted) return;
                  scrollRef.current?.scrollTo({ y: Math.max(0, listTop.current + e.nativeEvent.layout.y - spacing.md), animated: false });
                }}>
                <AgendaRow a={a} showDate testID={`folder-task-${i}`} />
              </View>
            );
          })}
        </View>
      </ScrollView>

      <Pressable
        testID="folder-fab"
        accessibilityRole="button"
        accessibilityLabel="Quick add task to this folder"
        onPress={() => router.push({ pathname: '/quick-add', params: { kind: 'task', folderId: folder.id, date: today } })}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: p.primary, opacity: pressed ? 0.85 : 1, shadowColor: p.scheme === 'dark' ? '#000000' : p.text },
        ]}>
        <Icon name="add" size={30} color={p.onPrimary} />
      </Pressable>

      <Sheet visible={optionsOpen} title="Options" onClose={() => setOptionsOpen(false)}>
        <View style={{ gap: spacing.sm }}>
          <Button
            testID="folder-edit"
            label="Edit"
            icon="create-outline"
            tone="secondary"
            onPress={() => {
              setOptionsOpen(false);
              setEditing(true);
            }}
          />
          {folder.status === 'archived' ? (
            <Button
              testID="folder-restore"
              label="Restore"
              icon="arrow-undo-outline"
              tone="secondary"
              onPress={() => {
                setOptionsOpen(false);
                run((s) => s.folders.restore(folder.id), 'Restored');
              }}
            />
          ) : (
            <Button
              testID="folder-archive"
              label="Archive"
              icon="archive-outline"
              tone="secondary"
              onPress={() => {
                setOptionsOpen(false);
                run((s) => s.folders.archive(folder.id), 'Archived');
              }}
            />
          )}
          {folder.status !== 'completed' ? (
            <Button
              testID="folder-mark-completed"
              label="Mark Completed"
              icon="checkmark"
              tone="secondary"
              onPress={() => {
                setOptionsOpen(false);
                run((s) => s.folders.complete(folder.id), 'Completed');
              }}
            />
          ) : (
            <Button
              testID="folder-reopen"
              label="Reopen"
              icon="refresh"
              tone="secondary"
              onPress={() => {
                setOptionsOpen(false);
                run((s) => s.folders.restore(folder.id), 'Reopened');
              }}
            />
          )}
          <Button
            testID="folder-delete"
            label="Delete"
            icon="trash-outline"
            tone="ghost"
            onPress={() => {
              setOptionsOpen(false);
              onDelete(folder);
            }}
          />
        </View>
      </Sheet>

      <FolderForm visible={editing} folder={folder} onClose={() => setEditing(false)} onSaved={() => card.reload()} />

      <OptionsModal<StatusFilter>
        visible={picker === 'status'}
        title="Filter by status"
        value={filterCtl.state.status}
        options={statuses}
        onChange={(v) => {
          filterCtl.setStatus(v);
          setPicker(null);
          setFiltersOpen(true);
        }}
        onClose={() => {
          setPicker(null);
          setFiltersOpen(true);
        }}
      />
      <OptionsModal<SortKey>
        visible={picker === 'sort'}
        title="Sort by"
        value={filterCtl.state.sort}
        options={AGENDA_SORT_OPTIONS}
        onChange={(v) => {
          filterCtl.setSort(v);
          setPicker(null);
          setFiltersOpen(true);
        }}
        onClose={() => {
          setPicker(null);
          setFiltersOpen(true);
        }}
      />
      <OptionsModal<Priority | null>
        visible={picker === 'priority'}
        title="Priority"
        value={filterCtl.state.priority}
        options={[{ value: null, label: 'Any priority' }, ...PRIORITIES.map((x) => ({ value: x, label: PRIORITY_LABEL[x], color: p.priority[x] }))]}
        onChange={(v) => {
          filterCtl.setPriority(v);
          setPicker(null);
          setFiltersOpen(true);
        }}
        onClose={() => {
          setPicker(null);
          setFiltersOpen(true);
        }}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={filterCtl.state.categoryId}
        options={[{ value: null, label: 'Any category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={(v) => {
          filterCtl.setCategoryId(v);
          setPicker(null);
          setFiltersOpen(true);
        }}
        onClose={() => {
          setPicker(null);
          setFiltersOpen(true);
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  gridCell: { width: '50%', paddingHorizontal: 6, paddingBottom: 12 },
  fab: {
    position: 'absolute',
    right: 20,
    bottom: 20,
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 6,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 4 },
  },
});
