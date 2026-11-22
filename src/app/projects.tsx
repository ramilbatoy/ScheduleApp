import { router, Stack } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import type { FolderCard, FolderListFilter, FolderSortKey } from '@/domain/folderProgress';
import { useServices } from '@/state/appStore';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderForm } from '@/ui/components/FolderForm';
import { MenuButton } from '@/ui/components/MenuButton';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, Icon, Input, LoadingState, type IconName } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useSafeAndroidBack } from '@/ui/navigation';
import { radius, spacing } from '@/ui/theme';

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
  const p = useTheme();
  const services = useServices();
  useSafeAndroidBack();
  const [text, setText] = useState('');
  const [filter, setFilter] = useState<FolderListFilter>('all');
  const [sort, setSort] = useState<FolderSortKey>('name');
  const [creating, setCreating] = useState(false);
  const all = useQuery((s) => s.folders.cards(), []);
  const shown = useQuery((s) => s.folders.cards({ text, filter, sort }), [text, filter, sort]);

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
      <Stack.Screen options={{ title: 'Projects', headerRight: () => <MenuButton /> }} />
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md, paddingBottom: 48 }}>
        <AppText variant="caption" muted testID="projects-overview">
          {counts.active} active · {counts.overdue} overdue · {counts.completed} completed
        </AppText>
        <View style={{ flexDirection: 'row', gap: spacing.sm }}>
          <View style={{ flex: 1 }}>
            <Input testID="projects-search" value={text} onChangeText={setText} placeholder="Search folders" />
          </View>
          <Button testID="projects-add" label="Add" icon="add" onPress={() => setCreating(true)} />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {FILTERS.map((f) => (
            <Chip key={f.value} testID={`projects-filter-${f.value}`} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
          ))}
        </ScrollView>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }}>
          {SORTS.map((s) => (
            <Chip key={s.value} testID={`projects-sort-${s.value}`} label={s.label} selected={sort === s.value} onPress={() => setSort(s.value)} />
          ))}
        </ScrollView>
        {shown.error ? <ErrorState message={shown.error} onRetry={shown.reload} /> : null}
        {!shown.data && !shown.error ? <LoadingState /> : null}
        {shown.data && shown.data.length === 0 ? (
          <EmptyState icon="folder-open-outline" title={text ? 'No matches' : 'No folders yet'} message="Folders group tasks into projects. Categories stay separate." action={<Button label="Add folder" icon="add" onPress={() => setCreating(true)} />} />
        ) : null}
        {shown.data?.map((card, index) => {
          const due = targetLabel(card);
          return (
            <Card key={card.id} testID={`project-card-${index}`} onPress={() => router.push({ pathname: '/folder/[id]', params: { id: card.id } })}>
              <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
                <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: `${card.color}22`, alignItems: 'center', justifyContent: 'center' }}>
                  <Icon name={card.icon as IconName} color={card.color} />
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <AppText variant="heading" numberOfLines={1}>
                    {card.name}
                  </AppText>
                  <AppText variant="caption" muted>
                    {card.progress.completed}/{card.progress.total || 0} done · {card.progress.percent}%
                    {card.progress.pending ? ` · ${card.progress.pending} pending` : ''}
                    {card.progress.overdue ? ` · ${card.progress.overdue} overdue` : ''}
                  </AppText>
                </View>
                {sort === 'manual' ? (
                  <View>
                    <Button label="Up" compact tone="ghost" onPress={() => move(card.id, -1)} />
                    <Button label="Down" compact tone="ghost" onPress={() => move(card.id, 1)} />
                  </View>
                ) : null}
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
                    {card.status}
                  </AppText>
                ) : null}
              </View>
            </Card>
          );
        })}
      </ScrollView>
      <FolderForm visible={creating} onClose={() => setCreating(false)} onSaved={() => { shown.reload(); all.reload(); }} />
    </>
  );
}

const styles = { track: { height: 6, borderRadius: radius.sm, overflow: 'hidden' as const } };
