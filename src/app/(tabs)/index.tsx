import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { formatDateKey, todayKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { filterAgendaItems, type StatusFilter } from '@/domain/services/agendaService';
import { groupDayByFolder } from '@/domain/plannerGroups';
import { selectEmptyFoldersForTasks } from '@/domain/taskListFolders';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { AgendaRow } from '@/ui/components/AgendaRow';
import { DateStrip, DATE_STRIP_RADIUS, dateStripWindow, dayProgressFromAgenda } from '@/ui/components/DateStrip';
import {
  DashboardMonthView,
  DashboardWeekView,
  currentWeekAnchor,
  shiftMonthAnchor,
  shiftWeekAnchor,
} from '@/ui/components/DashboardPlanner';
import { PlannerDayGroups } from '@/ui/components/PlannerFolderGroups';
import { ReadyScreen } from '@/ui/components/ReadyScreen';
import { StatusFilterDropdown } from '@/ui/components/StatusFilterDropdown';
import { AppText, Button, Card, ErrorState, LoadingState, SectionHeader, Segmented } from '@/ui/components/primitives';
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
      <View style={[styles.track, { backgroundColor: p.surfaceVariant }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
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

function TodayDashboard({
  selectedDate,
  onSelectDate,
}: {
  selectedDate: DateKey;
  onSelectDate: (d: DateKey) => void;
}) {
  const settings = useSettings();
  const run = useAction();
  const services = useServices();
  const systemToday = todayKey(services.clock);
  const dayQ = useQuery((s) => s.agenda.day(selectedDate), [selectedDate]);
  const overdueQ = useQuery((s) => s.agenda.pendingOverdueBeforeToday(), []);
  const cards = useQuery((s) => s.folders.cards(), []);
  const stripDays = useMemo(() => dateStripWindow(selectedDate, DATE_STRIP_RADIUS), [selectedDate]);
  const stripStart = stripDays[0]!;
  const stripEnd = stripDays[stripDays.length - 1]!;
  const summariesQ = useQuery((s) => s.agenda.summaries(stripStart, stripEnd), [stripStart, stripEnd]);
  const [status, setStatus] = useState<StatusFilter>('all');
  const now = services.clock.now();
  const items = dayQ.data ?? [];
  const pastOverdue =
    selectedDate === systemToday ? (overdueQ.data ?? []).filter((a) => a.occurrence.date < systemToday) : [];
  const overall = new Map((cards.data ?? []).map((c) => [c.id, c.progress]));
  const emptyFolders = selectEmptyFoldersForTasks(cards.data ?? [], {
    enabled: settings.showEmptyFoldersOnTasks,
    search: '',
    status,
    hasPriority: false,
    hasCategory: false,
    includeOnThisKind: true,
    today: systemToday,
  });
  const filtered = filterAgendaItems(items, { status, sort: 'date' }, systemToday, now);
  const filteredEvents = filtered.filter((a) => a.task.kind === 'event');
  const filteredTasks = filtered.filter((a) => a.task.kind === 'task');
  const dayGroups = groupDayByFolder(filteredTasks, { today: systemToday, now, overall, emptyFolders });
  const progress = dayProgressFromAgenda(items);

  const dayEmpty =
    !!dayQ.data && items.length === 0 && pastOverdue.length === 0 && emptyFolders.length === 0;

  return (
    <View style={{ gap: spacing.md }} testID="dashboard-today">
      <View style={{ paddingTop: spacing.sm }}>
        <AppText variant="display" testID="today-heading" style={{ fontSize: 20, lineHeight: 26 }}>
          {selectedDate === systemToday ? 'Today' : formatDateKey(selectedDate, 'EEEE, MMMM d')}
        </AppText>
      </View>

      <DateStrip
        selected={selectedDate}
        today={systemToday}
        summaries={summariesQ.data}
        onSelect={onSelectDate}
        testID="today-date-strip"
      />

      <StatusFilterDropdown value={status} onChange={setStatus} testID="today-status-filter" />

      {dayQ.error ? <ErrorState message={dayQ.error} onRetry={dayQ.reload} /> : null}
      {!dayQ.data && !dayQ.error ? <LoadingState /> : null}

      {dayQ.data && !dayEmpty ? (
        <>
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

          {filteredEvents.length > 0 || items.some((a) => a.task.kind === 'event') ? (
            <>
              <SectionHeader title="Schedule" count={filteredEvents.length} />
              {filteredEvents.length ? (
                <List items={filteredEvents} testPrefix="event" />
              ) : (
                <AppText muted>No events match this filter.</AppText>
              )}
            </>
          ) : null}

          {items.some((a) => a.task.kind === 'task') || emptyFolders.length || filteredTasks.length ? (
            <>
              <SectionHeader title="Tasks" count={filteredTasks.length} />
              {items.some((a) => a.task.kind === 'task') || emptyFolders.length ? (
                <PlannerDayGroups
                  groups={dayGroups}
                  today={systemToday}
                  rangeLabel={selectedDate === systemToday ? 'Today' : formatDateKey(selectedDate, 'MMM d')}
                  testID="dash-today-groups"
                  emptyText={items.some((a) => a.task.kind === 'task') ? 'No tasks match this filter.' : 'No tasks this day.'}
                  showTaskDate={(a) => a.occurrence.date < systemToday}
                  hideUnassignedHeader
                />
              ) : (
                <AppText muted>No tasks match this filter.</AppText>
              )}
            </>
          ) : null}

          {progress.total > 0 ? <ProgressCard completed={progress.completed} total={progress.total} carried={progress.carried} /> : null}
        </>
      ) : null}
    </View>
  );
}

/** Placeholder while AppProvider finishes opening storage (Stack stays mounted). */
export default function TodayScreen() {
  return (
    <ReadyScreen testID="today-boot">
      <TodayScreenReady />
    </ReadyScreen>
  );
}

function TodayScreenReady() {
  const p = useTheme();
  const services = useServices();
  const navigation = useNavigation();
  const invalidate = useAppStore((s) => s.invalidate);
  const today = todayKey(services.clock);
  const [mode, setMode] = useState<DashMode>('today');
  const [selectedDate, setSelectedDate] = useState<DateKey>(today);
  const [weekAnchor, setWeekAnchor] = useState<DateKey>(() => currentWeekAnchor(today));
  const [weekNavigated, setWeekNavigated] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState<DateKey>(today);
  const [refreshing, setRefreshing] = useState(false);

  const jumpToToday = useCallback(() => {
    const d = todayKey(services.clock);
    setMode('today');
    setSelectedDate(d);
  }, [services.clock]);

  // Bottom Day tab (route id `index`): show Day mode focused on the current local date.
  useEffect(() => {
    // Tab navigators emit `tabPress`; the root stack NavigationProp typing does not list it.
    const tabNav = navigation as unknown as { addListener: (event: 'tabPress', cb: () => void) => () => void };
    return tabNav.addListener('tabPress', jumpToToday);
  }, [navigation, jumpToToday]);

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

  const quickAddDate = mode === 'month' ? monthAnchor : mode === 'week' ? weekAnchor : selectedDate;

  return (
    <View style={{ flex: 1, backgroundColor: p.background }}>
      <ScrollView
        contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        nestedScrollEnabled>
        <Segmented<DashMode>
          testID="dashboard-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'today', label: 'Day' },
            { value: 'week', label: 'Week' },
            { value: 'month', label: 'Month' },
          ]}
        />

        {mode === 'today' ? <TodayDashboard selectedDate={selectedDate} onSelectDate={setSelectedDate} /> : null}
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
});
