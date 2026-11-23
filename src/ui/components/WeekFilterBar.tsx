import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PRIORITIES, type Priority } from '@/domain/models';
import type { ListFilter, StatusFilter } from '@/domain/services/agendaService';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { OptionsModal } from '@/ui/components/Pickers';
import { DAY_STATUS_OPTIONS } from '@/ui/components/StatusFilterDropdown';
import { AppText, Chip, Icon, Input } from '@/ui/components/primitives';
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
  /** Hide the search field (Day already has date context). */
  hideSearch?: boolean;
};

/** Compact dropdown filters for Week / Day planners (status / priority / category / folder). */
export function WeekFilterBar({
  state,
  onText,
  onStatus,
  onPriority,
  onCategoryId,
  onFolder,
  matchCount,
  testID = 'week-filter',
  hideSearch = false,
}: Props) {
  const p = useTheme();
  const [picker, setPicker] = useState<null | 'status' | 'priority' | 'category' | 'folder'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const folders = useQuery((s) => s.folders.list(), []);
  const category = categories.data?.find((c) => c.id === state.categoryId);
  const folder =
    state.folder && state.folder !== 'unassigned' ? folders.data?.find((f) => f.id === state.folder) : null;
  const statusLabel = DAY_STATUS_OPTIONS.find((s) => s.value === state.status)?.label ?? 'All';
  const folderLabel =
    state.folder === 'unassigned' ? 'Unassigned' : folder ? folder.name : state.folder ? 'Folder' : 'Any folder';

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      {!hideSearch ? (
        <View style={styles.search}>
          <View style={styles.searchIcon}>
            <Icon name="search" size={18} color={p.textSecondary} />
          </View>
          <Input
            testID={`${testID}-search`}
            value={state.text}
            onChangeText={onText}
            placeholder="Search titles, notes"
            style={{ paddingLeft: 40 }}
            clearButtonMode="while-editing"
          />
        </View>
      ) : null}
      <View style={styles.chipRow}>
        <Chip
          testID={`${testID}-status`}
          icon="filter-outline"
          label={`Status: ${statusLabel}`}
          selected={state.status !== 'all'}
          onPress={() => setPicker('status')}
        />
        <Chip
          testID={`${testID}-priority`}
          icon="flag"
          label={state.priority ? PRIORITY_LABEL[state.priority] : 'Priority'}
          color={state.priority ? p.priority[state.priority] : undefined}
          selected={!!state.priority}
          onPress={() => setPicker('priority')}
        />
        <Chip
          testID={`${testID}-category`}
          label={category?.name ?? 'Category'}
          icon={category ? undefined : 'pricetag-outline'}
          color={category?.color}
          selected={!!category}
          onPress={() => setPicker('category')}
        />
        <Chip
          testID={`${testID}-folder`}
          icon="folder-outline"
          label={folderLabel}
          color={folder?.color}
          selected={state.folder !== null}
          onPress={() => setPicker('folder')}
        />
      </View>
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
        onClose={() => setPicker(null)}
      />
      <OptionsModal<Priority | null>
        visible={picker === 'priority'}
        title="Priority"
        value={state.priority}
        options={[{ value: null, label: 'Any priority' }, ...PRIORITIES.map((x) => ({ value: x, label: PRIORITY_LABEL[x], color: p.priority[x] }))]}
        onChange={onPriority}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={state.categoryId}
        options={[{ value: null, label: 'Any category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={onCategoryId}
        onClose={() => setPicker(null)}
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
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
