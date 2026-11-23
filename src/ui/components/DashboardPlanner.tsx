import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

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
    <View style={{ gap: spacing.md }} testID="dashboard-week">
      <View style={styles.nav}>
        <IconButton icon="chevron-back" label="Previous week" onPress={() => onShiftWeek(-1)} testID="dash-week-prev" />
        <AppText variant="title" style={{ flex: 1, textAlign: 'center' }} testID="dash-week-title">
          {title}
        </AppText>
        <IconButton icon="chevron-forward" label="Next week" onPress={() => onShiftWeek(1)} testID="dash-week-next" />
      </View>
      {start !== thisWeekStart ? (
        <Button label="This week" compact tone="ghost" icon="locate-outline" onPress={onJumpThisWeek} />
      ) : null}
      <WeekFilterBar
        testID="dash-week-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onFolder={filterCtl.setFolder}
        matchCount={items.data ? filtered.length + earlier.length : undefined}
      />
      <View style={styles.weekStrip} testID="dash-week-days">
        {days.map((d) => (
          <View key={d} style={[styles.weekDayChip, { backgroundColor: d === today ? p.primarySoft : p.surfaceVariant }]} testID={`dash-week-${d}`}>
            <AppText variant="caption" color={d === today ? p.primary : p.textSecondary} style={{ textAlign: 'center' }}>
              {formatDateKey(d, 'EEE')}
            </AppText>
            <AppText variant="label" color={d === today ? p.primary : p.text} style={{ textAlign: 'center' }}>
              {formatDateKey(d, 'd')}
            </AppText>
            <IconButton
              icon="add-circle-outline"
              label={`Add on ${formatDateKey(d, 'EEEE')}`}
              color={p.primary}
              size={18}
              onPress={() => router.push({ pathname: '/quick-add', params: { date: d } })}
              testID={`dash-week-add-${d}`}
            />
          </View>
        ))}
      </View>
      {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}
      {!items.data && !items.error ? <LoadingState /> : null}
      {items.data ? <PlannerWeekGroups groups={grouped} today={today} testID="dash-week-groups" /> : null}
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
        <AppText variant="title" style={{ flex: 1, textAlign: 'center' }} testID="dash-month-title">
          {format(fromDateKey(anchor), 'MMMM yyyy')}
        </AppText>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => onShiftMonth(1)} testID="dash-month-next" />
      </View>
      <View style={styles.goToRow}>
        <Button
          label="Go to date"
          compact
          tone="secondary"
          icon="calendar-outline"
          onPress={() => setGoToOpen(true)}
          testID="dash-month-goto"
        />
        {!isSameMonth(anchor, today) ? (
          <Button label="This month" compact tone="ghost" icon="locate-outline" onPress={onJumpThisMonth} testID="dash-month-this" />
        ) : null}
      </View>
      <AgendaFilterBar
        testID="dash-month-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onSort={filterCtl.setSort}
        matchCount={range.data ? filteredRange.length : undefined}
      />
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
          />
          <AppText variant="caption" muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            Days show folder colors and counts. Open a day for its tasks.
          </AppText>
        </Card>
      ) : null}
      <AppText variant="heading">{formatDateKey(anchor, 'EEEE, MMMM d')}</AppText>
      {day.error ? <ErrorState message={day.error} onRetry={day.reload} /> : null}
      {!day.data && !day.error ? <LoadingState /> : null}
      {day.data ? (
        <PlannerDayGroups
          groups={dayGroups}
          today={today}
          rangeLabel="This day"
          testID="dash-month-groups"
          emptyText={day.data.length ? 'No matches for this day.' : 'Nothing scheduled. Tap + to add.'}
          showTaskDate={(a) => a.occurrence.date !== anchor}
        />
      ) : null}
      <Button label="Add to this day" icon="add" tone="secondary" onPress={() => router.push({ pathname: '/quick-add', params: { date: anchor } })} />
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
  weekStrip: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  weekDayChip: {
    flexGrow: 1,
    flexBasis: 40,
    minWidth: 40,
    borderRadius: radius.md,
    paddingVertical: spacing.xs,
    alignItems: 'center',
    gap: 2,
  },
  goToRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
});
