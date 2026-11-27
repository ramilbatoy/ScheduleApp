import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { addDaysKey, formatDateKey, fromDateKey, toDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { groupAgendaByDate, isSameMonth } from '@/domain/monthTable';
import {
  filterAgendaItems,
  projectOverdueOntoToday,
  type ListFilter,
} from '@/domain/services/agendaService';
import { groupDayByFolder, groupWeekByFolder } from '@/domain/plannerGroups';
import { selectEmptyFoldersForTasks } from '@/domain/taskListFolders';
import { AgendaFilterBar, useAgendaFilterState } from '@/ui/components/AgendaFilterBar';
import { DatePickerModal } from '@/ui/components/Pickers';
import { MonthTaskGrid } from '@/ui/components/MonthTaskGrid';
import { PlannerDayGroups, PlannerWeekGroups } from '@/ui/components/PlannerFolderGroups';
import { useWeekFilterState, WeekFilterBar } from '@/ui/components/WeekFilterBar';
import { type ListLayout } from '@/ui/components/ViewLayoutToggle';
import { AppText, Button, Card, ErrorState, IconButton, LoadingState } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useServices, useSettings } from '@/state/appStore';
import { radius, spacing } from '@/ui/theme';

/** Notion weekly planner: Monday–Sunday. */
export const DASHBOARD_WEEK_STARTS_ON = 1 as const;

/** Civil-date week start for `day` (0 = Sunday, 1 = Monday). */
export function weekStartKey(day: DateKey, weekStartsOn: 0 | 1 = DASHBOARD_WEEK_STARTS_ON): DateKey {
  return toDateKey(startOfWeek(fromDateKey(day), { weekStartsOn }));
}

export function mondayWeekRange(anchor: DateKey): [DateKey, DateKey] {
  const start = weekStartKey(anchor, DASHBOARD_WEEK_STARTS_ON);
  return [start, toDateKey(endOfWeek(fromDateKey(anchor), { weekStartsOn: DASHBOARD_WEEK_STARTS_ON }))];
}

/** Current-week anchor for first mount / switching into Week (before user prev/next). */
export function currentWeekAnchor(today: DateKey, weekStartsOn: 0 | 1 = DASHBOARD_WEEK_STARTS_ON): DateKey {
  return weekStartKey(today, weekStartsOn);
}

export function shiftWeekAnchor(anchor: DateKey, dir: 1 | -1): DateKey {
  return toDateKey(addDays(fromDateKey(anchor), 7 * dir));
}

export function shiftMonthAnchor(anchor: DateKey, dir: 1 | -1): DateKey {
  return toDateKey(addMonths(fromDateKey(anchor), dir));
}

function applyPlannerFilter(items: Agenda[], filter: ListFilter, today: DateKey, now: Date): Agenda[] {
  return filterAgendaItems(items, filter, today, now);
}

function usePlannerFolderContext(today: DateKey, filter: { text: string; status?: ListFilter['status']; hasPriority: boolean; hasCategory: boolean }) {
  const showEmpty = useSettings().showEmptyFoldersOnTasks;
  const cards = useQuery((s) => s.folders.cards(), []);
  const overall = new Map((cards.data ?? []).map((c) => [c.id, c.progress]));
  const emptyFolders = selectEmptyFoldersForTasks(cards.data ?? [], {
    enabled: showEmpty,
    search: filter.text,
    status: filter.status,
    hasPriority: filter.hasPriority,
    hasCategory: filter.hasCategory,
    includeOnThisKind: true,
    today,
  });
  return { overall, emptyFolders };
}

export function DashboardWeekView({
  anchor,
  today,
  onShiftWeek,
  onJumpThisWeek,
}: {
  anchor: DateKey;
  today: DateKey;
  onShiftWeek: (dir: 1 | -1) => void;
  onJumpThisWeek: () => void;
}) {
  const p = useTheme();
  const services = useServices();
  const [layout, setLayout] = useState<ListLayout>('grid');
  const [start, end] = mondayWeekRange(anchor);
  const thisWeekStart = mondayWeekRange(today)[0];
  const items = useQuery((s) => s.agenda.range(start, end), [start, end]);
  const overdue = useQuery((s) => s.agenda.pendingOverdueBeforeToday(), []);
  const filterCtl = useWeekFilterState({ status: 'all' });
  const now = services.clock.now();
  const folderCtx = usePlannerFolderContext(today, {
    text: filterCtl.state.text,
    status: filterCtl.state.status,
    hasPriority: filterCtl.hasPriority,
    hasCategory: filterCtl.hasCategory,
  });
  const overdueRaw = overdue.data ?? [];
  const filtered = items.data ? applyPlannerFilter(items.data, filterCtl.filter, today, now) : [];
  const overdueFiltered = applyPlannerFilter(overdueRaw, filterCtl.filter, today, now);
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  const earlier = overdueFiltered.filter((a) => a.occurrence.date < start);
  const grouped = groupWeekByFolder(days, [...filtered, ...earlier], {
    today,
    now,
    sort: filterCtl.filter.sort,
    ...folderCtx,
  });
  const title = `${formatDateKey(start, 'MMM d')} – ${formatDateKey(end, start.slice(5, 7) === end.slice(5, 7) ? 'd' : 'MMM d')}`;

  return (
    <View style={{ gap: spacing.sm }} testID="dashboard-week">
      <View style={styles.weekStrip} testID="dash-week-days">
        {days.map((d) => (
          <Pressable
            key={d}
            accessibilityRole="button"
            accessibilityLabel={`Add on ${formatDateKey(d, 'EEEE')}`}
            onPress={() => router.push({ pathname: '/quick-add', params: { date: d } })}
            style={({ pressed }) => [
              styles.weekDayChip,
              { backgroundColor: d === today ? p.primarySoft : p.surfaceVariant, opacity: pressed ? 0.85 : 1 },
            ]}
            testID={`dash-week-${d}`}>
            <AppText variant="caption" color={d === today ? p.primary : p.textSecondary} style={{ textAlign: 'center' }}>
              {formatDateKey(d, 'EEE')}
            </AppText>
            <AppText variant="label" color={d === today ? p.primary : p.text} style={{ textAlign: 'center' }}>
              {formatDateKey(d, 'd')}
            </AppText>
            <View style={styles.dotSlot}>
              {d === today ? <View style={[styles.dot, { backgroundColor: p.primary }]} testID={`dash-week-dot-${d}`} /> : null}
            </View>
          </Pressable>
        ))}
      </View>
      <WeekFilterBar
        testID="dash-week-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onFolder={filterCtl.setFolder}
        matchCount={items.data ? filtered.length + earlier.length : undefined}
        layout={layout}
        onLayoutChange={setLayout}
        leading={
          <View style={styles.weekHeading} testID="dash-week-title-row">
            <IconButton icon="chevron-back" label="Previous week" onPress={() => onShiftWeek(-1)} testID="dash-week-prev" />
            <AppText variant="title" style={{ flex: 1, minWidth: 0 }} numberOfLines={1} testID="dash-week-title">
              {title}
            </AppText>
            <IconButton icon="chevron-forward" label="Next week" onPress={() => onShiftWeek(1)} testID="dash-week-next" />
          </View>
        }
        beforeSearch={
          <IconButton
            testID="dash-week-this"
            icon="today-outline"
            label="This week"
            onPress={onJumpThisWeek}
            color={start === thisWeekStart ? p.primary : undefined}
          />
        }
      />
      {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}
      {!items.data && !items.error ? <LoadingState /> : null}
      {items.data ? <PlannerWeekGroups groups={grouped} today={today} layout={layout} testID="dash-week-groups" /> : null}
    </View>
  );
}

export function DashboardMonthView({
  anchor,
  today,
  onSelectDay,
  onShiftMonth,
  onJumpThisMonth,
}: {
  anchor: DateKey;
  today: DateKey;
  onSelectDay: (d: DateKey) => void;
  onShiftMonth: (dir: 1 | -1) => void;
  onJumpThisMonth: () => void;
}) {
  const services = useServices();
  const [goToOpen, setGoToOpen] = useState(false);
  const [layout, setLayout] = useState<ListLayout>('grid');
  const monthStart = `${anchor.slice(0, 7)}-01` as DateKey;
  const monthEnd = toDateKey(addDays(addMonths(fromDateKey(monthStart), 1), -1));
  const gridFirst = toDateKey(startOfWeek(fromDateKey(monthStart), { weekStartsOn: 0 }));
  const gridLast = toDateKey(endOfWeek(fromDateKey(monthEnd), { weekStartsOn: 0 }));
  const range = useQuery((s) => s.agenda.range(gridFirst, gridLast), [gridFirst, gridLast]);
  const overdue = useQuery((s) => s.agenda.pendingOverdueBeforeToday(), []);
  const day = useQuery((s) => s.agenda.day(anchor), [anchor]);
  const filterCtl = useAgendaFilterState({ sort: 'date', status: 'all' });
  const folderCtx = usePlannerFolderContext(today, {
    text: filterCtl.state.text,
    status: filterCtl.state.status,
    hasPriority: !!filterCtl.state.priority,
    hasCategory: !!filterCtl.state.categoryId,
  });
  const now = services.clock.now();
  const filteredRange = range.data ? applyPlannerFilter(range.data, filterCtl.filter, today, now) : [];
  const overdueFiltered = applyPlannerFilter(overdue.data ?? [], filterCtl.filter, today, now);
  const itemsByDate = projectOverdueOntoToday(groupAgendaByDate(filteredRange), overdueFiltered, today);
  const filteredDay = day.data ? applyPlannerFilter(day.data, filterCtl.filter, today, now) : [];
  const dayGroups = groupDayByFolder(filteredDay, { today, now, ...folderCtx });

  return (
    <View style={{ gap: spacing.md }} testID="dashboard-month">
      <View style={styles.nav}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => onShiftMonth(-1)} testID="dash-month-prev" />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Go to date"
          onPress={() => setGoToOpen(true)}
          testID="dash-month-title"
          style={({ pressed }) => [{ flex: 1, opacity: pressed ? 0.75 : 1 }]}>
          <AppText variant="title" style={{ textAlign: 'center' }}>
            {format(fromDateKey(anchor), 'MMMM yyyy')}
          </AppText>
        </Pressable>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => onShiftMonth(1)} testID="dash-month-next" />
      </View>
      {!isSameMonth(anchor, today) ? (
        <Button label="This month" compact tone="ghost" icon="today-outline" onPress={onJumpThisMonth} testID="dash-month-this" style={styles.thisWeekBtn} />
      ) : null}
      {range.error ? <ErrorState message={range.error} onRetry={range.reload} /> : null}
      {!range.data && !range.error ? <LoadingState /> : null}
      {range.data ? (
        <Card style={{ padding: spacing.sm }}>
          <MonthTaskGrid
            month={anchor}
            selected={anchor}
            today={today}
            itemsByDate={itemsByDate}
            now={now}
            presentation="folders"
            onSelectDay={onSelectDay}
            onDoubleSelectDay={(d) => router.push({ pathname: '/quick-add', params: { date: d } })}
          />
        </Card>
      ) : null}
      <AgendaFilterBar
        testID="dash-month-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onSort={filterCtl.setSort}
        matchCount={range.data ? filteredRange.length : undefined}
        layout={layout}
        onLayoutChange={setLayout}
      />
      <AppText variant="heading">{formatDateKey(anchor, 'EEEE, MMMM d')}</AppText>
      {day.error ? <ErrorState message={day.error} onRetry={day.reload} /> : null}
      {!day.data && !day.error ? <LoadingState /> : null}
      {day.data ? (
        <PlannerDayGroups
          groups={dayGroups}
          today={today}
          rangeLabel="This day"
          testID="dash-month-groups"
          emptyText={day.data.length ? 'No matches for this day.' : 'Nothing scheduled.'}
          showTaskDate={(a) => a.occurrence.date !== anchor}
          hideUnassignedHeader
          layout={layout}
        />
      ) : null}
      <DatePickerModal
        visible={goToOpen}
        value={anchor}
        today={today}
        title="Go to date"
        onChange={onSelectDay}
        onClose={() => setGoToOpen(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  weekHeading: { flexDirection: 'row', alignItems: 'center', gap: 2, minWidth: 0 },
  weekStrip: { flexDirection: 'row', gap: spacing.xs },
  weekDayChip: {
    flex: 1,
    minWidth: 0,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    paddingHorizontal: 2,
    alignItems: 'center',
    gap: 2,
  },
  thisWeekBtn: { alignSelf: 'center' },
  dotSlot: { height: 6, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
});
