import { addDays, addMonths, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDaysKey, formatDateKey, formatTime, fromDateKey, toDateKey, todayKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { groupAgendaByDate } from '@/domain/monthTable';
import type { EditScope } from '@/domain/services/taskService';
import { useServices } from '@/state/appStore';
import { AgendaRow } from '@/ui/components/AgendaRow';
import { choose } from '@/ui/components/dialogs';
import { WEEK_STARTS_ON } from '@/ui/components/MonthGrid';
import { MonthTaskGrid } from '@/ui/components/MonthTaskGrid';
import { DatePickerModal } from '@/ui/components/Pickers';
import { TaskEditModal } from '@/ui/components/TaskEditModal';
import { AppText, Button, Card, ErrorState, IconButton, LoadingState, Segmented } from '@/ui/components/primitives';
import { QuickAddButton } from '@/ui/components/QuickAddButton';
import { useQuery, useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

type Mode = 'month' | 'week' | 'day';

function weekRange(anchor: DateKey): [DateKey, DateKey] {
  const d = fromDateKey(anchor);
  return [toDateKey(startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON })), toDateKey(endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON }))];
}

function DayList({ items, emptyText }: { items: Agenda[]; emptyText: string }) {
  if (!items.length) return <AppText muted>{emptyText}</AppText>;
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((a, i) => (
        <AgendaRow key={a.occurrence.id} a={a} testID={`cal-item-${i}`} />
      ))}
    </View>
  );
}

function MonthView({ anchor, today, onSelect }: { anchor: DateKey; today: DateKey; onSelect: (d: DateKey) => void }) {
  const services = useServices();
  const [goToOpen, setGoToOpen] = useState(false);
  const [edit, setEdit] = useState<{ id: string; scope: EditScope } | null>(null);
  const first = toDateKey(startOfWeek(startOfMonth(fromDateKey(anchor)), { weekStartsOn: WEEK_STARTS_ON }));
  const last = toDateKey(endOfWeek(endOfMonth(fromDateKey(anchor)), { weekStartsOn: WEEK_STARTS_ON }));
  const range = useQuery((s) => s.agenda.range(first, last), [first, last]);
  const day = useQuery((s) => s.agenda.day(anchor), [anchor]);
  const now = services.clock.now();
  const itemsByDate = groupAgendaByDate(range.data ?? []);

  async function openTask(a: Agenda) {
    onSelect(a.occurrence.date);
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
    <View style={{ gap: spacing.md }}>
      <Button label="Go to date" compact tone="secondary" icon="calendar-outline" onPress={() => setGoToOpen(true)} testID="cal-month-goto" />
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
            onSelectDay={onSelect}
            onSelectTask={openTask}
            testID="cal-month-task-grid"
          />
        </Card>
      ) : null}
      <AppText variant="heading">{formatDateKey(anchor, 'EEEE, MMMM d')}</AppText>
      {day.error ? <ErrorState message={day.error} onRetry={day.reload} /> : day.data ? <DayList items={day.data} emptyText="Nothing scheduled. Tap + to add." /> : <LoadingState />}
      <DatePickerModal visible={goToOpen} value={anchor} today={today} title="Go to date" onChange={onSelect} onClose={() => setGoToOpen(false)} />
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

function WeekView({ anchor, today, onOpenDay }: { anchor: DateKey; today: DateKey; onOpenDay: (d: DateKey) => void }) {
  const p = useTheme();
  const [start, end] = weekRange(anchor);
  const items = useQuery((s) => s.agenda.range(start, end), [start, end]);
  if (items.error) return <ErrorState message={items.error} onRetry={items.reload} />;
  if (!items.data) return <LoadingState />;
  const days = Array.from({ length: 7 }, (_, i) => addDaysKey(start, i));
  return (
    <View style={{ gap: spacing.md }}>
      {days.map((d) => {
        const list = items.data!.filter((a) => a.occurrence.date === d);
        const done = list.filter((a) => a.occurrence.status === 'completed').length;
        return (
          <View key={d} style={{ gap: spacing.sm }} testID={`week-${d}`}>
            <View style={styles.weekHeader}>
              <Pressable onPress={() => onOpenDay(d)} style={{ flex: 1 }} accessibilityRole="button" accessibilityLabel={`Open ${formatDateKey(d, 'EEEE MMMM d')}`}>
                <AppText variant="heading" color={d === today ? p.primary : p.text}>
                  {formatDateKey(d, 'EEE d')}
                  {d === today ? ' · Today' : ''}
                </AppText>
                <AppText variant="caption" muted>
                  {list.length ? `${done}/${list.length} done` : 'Free'}
                </AppText>
              </Pressable>
              <IconButton icon="add-circle-outline" label={`Add on ${formatDateKey(d, 'EEEE')}`} color={p.primary} onPress={() => router.push({ pathname: '/quick-add', params: { date: d } })} testID={`week-add-${d}`} />
            </View>
            {list.length ? <DayList items={list} emptyText="" /> : null}
          </View>
        );
      })}
    </View>
  );
}

function DayView({ anchor }: { anchor: DateKey }) {
  const p = useTheme();
  const items = useQuery((s) => s.agenda.day(anchor), [anchor]);
  if (items.error) return <ErrorState message={items.error} onRetry={items.reload} />;
  if (!items.data) return <LoadingState />;
  const allDay = items.data.filter((a) => a.task.allDay);
  const timed = items.data.filter((a) => !a.task.allDay && a.occurrence.startTime);
  const anytime = items.data.filter((a) => !a.task.allDay && !a.occurrence.startTime);
  const unfinished = items.data.filter((a) => a.occurrence.status === 'pending').length;
  return (
    <View style={{ gap: spacing.md }}>
      <AppText muted>
        {items.data.length ? `${items.data.length - unfinished} completed · ${unfinished} unfinished` : 'Nothing scheduled.'}
      </AppText>
      {allDay.length ? (
        <>
          <AppText variant="label" muted>
            ALL-DAY
          </AppText>
          <DayList items={allDay} emptyText="" />
        </>
      ) : null}
      <AppText variant="label" muted>
        TIMELINE
      </AppText>
      {timed.length ? (
        timed.map((a) => (
          <View key={a.occurrence.id} style={{ flexDirection: 'row', gap: spacing.sm }}>
            <View style={[styles.timeCol, { borderRightColor: p.border }]}>
              <AppText variant="label">{formatTime(a.occurrence.startTime)}</AppText>
              {a.occurrence.endTime ? (
                <AppText variant="caption" muted>
                  {formatTime(a.occurrence.endTime)}
                </AppText>
              ) : null}
            </View>
            <View style={{ flex: 1 }}>
              <AgendaRow a={a} />
            </View>
          </View>
        ))
      ) : (
        <AppText muted>No timed items.</AppText>
      )}
      {anytime.length ? (
        <>
          <AppText variant="label" muted>
            ANYTIME
          </AppText>
          <DayList items={anytime} emptyText="" />
        </>
      ) : null}
      <Button label="Add to this day" icon="add" tone="secondary" onPress={() => router.push({ pathname: '/quick-add', params: { date: anchor } })} />
    </View>
  );
}

export default function CalendarScreen() {
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const services = useServices();
  const today = todayKey(services.clock);
  const [mode, setMode] = useState<Mode>('month');
  const [anchor, setAnchor] = useState<DateKey>(today);

  function shift(dir: 1 | -1) {
    const d = fromDateKey(anchor);
    if (mode === 'month') setAnchor(toDateKey(addMonths(d, dir)));
    else setAnchor(toDateKey(addDays(d, mode === 'week' ? 7 * dir : dir)));
  }

  const [ws, we] = weekRange(anchor);
  const title =
    mode === 'month'
      ? format(fromDateKey(anchor), 'MMMM yyyy')
      : mode === 'week'
        ? `${formatDateKey(ws, 'MMM d')} – ${formatDateKey(we, ws.slice(5, 7) === we.slice(5, 7) ? 'd' : 'MMM d')}`
        : formatDateKey(anchor, 'EEE, MMM d');

  return (
    <View style={{ flex: 1, backgroundColor: p.background, paddingTop: insets.top }}>
      <ScrollView contentContainerStyle={{ padding: spacing.lg, paddingBottom: 120, gap: spacing.md }}>
        <Segmented<Mode>
          testID="calendar-mode"
          value={mode}
          onChange={setMode}
          options={[
            { value: 'month', label: 'Month' },
            { value: 'week', label: 'Week' },
            { value: 'day', label: 'Day' },
          ]}
        />
        <View style={styles.nav}>
          <IconButton icon="chevron-back" label="Previous" onPress={() => shift(-1)} testID="cal-prev" />
          <AppText variant="title" style={{ flex: 1, textAlign: 'center' }} testID="cal-title">
            {title}
          </AppText>
          <IconButton icon="chevron-forward" label="Next" onPress={() => shift(1)} testID="cal-next" />
        </View>
        {anchor !== today ? <Button label="Jump to today" compact tone="ghost" icon="locate-outline" onPress={() => setAnchor(today)} /> : null}
        {mode === 'month' ? <MonthView anchor={anchor} today={today} onSelect={setAnchor} /> : null}
        {mode === 'week' ? (
          <WeekView
            anchor={anchor}
            today={today}
            onOpenDay={(d) => {
              setAnchor(d);
              setMode('day');
            }}
          />
        ) : null}
        {mode === 'day' ? <DayView anchor={anchor} /> : null}
      </ScrollView>
      <QuickAddButton date={anchor} />
    </View>
  );
}

const styles = StyleSheet.create({
  nav: { flexDirection: 'row', alignItems: 'center' },
  weekHeader: { flexDirection: 'row', alignItems: 'center', borderRadius: radius.md },
  timeCol: { width: 68, alignItems: 'flex-end', paddingRight: spacing.sm, paddingTop: spacing.md, borderRightWidth: 2 },
});
