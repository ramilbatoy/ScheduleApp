import { addDays, addMonths, endOfWeek, format, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';

import { addDaysKey, formatDateKey, fromDateKey, toDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { AgendaRow } from '@/ui/components/AgendaRow';
import { MonthGrid } from '@/ui/components/MonthGrid';
import { AppText, Button, Card, ErrorState, IconButton, LoadingState } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

/** Notion weekly planner: Monday–Sunday. */
export const DASHBOARD_WEEK_STARTS_ON = 1 as const;

export function mondayWeekRange(anchor: DateKey): [DateKey, DateKey] {
  const d = fromDateKey(anchor);
  return [
    toDateKey(startOfWeek(d, { weekStartsOn: DASHBOARD_WEEK_STARTS_ON })),
    toDateKey(endOfWeek(d, { weekStartsOn: DASHBOARD_WEEK_STARTS_ON })),
  ];
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
  const [start, end] = mondayWeekRange(anchor);
  const thisWeekStart = mondayWeekRange(today)[0];
  const items = useQuery((s) => s.agenda.range(start, end), [start, end]);
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
      {items.error ? <ErrorState message={items.error} onRetry={items.reload} /> : null}
      {!items.data && !items.error ? <LoadingState /> : null}
      {items.data
        ? Array.from({ length: 7 }, (_, i) => addDaysKey(start, i)).map((d) => {
            const list = items.data!.filter((a) => a.occurrence.date === d);
            const done = list.filter((a) => a.occurrence.status === 'completed').length;
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
                      {list.length ? ` · ${done}/${list.length} done` : ' · Free'}
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
                <AgendaList items={list} testPrefix={`dash-week-item-${d}`} emptyText="No tasks planned." />
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
  const p = useTheme();
  const monthStart = `${anchor.slice(0, 7)}-01` as DateKey;
  const monthEnd = toDateKey(addDays(addMonths(fromDateKey(monthStart), 1), -1));
  const gridFirst = toDateKey(startOfWeek(fromDateKey(monthStart), { weekStartsOn: 0 }));
  const gridLast = toDateKey(endOfWeek(fromDateKey(monthEnd), { weekStartsOn: 0 }));
  const summaries = useQuery((s) => s.agenda.summaries(gridFirst, gridLast), [gridFirst, gridLast]);
  const day = useQuery((s) => s.agenda.day(anchor), [anchor]);

  return (
    <View style={{ gap: spacing.md }} testID="dashboard-month">
      <View style={styles.nav}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => onShiftMonth(-1)} testID="dash-month-prev" />
        <AppText variant="title" style={{ flex: 1, textAlign: 'center' }} testID="dash-month-title">
          {format(fromDateKey(anchor), 'MMMM yyyy')}
        </AppText>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => onShiftMonth(1)} testID="dash-month-next" />
      </View>
      {anchor.slice(0, 7) !== today.slice(0, 7) ? (
        <Button label="This month" compact tone="ghost" icon="locate-outline" onPress={onJumpThisMonth} />
      ) : null}
      <Card style={{ paddingHorizontal: spacing.xs }}>
        <MonthGrid month={anchor} selected={anchor} today={today} onSelect={onSelectDay} summaries={summaries.data} />
        <View style={styles.legend}>
          {[
            [p.danger, 'Overdue'],
            [p.primary, 'Pending'],
            [p.success, 'Done'],
          ].map(([c, l]) => (
            <View key={l} style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}>
              <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c }} />
              <AppText variant="caption" muted>
                {l}
              </AppText>
            </View>
          ))}
        </View>
      </Card>
      <AppText variant="heading">{formatDateKey(anchor, 'EEEE, MMMM d')}</AppText>
      {day.error ? <ErrorState message={day.error} onRetry={day.reload} /> : null}
      {!day.data && !day.error ? <LoadingState /> : null}
      {day.data ? <AgendaList items={day.data} testPrefix="dash-month-item" emptyText="Nothing scheduled. Tap + to add." /> : null}
      <Button label="Add to this day" icon="add" tone="secondary" onPress={() => router.push({ pathname: '/quick-add', params: { date: anchor } })} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  legend: { flexDirection: 'row', justifyContent: 'center', gap: spacing.lg, paddingTop: spacing.sm },
});
