import { useState } from 'react';
import { View } from 'react-native';

import { PRIORITIES, type Priority } from '@/domain/models';
import type { ListFilter, SortKey, StatusFilter } from '@/domain/services/agendaService';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { CompactFilterToolbar } from '@/ui/components/CompactFilterToolbar';
import { OptionsModal } from '@/ui/components/Pickers';
import { type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText } from '@/ui/components/primitives';
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
  layout?: ListLayout;
  onLayoutChange?: (next: ListLayout) => void;
};

/**
 * Search popup + status/priority/category/sort in one filters sheet.
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
  searchPlaceholder = 'Search: task, events, or folder',
  layout,
  onLayoutChange,
}: Props) {
  const p = useTheme();
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);
  const [picker, setPicker] = useState<null | 'sort' | 'category' | 'priority' | 'status'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const category = categories.data?.find((c) => c.id === state.categoryId);
  const statusLabel = statuses.find((s) => s.value === state.status)?.label ?? 'All';

  function openPicker(next: 'sort' | 'category' | 'priority' | 'status') {
    setFiltersOpen(false);
    setPicker(next);
  }

  function closePicker() {
    setPicker(null);
    setFiltersOpen(true);
  }

  const filterRows = [
    ...(showStatusRow
      ? [
          {
            testID: `${testID}-status`,
            icon: 'filter-outline' as const,
            label: 'Status',
            value: statusLabel,
            onPress: () => openPicker('status'),
          },
        ]
      : []),
    {
      testID: `${testID}-priority`,
      icon: 'flag' as const,
      label: 'Priority',
      value: state.priority ? PRIORITY_LABEL[state.priority] : 'Any',
      onPress: () => openPicker('priority'),
    },
    {
      testID: `${testID}-category`,
      icon: 'pricetag-outline' as const,
      label: 'Category',
      value: category?.name ?? 'Any',
      onPress: () => openPicker('category'),
    },
    {
      testID: `${testID}-sort`,
      icon: 'swap-vertical' as const,
      label: 'Sort',
      value: sorts.find((s) => s.value === state.sort)?.label ?? state.sort,
      onPress: () => openPicker('sort'),
    },
  ];

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
        filterRows={filterRows}
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
        options={statuses}
        onChange={onStatus}
        onClose={closePicker}
      />
      <OptionsModal<SortKey> visible={picker === 'sort'} title="Sort by" value={state.sort} options={sorts} onChange={onSort} onClose={closePicker} />
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
    </View>
  );
}
