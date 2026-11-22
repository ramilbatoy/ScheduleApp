import { useMemo, useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';

import { todayKey } from '@/domain/dates';
import { PRIORITIES, type ItemKind, type Priority } from '@/domain/models';
import type { FolderAssignmentFilter, FolderTargetFilter, SortKey, StatusFilter } from '@/domain/services/agendaService';
import { groupFolderTasks, selectEmptyFoldersForTasks, type TaskListEntry } from '@/domain/taskListFolders';
import { useAppStore } from '@/state/appStore';
import { AgendaRow, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderTaskCard } from '@/ui/components/FolderTaskCard';
import { OptionsModal } from '@/ui/components/Pickers';
import { AppText, Chip, EmptyState, ErrorState, Icon, Input, LoadingState } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useQuery, useTheme } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

const STATUSES: { value: StatusFilter; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'carried', label: 'Carried over' },
  { value: 'upcoming', label: 'Upcoming' },
  { value: 'completed', label: 'Completed' },
  { value: 'all', label: 'All' },
];

const SORTS: { value: SortKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'created', label: 'Recently created' },
];

type KindFilter = 'task' | 'event' | 'all';

export default function TasksScreen() {
  const p = useTheme();
  const services = useAppStore((s) => s.services);
  const showEmpty = useAppStore((s) => s.settings?.showEmptyFoldersOnTasks ?? false);
  const today = services ? todayKey(services.clock) : '';
  const [text, setText] = useState('');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [kind, setKind] = useState<KindFilter>('task');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderAssignment, setFolderAssignment] = useState<FolderAssignmentFilter>('any');
  const [folderTarget, setFolderTarget] = useState<FolderTargetFilter>('any');
  const [sort, setSort] = useState<SortKey>('date');
  const [groupByFolder, setGroupByFolder] = useState(false);
  const [picker, setPicker] = useState<null | 'sort' | 'category' | 'priority' | 'folder' | 'folderTarget'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const folders = useQuery((s) => s.folders.cards(), []);
  const kinds: ItemKind[] | undefined = kind === 'all' ? undefined : [kind];
  const list = useQuery(
    (s) =>
      s.agenda.list({
        text,
        status,
        kinds,
        priorities: priority ? [priority] : undefined,
        categoryIds: categoryId ? [categoryId] : undefined,
        folderId: folderId ?? undefined,
        folderAssignment: folderId ? 'any' : folderAssignment,
        folderTarget,
        sort,
      }),
    [text, status, kind, priority, categoryId, folderId, folderAssignment, folderTarget, sort],
  );
  const category = categories.data?.find((c) => c.id === categoryId);
  const rows = useMemo(() => {
    if (!list.data) return [] as TaskListEntry[];
    if (!groupByFolder) return list.data.map((agenda): TaskListEntry => ({ kind: 'item', agenda }));
    const empty = selectEmptyFoldersForTasks(folders.data ?? [], {
      enabled: showEmpty,
      search: text,
      status,
      hasPriority: !!priority,
      hasCategory: !!categoryId,
      folderTarget,
      folderId,
      folderAssignment: folderId ? 'any' : folderAssignment,
      includeOnThisKind: kind !== 'event',
      today,
    });
    return groupFolderTasks(list.data, { search: text, emptyFolders: empty });
  }, [list.data, folders.data, showEmpty, text, status, priority, categoryId, folderTarget, folderId, folderAssignment, kind, today, groupByFolder]);
  const folderRows = rows.filter((row) => row.kind === 'folder').length;
  const itemRows = rows.length - folderRows;

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md, gap: spacing.sm }}>
        <AppText variant="display" style={{ flex: 1 }}>
          {kind === 'event' ? 'Events' : kind === 'all' ? 'Everything' : 'Tasks'}
        </AppText>
      </View>
      <View style={styles.search}>
        <View style={styles.searchIcon}>
          <Icon name="search" size={18} color={p.textSecondary} />
        </View>
        <Input testID="search-input" value={text} onChangeText={setText} placeholder="Search titles, notes, categories" style={{ paddingLeft: 40 }} clearButtonMode="while-editing" />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {(['task', 'event', 'all'] as KindFilter[]).map((k) => (
          <Chip key={k} testID={`kind-${k}`} label={k === 'task' ? 'Tasks' : k === 'event' ? 'Events' : 'All items'} selected={kind === k} onPress={() => setKind(k)} />
        ))}
        <Chip testID="filter-priority" icon="flag" label={priority ? PRIORITY_LABEL[priority] : 'Priority'} color={priority ? p.priority[priority] : undefined} selected={!!priority} onPress={() => setPicker('priority')} />
        <Chip testID="filter-category" label={category?.name ?? 'Category'} icon={category ? undefined : 'pricetag-outline'} color={category?.color} selected={!!category} onPress={() => setPicker('category')} />
        <Chip testID="filter-sort" icon="swap-vertical" label={`Sort: ${SORTS.find((s) => s.value === sort)!.label}`} onPress={() => setPicker('sort')} />
        <Chip testID="group-by-folder" icon="folder-outline" label="Group by folder" selected={groupByFolder} onPress={() => setGroupByFolder((v) => !v)} />
        <Chip
          testID="filter-folder"
          icon="folder-outline"
          label={folderId ? (folders.data?.find((f) => f.id === folderId)?.name ?? 'Folder') : folderAssignment === 'unassigned' ? 'No folder' : folderAssignment === 'assigned' ? 'In a folder' : 'Folder'}
          selected={!!folderId || folderAssignment !== 'any'}
          onPress={() => setPicker('folder')}
        />
        <Chip
          testID="filter-folder-target"
          icon="flag-outline"
          label={folderTarget === 'any' ? 'Folder target' : folderTarget === 'overdue' ? 'Target overdue' : folderTarget === 'approaching' ? 'Target soon' : folderTarget === 'set' ? 'Has target' : 'No target'}
          selected={folderTarget !== 'any'}
          onPress={() => setPicker('folderTarget')}
        />
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {STATUSES.map((s) => (
          <Chip key={s.value} testID={`status-${s.value}`} label={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
      {list.data ? (
        <AppText variant="caption" muted>
          {groupByFolder
            ? folderRows
              ? `${itemRows} individual · ${folderRows} folder${folderRows === 1 ? '' : 's'}`
              : `${itemRows} item${itemRows === 1 ? '' : 's'}`
            : `${itemRows} item${itemRows === 1 ? '' : 's'}`}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <FlatList
        data={rows}
        keyExtractor={(row) => (row.kind === 'folder' ? `folder-${row.group.folder.id}` : row.agenda.occurrence.id)}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) =>
          item.kind === 'folder' ? (
            <FolderTaskCard group={item.group} today={today} testID={`list-folder-${index}`} />
          ) : (
            <AgendaRow a={item.agenda} showDate testID={`list-${index}`} />
          )
        }
        ListEmptyComponent={
          list.error ? (
            <ErrorState message={list.error} onRetry={list.reload} />
          ) : !list.data ? (
            <LoadingState />
          ) : (
            <EmptyState icon={text ? 'search' : 'checkmark-done-outline'} title={text ? 'No matches' : 'Nothing here'} message={text ? `Nothing matches "${text}" with these filters.` : 'Try another filter or add something new.'} />
          )
        }
      />
      <QuickAddButton kind={kind === 'event' ? 'event' : 'task'} />
      <OptionsModal<SortKey> visible={picker === 'sort'} title="Sort by" value={sort} options={SORTS} onChange={setSort} onClose={() => setPicker(null)} />
      <OptionsModal<Priority | null>
        visible={picker === 'priority'}
        title="Priority"
        value={priority}
        options={[{ value: null, label: 'Any priority' }, ...PRIORITIES.map((x) => ({ value: x, label: PRIORITY_LABEL[x], color: p.priority[x] }))]}
        onChange={setPriority}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={categoryId}
        options={[{ value: null, label: 'Any category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={setCategoryId}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<string>
        visible={picker === 'folder'}
        title="Folder"
        value={folderId ?? folderAssignment}
        options={[
          { value: 'any', label: 'Any folder' },
          { value: 'unassigned', label: 'No folder' },
          { value: 'assigned', label: 'In a folder' },
          ...(folders.data ?? []).filter((f) => f.status !== 'archived').map((f) => ({ value: f.id, label: f.name, color: f.color })),
          ...(folders.data ?? []).filter((f) => f.status === 'archived').map((f) => ({ value: f.id, label: `${f.name} (archived)`, color: f.color })),
        ]}
        onChange={(value) => {
          if (value === 'any' || value === 'unassigned' || value === 'assigned') {
            setFolderId(null);
            setFolderAssignment(value);
          } else {
            setFolderId(value);
            setFolderAssignment('any');
          }
        }}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<FolderTargetFilter>
        visible={picker === 'folderTarget'}
        title="Folder target date"
        value={folderTarget}
        options={[
          { value: 'any', label: 'Any target' },
          { value: 'overdue', label: 'Target overdue' },
          { value: 'approaching', label: 'Due within 7 days' },
          { value: 'set', label: 'Has a target' },
          { value: 'none', label: 'No target' },
        ]}
        onChange={setFolderTarget}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
});
