import { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';

import { todayKey } from '@/domain/dates';
import { PRIORITIES, type ItemKind, type Priority } from '@/domain/models';
import type { FolderAssignmentFilter, SortKey, StatusFilter } from '@/domain/services/agendaService';
import { groupFolderTasks, selectEmptyFoldersForTasks, type TaskListEntry } from '@/domain/taskListFolders';
import { useAppStore } from '@/state/appStore';
import { AgendaRow, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderTaskCard } from '@/ui/components/FolderTaskCard';
import { OptionsModal, Sheet } from '@/ui/components/Pickers';
import { ViewLayoutToggle } from '@/ui/components/ViewLayoutToggle';
import { AppText, EmptyState, ErrorState, IconButton, ListRow, LoadingState, SwitchRow } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { SearchFieldPopup } from '@/ui/components/SearchFieldPopup';
import { useFolderGridColumns } from '@/ui/hooks/useFolderGridColumns';
import { useQuery, useTheme } from '@/ui/hooks';
import { folderGridCellStyle, folderGridWrapStyle } from '@/ui/layout/folderGrid';
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

type Picker = 'status' | 'priority' | 'category' | 'folder' | 'sort';

/** Tasks or Events list. Filters live in the options popup. Folder target is not a filter. */
export function ItemBrowseScreen({ kind, title }: { kind: ItemKind; title: string }) {
  const p = useTheme();
  const services = useAppStore((s) => s.services);
  const showEmpty = useAppStore((s) => s.settings?.showEmptyFoldersOnTasks ?? false);
  const today = services ? todayKey(services.clock) : '';
  const [text, setText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [folderId, setFolderId] = useState<string | null>(null);
  const [folderAssignment, setFolderAssignment] = useState<FolderAssignmentFilter>('any');
  const [sort, setSort] = useState<SortKey>('date');
  const [groupByFolder, setGroupByFolder] = useState(false);
  const [layout, setLayout] = useState<'list' | 'grid'>('grid');
  const { columns, compact, onGridLayout } = useFolderGridColumns(layout);
  const [picker, setPicker] = useState<Picker | null>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const folders = useQuery((s) => s.folders.cards(), []);
  const kinds: ItemKind[] = [kind];
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
        sort,
      }),
    [text, status, kind, priority, categoryId, folderId, folderAssignment, sort],
  );
  const category = categories.data?.find((c) => c.id === categoryId);
  const selectedFolder = folderId ? folders.data?.find((f) => f.id === folderId) : null;
  const statusLabel = STATUSES.find((s) => s.value === status)?.label ?? 'Pending';
  const folderLabel = folderId
    ? (selectedFolder?.name ?? 'Folder')
    : folderAssignment === 'unassigned'
      ? 'No folder'
      : folderAssignment === 'assigned'
        ? 'In a folder'
        : 'Any folder';
  const rows = useMemo(() => {
    if (!list.data) return [] as TaskListEntry[];
    if (!groupByFolder) return list.data.map((agenda): TaskListEntry => ({ kind: 'item', agenda }));
    const empty = selectEmptyFoldersForTasks(folders.data ?? [], {
      enabled: showEmpty,
      search: text,
      status,
      hasPriority: !!priority,
      hasCategory: !!categoryId,
      folderId,
      folderAssignment: folderId ? 'any' : folderAssignment,
      includeOnThisKind: kind !== 'event',
      today,
    });
    return groupFolderTasks(list.data, { search: text, emptyFolders: empty, groupEvents: kind === 'event' });
  }, [list.data, folders.data, showEmpty, text, status, priority, categoryId, folderId, folderAssignment, kind, today, groupByFolder]);
  const folderRows = rows.filter((row) => row.kind === 'folder').length;
  const itemRows = rows.length - folderRows;

  function openPicker(next: Picker) {
    setOptionsOpen(false);
    setPicker(next);
  }

  function closePicker() {
    setPicker(null);
    setOptionsOpen(true);
  }

  const header = (
    <View style={{ gap: spacing.sm, paddingBottom: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', paddingTop: spacing.md, gap: spacing.xs, flexWrap: 'wrap' }}>
        <AppText variant="display" style={{ flexGrow: 1, flexShrink: 1, minWidth: 120 }} numberOfLines={1} testID={`${kind}-title`}>
          {title}
        </AppText>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexShrink: 0 }}>
          <IconButton testID={`${kind}-search-open`} icon="search" label="Search" onPress={() => setSearchOpen(true)} />
          <IconButton testID={`${kind}-options`} icon="ellipsis-horizontal" label="Options" onPress={() => setOptionsOpen(true)} />
          <ViewLayoutToggle testID={`${kind}-layout`} layout={layout} onChange={setLayout} />
        </View>
      </View>
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

  /**
   * Flex-wrap grid (same as Folder page) instead of FlatList `numColumns`.
   * Changing FlatList numColumns on Android requires remounting via `key`, which races
   * with filter/query updates and drops layout state. ScrollView + wrap stays stable.
   */
  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled">
        {header}
        {list.error ? (
          <ErrorState message={list.error} onRetry={list.reload} />
        ) : !list.data ? (
          <LoadingState />
        ) : rows.length === 0 ? (
          <EmptyState
            icon={text ? 'search' : 'checkmark-done-outline'}
            title={text ? 'No matches' : 'Nothing here'}
            message={text ? `Nothing matches "${text}" with these filters.` : 'Try another filter or add something new.'}
          />
        ) : (
          <View
            style={layout === 'grid' ? folderGridWrapStyle() : { gap: spacing.sm }}
            onLayout={layout === 'grid' ? onGridLayout : undefined}
            testID={`${kind}-list`}>
            {rows.map((item, index) => (
              <View
                key={item.kind === 'folder' ? `folder-${item.group.folder.id}` : item.agenda.occurrence.id}
                style={layout === 'grid' ? folderGridCellStyle(columns) : undefined}>
                {item.kind === 'folder' ? (
                  <FolderTaskCard group={item.group} today={today} compact={compact} testID={`list-folder-${index}`} />
                ) : (
                  <AgendaRow a={item.agenda} showDate compact={compact} testID={`list-${index}`} />
                )}
              </View>
            ))}
          </View>
        )}
      </ScrollView>
      <SearchFieldPopup
        visible={searchOpen}
        value={text}
        onChangeText={setText}
        onClose={() => setSearchOpen(false)}
        placeholder={kind === 'event' ? 'Search events' : 'Search tasks'}
        testID="search-input"
      />
      <QuickAddButton kind={kind} />
      <Sheet visible={optionsOpen} title="Options" onClose={() => setOptionsOpen(false)}>
        <ListRow testID="filter-status" icon="filter-outline" label="Status" value={statusLabel} onPress={() => openPicker('status')} />
        <ListRow
          testID="filter-priority"
          icon="flag"
          label="Priority"
          value={priority ? PRIORITY_LABEL[priority] : 'Any'}
          onPress={() => openPicker('priority')}
        />
        <ListRow testID="filter-category" icon="pricetag-outline" label="Category" value={category?.name ?? 'Any'} onPress={() => openPicker('category')} />
        <ListRow testID="filter-folder" icon="folder-outline" label="Folder" value={folderLabel} onPress={() => openPicker('folder')} />
        <ListRow testID="filter-sort" icon="swap-vertical" label="Sort" value={SORTS.find((s) => s.value === sort)!.label} onPress={() => openPicker('sort')} />
        <SwitchRow testID="group-by-folder" label="Group by" description="Group matching items under their folder." value={groupByFolder} onChange={setGroupByFolder} />
      </Sheet>
      <OptionsModal<StatusFilter> visible={picker === 'status'} title="Status" value={status} options={STATUSES} onChange={setStatus} onClose={closePicker} />
      <OptionsModal<SortKey> visible={picker === 'sort'} title="Sort" value={sort} options={SORTS} onChange={setSort} onClose={closePicker} />
      <OptionsModal<Priority | null>
        visible={picker === 'priority'}
        title="Priority"
        value={priority}
        options={[{ value: null, label: 'Any priority' }, ...PRIORITIES.map((x) => ({ value: x, label: PRIORITY_LABEL[x], color: p.priority[x] }))]}
        onChange={setPriority}
        onClose={closePicker}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={categoryId}
        options={[{ value: null, label: 'Any category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={setCategoryId}
        onClose={closePicker}
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
        onClose={closePicker}
      />
    </View>
  );
}
