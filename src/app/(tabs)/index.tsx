import { useEffect, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';

import { formatDateKey, todayKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { filterAgendaItems } from '@/domain/services/agendaService';
import { groupDayByFolder } from '@/domain/plannerGroups';
import { selectEmptyFoldersForTasks } from '@/domain/taskListFolders';
import { useAppStore, useServices, useSettings, type DashMode } from '@/state/appStore';
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
import { useFolderGridColumns } from '@/ui/hooks/useFolderGridColumns';
import { folderGridCellStyle, folderGridWrapStyle } from '@/ui/layout/folderGrid';
import { AppText, Button, Card, ErrorState, Icon, IconButton, LoadingState, SectionHeader, Segmented } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useAction, useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

const EMPTY_DAY_COPY = 'Nothing is currently listed here.';

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

function List({ items, testPrefix, layout = 'list' }: { items: Agenda[]; testPrefix: string; layout?: ListLayout }) {
  const { columns, onGridLayout, compact } = useFolderGridColumns(layout);
  const grid = layout === 'grid';
  return (
    <View
      style={grid ? [folderGridWrapStyle(), { marginHorizontal: 0 }] : { gap: spacing.sm }}
      onLayout={grid ? onGridLayout : undefined}
      testID={grid ? `${testPrefix}-grid` : undefined}>
      {items.map((a, i) => (
        <View key={a.occurrence.id} style={grid ? folderGridCellStyle(columns) : undefined}>
          <AgendaRow a={a} compact={compact} testID={`${testPrefix}-${i}`} />
        </View>
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
    <View style={{ gap: spacing.sm }} testID="dashboard-today">
      <DateStrip
        selected={selectedDate}
        today={systemToday}
        summaries={summariesQ.data}
        onSelect={onSelectDate}
        testID="today-date-strip"
        showTodayButton={false}
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
        leading={
          <AppText variant="title" testID="today-heading" numberOfLines={1}>
            {selectedDate === systemToday ? 'Today' : formatDateKey(selectedDate, 'EEEE, MMMM d')}
          </AppText>
        }
        beforeSearch={
          <IconButton testID="today-jump" icon="today-outline" label="Today" onPress={() => onSelectDate(systemToday)} />
        }
      />

      {dayQ.error ? <ErrorState message={dayQ.error} onRetry={dayQ.reload} /> : null}
      {!dayQ.data && !dayQ.error ? <LoadingState /> : null}

      {dayQ.data && !hasListed ? <AppText muted testID="today-empty-copy">{EMPTY_DAY_COPY}</AppText> : null}

      {dayQ.data && hasListed ? (
        <View style={{ gap: spacing.sm }}>
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
              <SectionHeader title="Events" count={filteredEvents.length} />
              <List items={filteredEvents} testPrefix="event" layout={layout} />
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
        </View>
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
  const invalidate = useAppStore((s) => s.invalidate);
  const mode = useAppStore((s) => s.dashMode);
  const setMode = useAppStore((s) => s.setDashMode);
  const dayFocusToken = useAppStore((s) => s.dayFocusToken);
  const today = todayKey(services.clock);
  const [selectedDate, setSelectedDate] = useState<DateKey>(today);
  const [weekAnchor, setWeekAnchor] = useState<DateKey>(() => currentWeekAnchor(today));
  const [weekNavigated, setWeekNavigated] = useState(false);
  const [monthAnchor, setMonthAnchor] = useState<DateKey>(today);
  const [refreshing, setRefreshing] = useState(false);

  // Footer Day tab bumps dayFocusToken → reset the date strip to today (Calendar uses Month and must not).
  useEffect(() => {
    if (dayFocusToken === 0) return;
    setSelectedDate(todayKey(services.clock));
  }, [dayFocusToken, services.clock]);

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
        contentContainerStyle={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md, paddingBottom: 120, gap: spacing.sm }}
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
