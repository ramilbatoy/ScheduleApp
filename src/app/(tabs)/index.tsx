import { useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { formatDateKey, todayKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { filterAgendaItems } from '@/domain/services/agendaService';
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
import { useWeekFilterState, WeekFilterBar } from '@/ui/components/WeekFilterBar';
import { type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText, Button, Card, ErrorState, Icon, LoadingState, SectionHeader, Segmented } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useAction, useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

const EMPTY_DAY_COPY = 'Nothing is currently listed here.';

type DashMode = 'today' | 'week' | 'month';

function ProgressCard({ completed, total, carried }: { completed: number; total: number; carried: number }) {
  const p = useTheme();
  const [open, setOpen] = useState(false);
  const pct = total ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);
  return (
    <Card testID="progress-card" style={{ gap: spacing.sm }}>
      <Pressable
        testID="progress-toggle"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} daily progress`}
        onPress={() => setOpen((v) => !v)}
        style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: p.primarySoft, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name="sunny-outline" color={p.primary} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title" numberOfLines={1}>
              Daily progress
            </AppText>
            <AppText variant="caption" muted>
              {completed}/{total} completed · {pct}%
            </AppText>
          </View>
          <AppText variant="title" color={p.primary}>
            {pct}%
          </AppText>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} color={p.textSecondary} />
        </View>
      </Pressable>
      <View style={[styles.track, { backgroundColor: p.surfaceVariant }]} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
        <View style={[styles.fill, { width: `${pct}%`, backgroundColor: p.success }]} />
      </View>
      {open ? (
        <View testID="progress-details" style={{ gap: spacing.xs }}>
          <AppText>
            {completed} of {total} completed
          </AppText>
          <AppText variant="caption" muted>
            {remaining} remaining
          </AppText>
          {carried > 0 ? (
            <AppText variant="caption" color={p.warning}>
              {carried} carried over
            </AppText>
          ) : null}
        </View>
      ) : null}
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
  const filterCtl = useWeekFilterState({ status: 'all' });
  const [layout, setLayout] = useState<ListLayout>('grid');
  const now = services.clock.now();
  const items = dayQ.data ?? [];
  const overall = new Map((cards.data ?? []).map((c) => [c.id, c.progress]));
  const emptyFolders = selectEmptyFoldersForTasks(cards.data ?? [], {
    enabled: settings.showEmptyFoldersOnTasks,
    search: filterCtl.state.text,
    status: filterCtl.state.status,
    hasPriority: filterCtl.hasPriority,
    hasCategory: filterCtl.hasCategory,
    includeOnThisKind: true,
    today: systemToday,
  });
  const filtered = filterAgendaItems(items, filterCtl.filter, systemToday, now);
  const pastOverdueRaw =
    selectedDate === systemToday ? (overdueQ.data ?? []).filter((a) => a.occurrence.date < systemToday) : [];
  const pastOverdue = filterAgendaItems(pastOverdueRaw, filterCtl.filter, systemToday, now);
  const filteredEvents = filtered.filter((a) => a.task.kind === 'event');
  const filteredTasks = filtered.filter((a) => a.task.kind === 'task');
  const dayGroups = groupDayByFolder(filteredTasks, { today: systemToday, now, overall, emptyFolders });
  const progress = dayProgressFromAgenda(filtered);
  const hasListed =
    pastOverdue.length > 0 ||
    filteredEvents.length > 0 ||
    dayGroups.folders.length > 0 ||
    dayGroups.unassigned.length > 0;

  return (
    <View style={{ gap: spacing.md }} testID="dashboard-today">
      <View style={{ paddingTop: spacing.sm }}>
        <AppText variant="display" testID="today-heading">
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

      <WeekFilterBar
        testID="today-status-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onFolder={filterCtl.setFolder}
        layout={layout}
        onLayoutChange={setLayout}
        searchPlaceholder="Search: task, events, or folder"
      />

      {dayQ.error ? <ErrorState message={dayQ.error} onRetry={dayQ.reload} /> : null}
      {!dayQ.data && !dayQ.error ? <LoadingState /> : null}

      {dayQ.data && !hasListed ? <AppText muted testID="today-empty-copy">{EMPTY_DAY_COPY}</AppText> : null}

      {dayQ.data && hasListed ? (
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
              Unfinished tasks from earlier days stay visible here until completed. Turn on automatic carry-forward in Settings, or move them.
            </AppText>
          ) : null}

          {filteredEvents.length > 0 ? (
            <>
              <SectionHeader title="Schedule" count={filteredEvents.length} />
              <List items={filteredEvents} testPrefix="event" />
            </>
          ) : null}

          {dayGroups.folders.length > 0 || dayGroups.unassigned.length > 0 ? (
            <>
              <SectionHeader title="Tasks" count={filteredTasks.length} />
              <PlannerDayGroups
                groups={dayGroups}
                today={systemToday}
                rangeLabel={selectedDate === systemToday ? 'Today' : formatDateKey(selectedDate, 'MMM d')}
                testID="dash-today-groups"
                emptyText={EMPTY_DAY_COPY}
                showTaskDate={(a) => a.occurrence.date < systemToday}
                hideUnassignedHeader
                layout={layout}
              />
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
