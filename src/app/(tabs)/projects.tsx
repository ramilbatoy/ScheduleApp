import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { FolderCard, FolderListFilter, FolderSortKey } from '@/domain/folderProgress';
import { useServices, useSettings } from '@/state/appStore';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderForm } from '@/ui/components/FolderForm';
import { OptionsModal } from '@/ui/components/Pickers';
import { ReadyScreen } from '@/ui/components/ReadyScreen';
import { SearchFieldPopup } from '@/ui/components/SearchFieldPopup';
import { ViewLayoutToggle, type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Icon, IconButton, LoadingState, type IconName } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

const FOLDER_STATUS_LABEL: Record<FolderCard['status'], string> = {
  active: 'Active',
  archived: 'Archived',
  completed: 'Completed',
};

const FILTERS: { value: FolderListFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'overdue', label: 'Overdue' },
  { value: 'completed', label: 'Completed' },
  { value: 'archived', label: 'Archived' },
];

const SORTS: { value: FolderSortKey; label: string }[] = [
  { value: 'name', label: 'Name' },
  { value: 'target', label: 'Target' },
  { value: 'priority', label: 'Priority' },
  { value: 'progress', label: 'Progress' },
  { value: 'created', label: 'Created' },
  { value: 'updated', label: 'Updated' },
  { value: 'manual', label: 'Custom' },
];

function targetLabel(card: FolderCard): string | null {
  if (card.target.remainingDays === null) return null;
  if (card.target.overdue && card.progress.percent < 100) {
    const n = Math.abs(card.target.remainingDays);
    return `${n} day${n === 1 ? '' : 's'} overdue`;
  }
  if (card.target.remainingDays === 0) return 'Due today';
  return `${card.target.remainingDays} day${card.target.remainingDays === 1 ? '' : 's'} left`;
}

export default function ProjectsScreen() {
  return (
    <ReadyScreen testID="projects-boot">
      <ProjectsScreenReady />
    </ReadyScreen>
  );
}

function ProjectsScreenReady() {
  const p = useTheme();
  const services = useServices();
  const settings = useSettings();
  useSafeAndroidBack();
  const [text, setText] = useState('');
  const [searchOpen, setSearchOpen] = useState(false);
  const [filter, setFilter] = useState<FolderListFilter>('all');
  const [sort, setSort] = useState<FolderSortKey>('name');
  const [creating, setCreating] = useState(false);
  const [layout, setLayout] = useState<ListLayout>(settings.defaultFolderListView);
  const [picker, setPicker] = useState<null | 'filter' | 'sort'>(null);
  const all = useQuery((s) => s.folders.cards(), []);
  const shown = useQuery((s) => s.folders.cards({ text, filter, sort }), [text, filter, sort]);
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? 'All';
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? 'Name';

  useEffect(() => {
    setLayout(settings.defaultFolderListView);
  }, [settings.defaultFolderListView]);

  const counts = {
    active: (all.data ?? []).filter((c) => c.status === 'active').length,
    overdue: (all.data ?? []).filter((c) => c.status === 'active' && c.target.overdue && c.progress.percent < 100).length,
    completed: (all.data ?? []).filter((c) => c.status === 'completed').length,
  };

  async function move(id: string, dir: -1 | 1) {
    const ids = (shown.data ?? []).map((c) => c.id);
    const i = ids.indexOf(id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= ids.length) return;
    const next = [...ids];
    const [row] = next.splice(i, 1);
    next.splice(j, 0, row);
    await services.folders.reorder(next);
    shown.reload();
    all.reload();
  }

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 120 }}>
        <View style={styles.titleRow}>
          <AppText variant="display" style={{ flexShrink: 1 }} numberOfLines={1} testID="projects-title">
            Folder
          </AppText>
          <View style={styles.titleControls}>
            <IconButton testID="projects-search-open" icon="search" label="Search folders" onPress={() => setSearchOpen(true)} />
            <Chip
              testID="projects-filter"
              icon="filter-outline"
              label={filterLabel}
              selected={filter !== 'all'}
              onPress={() => setPicker('filter')}
            />
            <Chip
              testID="projects-sort"
              icon="swap-vertical"
              label={sortLabel}
              selected={sort !== 'name'}
              onPress={() => setPicker('sort')}
            />
          </View>
        </View>
        <View style={styles.overviewRow}>
          <AppText variant="caption" muted style={{ flex: 1 }} testID="projects-overview">
            {counts.active} active · {counts.overdue} overdue · {counts.completed} completed
          </AppText>
          <ViewLayoutToggle testID="projects-layout" layout={layout} onChange={setLayout} />
        </View>
        {shown.error ? <ErrorState message={shown.error} onRetry={shown.reload} /> : null}
        {!shown.data && !shown.error ? <LoadingState /> : null}
        {shown.data && shown.data.length === 0 ? (
          <EmptyState icon="folder-open-outline" title={text ? 'No matches' : 'No folders yet'} message="Folders group tasks into projects. Tap + to add one. Categories stay separate." />
        ) : null}
        <View style={layout === 'grid' ? styles.grid : undefined}>
          {shown.data?.map((card, index) => {
            const due = targetLabel(card);
            const open = () => router.push({ pathname: '/folder/[id]', params: { id: card.id } });
            const completed = card.status === 'completed';
            return (
              <View key={card.id} style={layout === 'grid' ? styles.gridCell : undefined}>
                <Card
                  testID={`project-card-${index}`}
                  style={{ backgroundColor: completed ? (p.scheme === 'dark' ? '#3A414B' : '#E4E6EB') : p.surface }}>
                  <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start' }}>
                    <Pressable
                      accessibilityRole="button"
                      accessibilityLabel={`Open ${card.name}`}
                      onPress={open}
                      style={({ pressed }) => [{ flex: 1, gap: spacing.sm }, pressed && { opacity: 0.85 }]}>
                      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                        <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: `${card.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                          <Icon name={card.icon as IconName} color={card.color} />
                        </View>
                        <View style={{ flex: 1, gap: 2 }}>
                          <AppText variant="heading" numberOfLines={1}>
                            {card.name}
                          </AppText>
                          <AppText variant="caption" muted>
                            {card.progress.completed}/{card.progress.total || 0} completed · {card.progress.percent}%
                            {card.progress.pending ? ` · ${card.progress.pending} pending` : ''}
                            {card.progress.overdue ? ` · ${card.progress.overdue} overdue` : ''}
                          </AppText>
                        </View>
                      </View>
                      <View style={[styles.track, { backgroundColor: p.surfaceVariant }]}>
                        <View style={{ width: `${card.progress.percent}%`, height: 6, backgroundColor: card.color, borderRadius: radius.sm }} />
                      </View>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
                        <AppText variant="caption" color={p.priority[card.priority]}>
                          {PRIORITY_LABEL[card.priority]}
                        </AppText>
                        {due ? (
                          <AppText variant="caption" color={card.target.overdue && card.progress.percent < 100 ? p.overdue : p.textSecondary}>
                            {due}
                          </AppText>
                        ) : (
                          <AppText variant="caption" muted>
                            No target
                          </AppText>
                        )}
                        {card.status !== 'active' ? (
                          <AppText variant="caption" muted>
                            {FOLDER_STATUS_LABEL[card.status]}
                          </AppText>
                        ) : null}
                      </View>
                    </Pressable>
                    {sort === 'manual' ? (
                      <View>
                        <Button label="Up" compact tone="ghost" onPress={() => move(card.id, -1)} />
                        <Button label="Down" compact tone="ghost" onPress={() => move(card.id, 1)} />
                      </View>
                    ) : null}
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
      </ScrollView>
      <SearchFieldPopup visible={searchOpen} value={text} onChangeText={setText} onClose={() => setSearchOpen(false)} placeholder="Search folders" testID="projects-search" />
      <Pressable
        testID="projects-add"
        accessibilityRole="button"
        accessibilityLabel="Add folder"
        onPress={() => setCreating(true)}
        style={({ pressed }) => [
          styles.fab,
          { backgroundColor: p.primary, opacity: pressed ? 0.85 : 1, shadowColor: p.scheme === 'dark' ? '#000000' : p.text },
        ]}>
        <Icon name="add" size={30} color={p.onPrimary} />
      </Pressable>
      <FolderForm
        visible={creating}
        onClose={() => setCreating(false)}
        onSaved={() => {
          shown.reload();
          all.reload();
        }}
      />
      <OptionsModal<FolderListFilter>
        visible={picker === 'filter'}
        title="Filter folders"
        value={filter}
        options={FILTERS}
        onChange={setFilter}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<FolderSortKey>
        visible={picker === 'sort'}
        title="Sort by"
        value={sort}
        options={SORTS}
        onChange={setSort}
        onClose={() => setPicker(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, justifyContent: 'space-between' },
  titleControls: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, flexWrap: 'wrap', justifyContent: 'flex-end', flexShrink: 1 },
  overviewRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
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
