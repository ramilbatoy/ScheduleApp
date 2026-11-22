import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { addDaysKey, formatDateKey, fromDateKey, todayKey, toDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { groupAgendaByDate, isSameMonth } from '@/domain/monthTable';
import {
  agendaPriority,
  filterAgendaItems,
  mergeAgendaUnique,
  projectOverdueOntoToday,
  weeklyGoalItems,
  type ListFilter,
} from '@/domain/services/agendaService';
import type { EditScope } from '@/domain/services/taskService';
import { AgendaRow } from '@/ui/components/AgendaRow';
import { AgendaFilterBar, useAgendaFilterState } from '@/ui/components/AgendaFilterBar';
import { choose } from '@/ui/components/dialogs';
import { DatePickerModal } from '@/ui/components/Pickers';
import { MonthTaskGrid } from '@/ui/components/MonthTaskGrid';
import { TaskEditModal } from '@/ui/components/TaskEditModal';
import { AppText, Button, Card, ErrorState, IconButton, LoadingState, SectionHeader } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useServices } from '@/state/appStore';
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

function AgendaList({ items, testPrefix, emptyText }: { items: Agenda[]; testPrefix: string; emptyText: string }) {
  if (!items.length) return <AppText muted>{emptyText}</AppText>;
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((a, i) => (
        <AgendaRow key={a.occurrence.id} a={a} testID={`${testPrefix}-${i}`} />
      ))}
    </View>
  );
}

function applyPlannerFilter(items: Agenda[], filter: ListFilter, today: DateKey, now: Date): Agenda[] {
  return filterAgendaItems(items, filter, today, now);
}

/** This week's pending tasks ranked Urgent → High → Medium → Low. */
export function WeeklyGoalsSection({
  anchor,
  testID = 'weekly-goals',
}: {
  anchor: DateKey;
  testID?: string;
}) {
  const p = useTheme();
  const services = useServices();
  const today = todayKey(services.clock);
  const [start, end] = mondayWeekRange(anchor);
  const items = useQuery((s) => s.agenda.range(start, end), [start, end]);
  const overdue = useQuery((s) => s.agenda.pendingOverdueBeforeToday(), []);
  const goals = items.data ? weeklyGoalItems(items.data, overdue.data ?? [], start, end, today) : [];

  return (
    <View style={{ gap: spacing.sm }} testID={testID}>
      <SectionHeader title="Weekly goals by urgency" count={goals.length} />
      <AppText variant="caption" muted>
        {formatDateKey(start, 'MMM d')} – {formatDateKey(end, start.slice(5, 7) === end.slice(5, 7) ? 'd' : 'MMM d')} · Urgent first
      </AppText>
      {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}
      {!items.data && !items.error ? <LoadingState /> : null}
      {items.data && !goals.length ? <AppText muted>No open goals this week.</AppText> : null}
      {goals.length ? (
        <View style={{ gap: spacing.sm }}>
          {goals.map((a, i) => (
            <AgendaRow key={a.occurrence.id} a={a} showDate testID={`${testID}-${i}`} />
          ))}
        </View>
      ) : null}
      {goals.length && !goals.some((a) => agendaPriority(a) === 'urgent' || agendaPriority(a) === 'high') ? (
        <AppText variant="caption" color={p.textSecondary}>
          Nothing marked urgent or high yet.
        </AppText>
      ) : null}
    </View>
  );
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
  const filterCtl = useAgendaFilterState({ sort: 'date', status: 'all' });
  const now = services.clock.now();
  const overdueRaw = overdue.data ?? [];
  const filtered = items.data ? applyPlannerFilter(items.data, filterCtl.filter, today, now) : [];
  const overdueFiltered = applyPlannerFilter(overdueRaw, filterCtl.filter, today, now);
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
      <AgendaFilterBar
        testID="dash-week-filter"
        state={filterCtl.state}
        onText={filterCtl.setText}
        onStatus={filterCtl.setStatus}
        onPriority={filterCtl.setPriority}
        onCategoryId={filterCtl.setCategoryId}
        onSort={filterCtl.setSort}
        matchCount={items.data ? filtered.length : undefined}
      />
      <WeeklyGoalsSection anchor={anchor} testID="dash-week-goals" />
      {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}
      {!items.data && !items.error ? <LoadingState /> : null}
      {items.data
        ? Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)).map((d) => {
            const onDate = filtered.filter((a) => a.occurrence.date === d);
            const list = d === today ? mergeAgendaUnique(overdueFiltered, onDate) : onDate;
            const dayAllBase = items.data!.filter((a) => a.occurrence.date === d);
            const dayAll = d === today ? mergeAgendaUnique(overdueRaw, dayAllBase) : dayAllBase;
            const done = dayAll.filter((a) => a.occurrence.status === 'completed').length;
            return (
              <View key={d} style={{ gap: spacing.sm }} testID={`dash-week-${d}`}>
                <View style={styles.weekHeader}>
                  <View style={{ flex: 1 }}>
                    <AppText variant="heading" color={d === today ? p.primary : p.text}>
                      {formatDateKey(d, 'EEEE')}
                      {d === today ? ' · Today' : ''}
                    </AppText>
                    <AppText variant="caption" muted>
                      {formatDateKey(d, 'MMM d')}
                      {dayAll.length ? ` · ${done}/${dayAll.length} done` : ' · Free'}
                      {list.length !== dayAll.length ? ` · ${list.length} shown` : ''}
                    </AppText>
                  </View>
                  <IconButton
                    icon="add-circle-outline"
                    label={`Add on ${formatDateKey(d, 'EEEE')}`}
                    color={p.primary}
                    onPress={() => router.push({ pathname: '/quick-add', params: { date: d } })}
                    testID={`dash-week-add-${d}`}
                  />
                </View>
                <AgendaList
                  items={list}
                  testPrefix={`dash-week-item-${d}`}
                  emptyText={dayAll.length ? 'No matches for this day.' : 'No tasks planned.'}
                />
              </View>
            );
          })
        : null}
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
  const [edit, setEdit] = useState<{ id: string; scope: EditScope } | null>(null);
  const monthStart = `${anchor.slice(0, 7)}-01` as DateKey;
  const monthEnd = toDateKey(addDays(addMonths(fromDateKey(monthStart), 1), -1));
  const gridFirst = toDateKey(startOfWeek(fromDateKey(monthStart), { weekStartsOn: 0 }));
  const gridLast = toDateKey(endOfWeek(fromDateKey(monthEnd), { weekStartsOn: 0 }));
  const range = useQuery((s) => s.agenda.range(gridFirst, gridLast), [gridFirst, gridLast]);
  const overdue = useQuery((s) => s.agenda.pendingOverdueBeforeToday(), []);
  const day = useQuery((s) => s.agenda.day(anchor), [anchor]);
  const filterCtl = useAgendaFilterState({ sort: 'date', status: 'all' });
  const now = services.clock.now();
  const filteredRange = range.data ? applyPlannerFilter(range.data, filterCtl.filter, today, now) : [];
  const overdueFiltered = applyPlannerFilter(overdue.data ?? [], filterCtl.filter, today, now);
  const itemsByDate = projectOverdueOntoToday(groupAgendaByDate(filteredRange), overdueFiltered, today);
  const filteredDay = day.data ? applyPlannerFilter(day.data, filterCtl.filter, today, now) : [];

  async function openTask(a: Agenda) {
    onSelectDay(a.occurrence.date);
    let scope: EditScope = 'series';
    if (a.rule) {
      const picked = await choose<EditScope>('Edit recurring item', 'Which occurrences do you want to change?', [
        { label: 'This occurrence only', value: 'occurrence', tone: 'secondary' },
        { label: 'This and following', value: 'future', tone: 'secondary' },
        { label: 'Entire series', value: 'series', tone: 'primary' },
      ]);
      if (!picked) return;
      scope = picked;
    }
    setEdit({ id: a.occurrence.id, scope });
  }

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
            onSelectDay={onSelectDay}
            onSelectTask={openTask}
          />
          <AppText variant="caption" muted style={{ marginTop: spacing.sm, textAlign: 'center' }}>
            Main tasks appear in each day. Tap a task to edit; nested subtasks stay in the editor.
          </AppText>
        </Card>
      ) : null}
      <AppText variant="heading">{formatDateKey(anchor, 'EEEE, MMMM d')}</AppText>
      {day.error ? <ErrorState message={day.error} onRetry={day.reload} /> : null}
      {!day.data && !day.error ? <LoadingState /> : null}
      {day.data ? (
        <AgendaList
          items={filteredDay}
          testPrefix="dash-month-item"
          emptyText={day.data.length ? 'No matches for this day.' : 'Nothing scheduled. Tap + to add.'}
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
      <TaskEditModal
        visible={!!edit}
        occurrenceId={edit?.id ?? null}
        scope={edit?.scope ?? 'series'}
        onClose={() => {
          setEdit(null);
          range.reload();
          day.reload();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  goToRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, alignItems: 'center' },
});
