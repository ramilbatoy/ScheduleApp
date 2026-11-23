import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PRIORITIES, type Priority } from '@/domain/models';
import type { ListFilter, SortKey, StatusFilter } from '@/domain/services/agendaService';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { OptionsModal } from '@/ui/components/Pickers';
import { AppText, Chip, Icon, Input } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

export const AGENDA_STATUS_OPTIONS: { value: StatusFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'pending', label: 'Pending' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'carried', label: 'Carried over' },
  { value: 'completed', label: 'Completed' },
  { value: 'upcoming', label: 'Upcoming' },
];

export const AGENDA_SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: 'date', label: 'Date' },
  { value: 'priority', label: 'Priority' },
  { value: 'deadline', label: 'Deadline' },
  { value: 'created', label: 'Recently created' },
];

export const EMPTY_AGENDA_FILTER: ListFilter = {
  text: '',
  status: 'all',
  sort: 'date',
};

export type AgendaFilterState = {
  text: string;
  status: StatusFilter;
  priority: Priority | null;
  categoryId: string | null;
  sort: SortKey;
};

export function agendaFilterFromState(state: AgendaFilterState): ListFilter {
  return {
    text: state.text,
    status: state.status,
    priorities: state.priority ? [state.priority] : undefined,
    categoryIds: state.categoryId ? [state.categoryId] : undefined,
    sort: state.sort,
  };
}

export function useAgendaFilterState(initial?: Partial<AgendaFilterState>) {
  const [text, setText] = useState(initial?.text ?? '');
  const [status, setStatus] = useState<StatusFilter>(initial?.status ?? 'all');
  const [priority, setPriority] = useState<Priority | null>(initial?.priority ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(initial?.categoryId ?? null);
  const [sort, setSort] = useState<SortKey>(initial?.sort ?? 'date');
  return {
    state: { text, status, priority, categoryId, sort } satisfies AgendaFilterState,
    setText,
    setStatus,
    setPriority,
    setCategoryId,
    setSort,
    filter: agendaFilterFromState({ text, status, priority, categoryId, sort }),
  };
}

type Props = {
  state: AgendaFilterState;
  onText: (v: string) => void;
  onStatus: (v: StatusFilter) => void;
  onPriority: (v: Priority | null) => void;
  onCategoryId: (v: string | null) => void;
  onSort: (v: SortKey) => void;
  /** Hide status chips that do not apply in a scoped day/week list. */
  statuses?: { value: StatusFilter; label: string }[];
  sorts?: { value: SortKey; label: string }[];
  showStatusRow?: boolean;
  matchCount?: number;
  testID?: string;
  searchPlaceholder?: string;
};

/**
 * Search + status/priority/category/sort compact dropdowns.
 * Status is a single dropdown (not a permanent chip strip). Chips wrap on narrow widths.
 */
export function AgendaFilterBar({
  state,
  onText,
  onStatus,
  onPriority,
  onCategoryId,
  onSort,
  statuses = AGENDA_STATUS_OPTIONS.filter((s) => s.value !== 'upcoming'),
  sorts = AGENDA_SORT_OPTIONS,
  showStatusRow = true,
  matchCount,
  testID = 'agenda-filter',
  searchPlaceholder = 'Search titles, notes',
}: Props) {
  const p = useTheme();
  const [picker, setPicker] = useState<null | 'sort' | 'category' | 'priority' | 'status'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const category = categories.data?.find((c) => c.id === state.categoryId);
  const statusLabel = statuses.find((s) => s.value === state.status)?.label ?? 'All';

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <View style={styles.search}>
        <View style={styles.searchIcon}>
          <Icon name="search" size={18} color={p.textSecondary} />
        </View>
        <Input
          testID={`${testID}-search`}
          value={state.text}
          onChangeText={onText}
          placeholder={searchPlaceholder}
          style={{ paddingLeft: 40 }}
          clearButtonMode="while-editing"
        />
      </View>
      <View style={styles.chipRow}>
        {showStatusRow ? (
          <Chip
            testID={`${testID}-status`}
            icon="filter-outline"
            label={`Status: ${statusLabel}`}
            selected={state.status !== 'all'}
            onPress={() => setPicker('status')}
          />
        ) : null}
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
          testID={`${testID}-sort`}
          icon="swap-vertical"
          label={`Sort: ${sorts.find((s) => s.value === state.sort)?.label ?? state.sort}`}
          onPress={() => setPicker('sort')}
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
        options={statuses}
        onChange={onStatus}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<SortKey> visible={picker === 'sort'} title="Sort by" value={state.sort} options={sorts} onChange={onSort} onClose={() => setPicker(null)} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
