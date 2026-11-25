import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { FolderCard, FolderListFilter, FolderSortKey } from '@/domain/folderProgress';
import { useServices } from '@/state/appStore';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderForm } from '@/ui/components/FolderForm';
import { OptionsModal } from '@/ui/components/Pickers';
import { ReadyScreen } from '@/ui/components/ReadyScreen';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, type IconName } from '@/ui/components/primitives';
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
  useSafeAndroidBack();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<FolderListFilter>('all');
  const [sort, setSort] = useState<FolderSortKey>('name');
  const [creating, setCreating] = useState(false);
  const [picker, setPicker] = useState<null | 'filter' | 'sort'>(null);
  const all = useQuery((s) => s.folders.cards(), []);
  const shown = useQuery((s) => s.folders.cards({ text, filter, sort }), [text, filter, sort]);
  const filterLabel = FILTERS.find((f) => f.value === filter)?.label ?? 'All';
  const sortLabel = SORTS.find((s) => s.value === sort)?.label ?? 'Name';

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
    <>
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        <AppText variant="display">Folders</AppText>
        <AppText variant="caption" muted testID="projects-overview">
          {counts.active} active · {counts.overdue} overdue · {counts.completed} completed
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input testID="projects-search" value={text} onChangeText={setText} placeholder="Search folders" />
          </View>
          <Button testID="projects-add" label="Add" icon="add" onPress={() => setCreating(true)} />
        </View>
        <View style={styles.chipRow} testID="projects-filter-row">
          <Chip
            testID="projects-filter"
            icon="filter-outline"
            label={`Status: ${filterLabel}`}
            selected={filter !== 'all'}
            onPress={() => setPicker('filter')}
          />
          <Chip
            testID="projects-sort"
            icon="swap-vertical"
            label={`Sort: ${sortLabel}`}
            selected={sort !== 'name'}
            onPress={() => setPicker('sort')}
          />
        </View>
        {shown.error ? <ErrorState message={shown.error} onRetry={shown.reload} /> : null}
        {!shown.data && !shown.error ? <LoadingState /> : null}
        {shown.data && shown.data.length === 0 ? (
          <EmptyState icon="folder-open-outline" title={text ? 'No matches' : 'No folders yet'} message="Folders group tasks into projects. Categories stay separate." action={<Button label="Add folder" icon="add" onPress={() => setCreating(true)} />} />
        ) : null}
        {shown.data?.map((card, index) => {
          const due = targetLabel(card);
          const open = () => router.push({ pathname: '/folder/[id]', params: { id: card.id } });
          return (
            <Card key={card.id} testID={`project-card-${index}`}>
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
          );
        })}
      </ScrollView>
      <FolderForm visible={creating} onClose={() => setCreating(false)} onSaved={() => { shown.reload(); all.reload(); }} />
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
    </>
  );
}

const styles = StyleSheet.create({
  track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
