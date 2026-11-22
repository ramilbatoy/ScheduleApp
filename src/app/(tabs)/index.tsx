import { router } from 'expo-router';
import { useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateKey } from '@/domain/dates';
import type { Agenda } from '@/domain/models';
import { useAppStore, useSettings } from '@/state/appStore';
import { AgendaRow, formatDeadline } from '@/ui/components/AgendaRow';
import { AppText, Button, Card, EmptyState, ErrorState, LoadingState, SectionHeader } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useAction, useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

function ProgressCard({ completed, total, carried }: { completed: number; total: number; carried: number }) {
  const p = useTheme();
  const pct = total ? Math.round((completed / total) * 100) : 0;
  return (
    <Card testID="progress-card">
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <View>
          <AppText variant="label" muted>
            DAILY PROGRESS
          </AppText>
          <AppText variant="title">
            {completed} of {total} done
          </AppText>
        </View>
        <AppText variant="display" color={p.primary}>
          {pct}%
        </AppText>
      </View>
      <View style={[styles.track, { backgroundColor: p.surfaceAlt }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: p.success }]} />
      </View>
      <View style={{ flexDirection: 'row', gap: spacing.lg }}>
        <AppText variant="caption" muted>
          {total - completed} remaining
        </AppText>
        {carried > 0 ? (
          <AppText variant="caption" color={p.warning}>
            {carried} carried over
          </AppText>
        ) : null}
      </View>
    </Card>
  );
}

function List({ items, testPrefix }: { items: Agenda[]; testPrefix: string }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((a, i) => (
        <AgendaRow key={a.occurrence.id} a={a} testID={`${testPrefix}-${i}`} />
      ))}
    </View>
  );
}

export default function TodayScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const settings = useSettings();
  const services = useAppStore((s) => s.services)!;
  const invalidate = useAppStore((s) => s.invalidate);
  const run = useAction();
  const [refreshing, setRefreshing] = useState(false);
  const dash = useQuery((s) => s.agenda.dashboard(), []);

  async function refresh() {
    setRefreshing(true);
    try {
      await services.runMaintenance();
    } finally {
      invalidate();
      setRefreshing(false);
    }
  }

  const d = dash.data;
  const pastOverdue = d?.overdue.filter((a) => a.occurrence.date < d.today) ?? [];
  const pendingTasks = d?.tasks.filter((a) => a.occurrence.status === 'pending') ?? [];
  const doneTasks = d?.tasks.filter((a) => a.occurrence.status === 'completed') ?? [];

  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <View style={{ paddingTop: spacing.sm }}>
          <AppText variant="label" muted>
            {d ? formatDateKey(d.today, 'EEEE').toUpperCase() : ''}
          </AppText>
          <AppText variant="display">{d ? formatDateKey(d.today, 'MMMM d, yyyy') : 'Today'}</AppText>
        </View>

        {dash.error ? <ErrorState message={dash.error} onRetry={dash.reload} /> : null}
        {!d && !dash.error ? <LoadingState /> : null}

        {d ? (
          <>
            <ProgressCard completed={d.completed} total={d.total} carried={d.carriedCount} />

            {pastOverdue.length > 0 ? (
              <>
                <SectionHeader
                  title="Overdue"
                  count={pastOverdue.length}
                  right={
                    <Button
                      testID="move-all-today"
                      label="Move all to today"
                      compact
                      tone="secondary"
                      onPress={() => run((s) => s.tasks.moveToToday(pastOverdue.map((a) => a.occurrence.id)), 'Moved to today')}
                    />
                  }
                />
                {!settings.autoCarryForward ? (
                  <AppText variant="caption" muted>
                    Automatic carry-forward is off. Move items manually or turn it on in Settings.
                  </AppText>
                ) : null}
                <List items={pastOverdue} testPrefix="overdue" />
              </>
            ) : null}

            <SectionHeader title="Schedule" count={d.events.length} />
            {d.events.length ? (
              <List items={d.events} testPrefix="event" />
            ) : (
              <AppText muted>No events today.</AppText>
            )}

            <SectionHeader title="To-do" count={pendingTasks.length} />
            {pendingTasks.length ? (
              <List items={pendingTasks} testPrefix="todo" />
            ) : d.tasks.length ? (
              <AppText muted>All of today&apos;s tasks are done.</AppText>
            ) : (
              <EmptyState
                icon="checkbox-outline"
                title="Nothing planned for today"
                message="Use the + button to add a task or event."
                action={<Button label="Add a task" tone="secondary" icon="add" onPress={() => router.push('/quick-add')} />}
              />
            )}

            {doneTasks.length ? (
              <>
                <SectionHeader title="Completed" count={doneTasks.length} />
                <List items={doneTasks} testPrefix="done" />
              </>
            ) : null}

            {d.upcomingDeadlines.length ? (
              <>
                <SectionHeader title="Upcoming deadlines" count={d.upcomingDeadlines.length} />
                <Card>
                  {d.upcomingDeadlines.map((a) => (
                    <Button
                      key={a.occurrence.id}
                      tone="ghost"
                      compact
                      icon="hourglass-outline"
                      label={`${a.task.title} — ${formatDeadline(a.task.deadlineAt!)}`}
                      onPress={() => router.push({ pathname: '/item/[id]', params: { id: a.occurrence.id } })}
                      style={{ justifyContent: 'flex-start' }}
                    />
                  ))}
                </Card>
              </>
            ) : null}
          </>
        ) : null}
      </ScrollView>
      <QuickAddButton date={d?.today} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
});
