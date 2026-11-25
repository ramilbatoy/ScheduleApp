import { useState } from 'react';
import { View } from 'react-native';

import { PRIORITIES, type Priority } from '@/domain/models';
import type { ListFilter, StatusFilter } from '@/domain/services/agendaService';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { CompactFilterToolbar } from '@/ui/components/CompactFilterToolbar';
import { OptionsModal } from '@/ui/components/Pickers';
import { DAY_STATUS_OPTIONS } from '@/ui/components/StatusFilterDropdown';
import { type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

export type WeekFolderFilter = string | null | 'unassigned';

export type WeekFilterState = {
  text: string;
  status: StatusFilter;
  priority: Priority | null;
  categoryId: string | null;
  folder: WeekFolderFilter;
};

export function weekFilterToListFilter(state: WeekFilterState): ListFilter {
  const filter: ListFilter = {
    text: state.text,
    status: state.status,
    priorities: state.priority ? [state.priority] : undefined,
    categoryIds: state.categoryId ? [state.categoryId] : undefined,
    sort: 'date',
  };
  if (state.folder === 'unassigned') filter.folderAssignment = 'unassigned';
  else if (state.folder) filter.folderId = state.folder;
  return filter;
}

export function useWeekFilterState(initial?: Partial<WeekFilterState>) {
  const [text, setText] = useState(initial?.text ?? '');
  const [status, setStatus] = useState<StatusFilter>(initial?.status ?? 'all');
  const [priority, setPriority] = useState<Priority | null>(initial?.priority ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [folder, setFolder] = useState<WeekFolderFilter>(initial?.folder ?? null);
  const state = { text, status, priority, categoryId, folder } satisfies WeekFilterState;
  return {
    state,
    setText,
    setStatus,
    setPriority,
    setCategoryId,
    setFolder,
    filter: weekFilterToListFilter(state),
    hasPriority: !!priority,
    hasCategory: !!categoryId,
  };
}

type Props = {
  state: WeekFilterState;
  onText: (v: string) => void;
  onStatus: (v: StatusFilter) => void;
  onPriority: (v: Priority | null) => void;
  onCategoryId: (v: string | null) => void;
  onFolder: (v: WeekFolderFilter) => void;
  matchCount?: number;
  testID?: string;
  /** Hide the search field (legacy; search is always a popup now). */
  hideSearch?: boolean;
  layout?: ListLayout;
  onLayoutChange?: (next: ListLayout) => void;
  searchPlaceholder?: string;
};

/** Compact filter dropdown + search popup for Week / Day planners. */
export function WeekFilterBar({
  state,
  onText,
  onStatus,
  onPriority,
  onCategoryId,
  onFolder,
  matchCount,
  testID = 'week-filter',
  layout,
  onLayoutChange,
  searchPlaceholder = 'Search: task, events, or folder',
}: Props) {
  const p = useTheme();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picker, setPicker] = useState<null | 'status' | 'priority' | 'category' | 'folder'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const folders = useQuery((s) => s.folders.list(), []);
  const category = categories.data?.find((c) => c.id === state.categoryId);
  const folder =
    state.folder && state.folder !== 'unassigned' ? folders.data?.find((f) => f.id === state.folder) : null;
  const statusLabel = DAY_STATUS_OPTIONS.find((s) => s.value === state.status)?.label ?? 'All';
  const folderLabel =
    state.folder === 'unassigned' ? 'Unassigned' : folder ? folder.name : state.folder ? 'Folder' : 'Any folder';

  function openPicker(next: 'status' | 'priority' | 'category' | 'folder') {
    setFiltersOpen(false);
    setPicker(next);
  }

  function closePicker() {
    setPicker(null);
    setFiltersOpen(true);
  }

  return (
    <View style={{ gap: spacing.sm }}>
      <CompactFilterToolbar
        testID={testID}
        searchValue={state.text}
        searchOpen={searchOpen}
        onSearchOpenChange={setSearchOpen}
        onSearchChange={onText}
        searchPlaceholder={searchPlaceholder}
        filtersOpen={filtersOpen}
        onFiltersOpenChange={setFiltersOpen}
        layout={layout}
        onLayoutChange={onLayoutChange}
        filterRows={[
          { testID: `${testID}-status`, icon: 'filter-outline', label: 'Status', value: statusLabel, onPress: () => openPicker('status') },
          {
            testID: `${testID}-priority`,
            icon: 'flag',
            label: 'Priority',
            value: state.priority ? PRIORITY_LABEL[state.priority] : 'Any',
            onPress: () => openPicker('priority'),
          },
          {
            testID: `${testID}-category`,
            icon: 'pricetag-outline',
            label: 'Category',
            value: category?.name ?? 'Any',
            onPress: () => openPicker('category'),
          },
          {
            testID: `${testID}-folder`,
            icon: 'folder-outline',
            label: 'Folder',
            value: folderLabel,
            onPress: () => openPicker('folder'),
          },
        ]}
      />
      {typeof matchCount === 'number' ? (
        <AppText variant="caption" muted>
          {matchCount} match{matchCount === 1 ? '' : 'es'}
        </AppText>
      ) : null}
      <OptionsModal<StatusFilter>
        visible={picker === 'status'}
        title="Filter by status"
        value={state.status}
        options={DAY_STATUS_OPTIONS}
        onChange={onStatus}
        onClose={closePicker}
      />
      <OptionsModal<Priority | null>
        visible={picker === 'priority'}
        title="Priority"
        value={state.priority}
        options={[{ value: null, label: 'Any priority' }, ...PRIORITIES.map((x) => ({ value: x, label: PRIORITY_LABEL[x], color: p.priority[x] }))]}
        onChange={onPriority}
        onClose={closePicker}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={state.categoryId}
        options={[{ value: null, label: 'Any category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={onCategoryId}
        onClose={closePicker}
      />
      <OptionsModal<WeekFolderFilter>
        visible={picker === 'folder'}
        title="Folder"
        value={state.folder}
        options={[
          { value: null, label: 'Any folder' },
          { value: 'unassigned', label: 'Unassigned' },
          ...(folders.data ?? [])
            .filter((f) => f.status !== 'archived')
            .map((f) => ({ value: f.id as WeekFolderFilter, label: f.name, color: f.color })),
        ]}
        onChange={onFolder}
        onClose={closePicker}
      />
    </View>
  );
}
