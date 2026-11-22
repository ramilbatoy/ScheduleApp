import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatDateKey, todayKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { filterAgendaItems, matchesNearDueWindow } from '@/domain/services/agendaService';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { AgendaRow, formatDeadline } from '@/ui/components/AgendaRow';
import { AgendaFilterBar, AGENDA_SORT_OPTIONS, useAgendaFilterState } from '@/ui/components/AgendaFilterBar';
import {
  DashboardMonthView,
  DashboardWeekView,
  WeeklyGoalsSection,
  currentWeekAnchor,
  mondayWeekRange,
  shiftMonthAnchor,
  shiftWeekAnchor,
} from '@/ui/components/DashboardPlanner';
import { AppText, Button, Card, Chip, EmptyState, ErrorState, LoadingState, SectionHeader, Segmented } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useAction, useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

type DashMode = 'today' | 'week' | 'month';

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

/** Lightweight StatsService snapshot for Today (day + week completion). */
function TodayStatsSummary() {
  const p = useTheme();
  const day = useQuery((s) => s.stats.report('day'), []);
  const week = useQuery((s) => s.stats.report('week'), []);
  if (day.error && week.error) return <ErrorState message={day.error} onRetry={day.reload} />;
  if (!day.data || !week.data) return day.error || week.error ? null : <LoadingState />;
  const d = day.data.period;
  const w = week.data.period;
  const dayRate = d.completionRate === null ? '—' : `${Math.round(d.completionRate * 100)}%`;
  const weekRate = w.completionRate === null ? '—' : `${Math.round(w.completionRate * 100)}%`;
  return (
    <Card testID="today-stats-summary">
      <AppText variant="label" muted>
        STATISTICS
      </AppText>
      <View style={styles.statsRow}>
        <View style={styles.statCell}>
          <AppText variant="caption" muted>
            Today done
          </AppText>
          <AppText variant="heading">
            {d.completed}/{d.total}
          </AppText>
          <AppText variant="caption" color={p.primary}>
            {dayRate}
          </AppText>
        </View>
        <View style={styles.statCell}>
          <AppText variant="caption" muted>
            Remaining
          </AppText>
          <AppText variant="heading">{d.pending}</AppText>
          <AppText variant="caption" muted>
            {d.overdue ? `${d.overdue} overdue` : 'on track'}
          </AppText>
        </View>
        <View style={styles.statCell}>
          <AppText variant="caption" muted>
            Carried
          </AppText>
          <AppText variant="heading" color={d.carryMoves ? p.warning : p.text}>
            {d.carryMoves}
          </AppText>
          <AppText variant="caption" muted>
            this day
          </AppText>
        </View>
        <View style={styles.statCell}>
          <AppText variant="caption" muted>
            This week
          </AppText>
          <AppText variant="heading">
            {w.completed}/{w.total}
          </AppText>
          <AppText variant="caption" color={p.primary}>
            {weekRate}
          </AppText>
        </View>
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

/** Soonest deadlines / next upcoming tasks with search, sort, and date filters. */
function NearDueTracker({ upcoming, today }: { upcoming: Agenda[]; today: DateKey }) {
  const services = useServices();
  const filterCtl = useAgendaFilterState({ sort: 'deadline', status: 'all' });
  const [dateMode, setDateMode] = useState<'any' | 'today' | 'week'>('any');
  const now = services.clock.now();
  const [weekStart, weekEnd] = mondayWeekRange(today);
  const scheduledSoon = useQuery(
    (s) => s.agenda.list({ status: 'upcoming', kinds: ['task'], sort: 'date' }),
    [],
  );

  const pool = useMemo(() => {
    const byId = new Map<string, Agenda>();
    for (const a of upcoming) byId.set(a.occurrence.id, a);
    for (const a of scheduledSoon.data ?? []) {
      if (!byId.has(a.occurrence.id)) byId.set(a.occurrence.id, a);
    }
    return [...byId.values()];
  }, [upcoming, scheduledSoon.data]);

  const scoped = useMemo(() => {
    const items = pool.filter((a) => matchesNearDueWindow(a, dateMode, today, weekStart, weekEnd));
    return filterAgendaItems(items, filterCtl.filter, today, now);
  }, [pool, dateMode, today, weekStart, weekEnd, filterCtl.state.text, filterCtl.state.status, filterCtl.state.priority, filterCtl.state.categoryId, filterCtl.state.sort, filterCtl.filter, now]);

  return (
    <View style={{ gap: spacing.sm }} testID="near-due-tracker">
      <SectionHeader title="Near-due / upcoming" count={scoped.length} />
      <AppText variant="caption" muted>
        Soonest deadlines and next tasks — search, sort, and narrow by date.
      </AppText>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }} testID="near-due-date">
        {(
          [
            { value: 'any' as const, label: 'Any date' },
            { value: 'today' as const, label: 'Today' },
            { value: 'week' as const, label: 'This week' },
          ] as const
        ).map((o) => (
          <Chip key={o.value} testID={`near-due-date-${o.value}`} label={o.label} selected={dateMode === o.value} onPress={() => setDateMode(o.value)} />
        ))}
      </View>
      <AgendaFilterBar
        testID="near-due-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onSort={filterCtl.setSort}
        showStatusRow={false}
        sorts={AGENDA_SORT_OPTIONS}
        matchCount={scoped.length}
        searchPlaceholder="Search near-due tasks"
      />
      {scoped.length ? (
        <View style={{ gap: spacing.sm }}>
          {scoped.map((a, i) => (
            <View key={a.occurrence.id} style={{ gap: 4 }}>
              {a.task.deadlineAt ? (
                <AppText variant="caption" muted>
                  Due {formatDeadline(a.task.deadlineAt)}
                </AppText>
              ) : null}
              <AgendaRow a={a} showDate testID={`near-due-${i}`} />
            </View>
          ))}
        </View>
      ) : (
        <AppText muted>{pool.length ? 'No matches for these filters.' : 'No near-due or upcoming tasks.'}</AppText>
      )}
    </View>
  );
}

function TodayDashboard() {
  const settings = useSettings();
  const run = useAction();
  const services = useServices();
  const today = todayKey(services.clock);
  const dash = useQuery((s) => s.agenda.dashboard(), []);
  const d = dash.data;
  const pastOverdue = d?.overdue.filter((a) => a.occurrence.date < d.today) ?? [];
  const pendingTasks = d?.tasks.filter((a) => a.occurrence.status === 'pending') ?? [];
  const doneTasks = d?.tasks.filter((a) => a.occurrence.status === 'completed') ?? [];

  return (
    <View style={{ gap: spacing.md }} testID="dashboard-today">
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
          <TodayStatsSummary />

          {pastOverdue.length > 0 ? (
            <SectionHeader
              title="Overdue on today"
              count={pastOverdue.length}
              right={
                !settings.autoCarryForward ? (
                  <Button
                    testID="move-all-today"
                    label="Move all to today"
                    compact
                    tone="secondary"
                    onPress={() => run((s) => s.tasks.moveToToday(pastOverdue.map((a) => a.occurrence.id)), 'Moved to today')}
                  />
                ) : undefined
              }
            />
          ) : null}
          {pastOverdue.length > 0 && !settings.autoCarryForward ? (
            <AppText variant="caption" muted>
              Unfinished tasks from earlier days stay visible here until done. Turn on automatic carry-forward in Settings, or move them.
            </AppText>
          ) : null}

          <SectionHeader title="Schedule" count={d.events.length} />
          {d.events.length ? (
            <List items={d.events} testPrefix="event" />
          ) : (
            <AppText muted>No events today.</AppText>
          )}

          <SectionHeader title="To-do" count={pendingTasks.length} />
          {pendingTasks.length ? (
            <View style={{ gap: spacing.sm }}>
              {pendingTasks.map((a, i) => (
                <AgendaRow
                  key={a.occurrence.id}
                  a={a}
                  showDate={a.occurrence.date < d.today}
                  testID={`todo-${i}`}
                />
              ))}
            </View>
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

          <NearDueTracker upcoming={d.upcomingDeadlines} today={d.today} />
          <WeeklyGoalsSection anchor={today} testID="today-weekly-goals" />
        </>
      ) : null}
    </View>
  );
}

export default function TodayScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const services = useServices();
  const invalidate = useAppStore((s) => s.invalidate);
  const today = todayKey(services.clock);
  const [mode, setMode] = useState<DashMode>('today');
  const [weekAnchor, setWeekAnchor] = useState<DateKey>(() => currentWeekAnchor(today));
  const [weekNavigated, setWeekNavigated] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState<DateKey>(today);
  const [refreshing, setRefreshing] = useState(false);

  // Open Week on the current week unless the user already used prev/next this session.
  useEffect(() => {
    if (mode === 'week' && !weekNavigated) {
      setWeekAnchor(currentWeekAnchor(today));
    }
  }, [mode, today, weekNavigated]);

  async function refresh() {
    setRefreshing(true);
    try {
      await services.runMaintenance();
    } finally {
      invalidate();
      setRefreshing(false);
    }
  }

  const quickAddDate = mode === 'month' ? monthAnchor : mode === 'week' ? weekAnchor : today;

  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Segmented<DashMode>
          testID="dashboard-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'today', label: 'Today' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />

        {mode === 'today' ? <TodayDashboard /> : null}
        {mode === 'week' ? (
          <DashboardWeekView
            anchor={weekAnchor}
            today={today}
            onShiftWeek={(dir) => {
              setWeekNavigated(true);
              setWeekAnchor((a) => shiftWeekAnchor(a, dir));
            }}
            onJumpThisWeek={() => {
              setWeekNavigated(false);
              setWeekAnchor(currentWeekAnchor(today));
            }}
          />
        ) : null}
        {mode === 'month' ? (
          <DashboardMonthView
            anchor={monthAnchor}
            today={today}
            onSelectDay={setMonthAnchor}
            onShiftMonth={(dir) => setMonthAnchor((a) => shiftMonthAnchor(a, dir))}
            onJumpThisMonth={() => setMonthAnchor(today)}
          />
        ) : null}
      </ScrollView>
      <QuickAddButton date={quickAddDate} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 10, borderRadius: radius.pill, overflow: 'hidden' },
  fill: { height: '100%', borderRadius: radius.pill },
  statsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md, marginTop: spacing.sm },
  statCell: { minWidth: '40%', flexGrow: 1, gap: 2 },
});
