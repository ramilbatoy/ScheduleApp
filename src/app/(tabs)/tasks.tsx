import { useState } from 'react';
import { FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { PRIORITIES, type ItemKind, type Priority } from '@/domain/models';
import type { SortKey, StatusFilter } from '@/domain/services/agendaService';
import { AgendaRow, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
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
  const insets = useSafeAreaInsets();
  const [text, setText] = useState('');
  const [status, setStatus] = useState<StatusFilter>('pending');
  const [kind, setKind] = useState<KindFilter>('task');
  const [priority, setPriority] = useState<Priority | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [sort, setSort] = useState<SortKey>('date');
  const [picker, setPicker] = useState<null | 'sort' | 'category' | 'priority'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const kinds: ItemKind[] | undefined = kind === 'all' ? undefined : [kind];
  const list = useQuery(
    (s) => s.agenda.list({ text, status, kinds, priorities: priority ? [priority] : undefined, categoryIds: categoryId ? [categoryId] : undefined, sort }),
    [text, status, kind, priority, categoryId, sort],
  );
  const category = categories.data?.find((c) => c.id === categoryId);

  const header = (
    <View style={{ gap: spacing.md, paddingBottom: spacing.sm }}>
      <AppText variant="display" style={{ paddingTop: spacing.md }}>
        {kind === 'event' ? 'Events' : kind === 'all' ? 'Everything' : 'Tasks'}
      </AppText>
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
      </ScrollView>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
        {STATUSES.map((s) => (
          <Chip key={s.value} testID={`status-${s.value}`} label={s.label} selected={status === s.value} onPress={() => setStatus(s.value)} />
        ))}
      </ScrollView>
      {list.data ? (
        <AppText variant="caption" muted>
          {list.data.length} item{list.data.length === 1 ? '' : 's'}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top }}>
      <FlatList
        data={list.data ?? []}
        keyExtractor={(a) => a.occurrence.id}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingBottom: 120, gap: spacing.sm }}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item, index }) => <AgendaRow a={item} showDate testID={`list-${index}`} />}
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
    </View>
  );
}

const styles = StyleSheet.create({
  search: { justifyContent: 'center' },
  searchIcon: { position: 'absolute', left: 12, zIndex: 1 },
});
