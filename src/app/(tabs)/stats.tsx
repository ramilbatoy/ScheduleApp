import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDateKey } from '@/domain/dates';
import type { StatsPeriod, StatsReport } from '@/domain/services/statsService';
import { BarChart, Legend, ProgressBar, StatTile } from '@/ui/components/Charts';
import { AppText, Button, Card, EmptyState, ErrorState, Icon, LoadingState, Screen, Segmented } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

const PERIOD_LABEL: Record<StatsPeriod, string> = { day: 'today', week: 'this week', month: 'this month' };
const WEEKDAY_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const pct = (rate: number | null) => (rate === null ? '—' : `${Math.round(rate * 100)}%`);
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

export default function StatisticsScreen() {
  const [period, setPeriod] = useState<StatsPeriod>('week');
  const report = useQuery((s) => s.stats.report(period), [period]);

  return (
    <Screen title="Statistics">
      <Segmented<StatsPeriod>
        testID="stats-period"
        value={period}
        onChange={setPeriod}
        options={[
          { value: 'day', label: 'Today' },
          { value: 'week', label: 'Week' },
          { value: 'month', label: 'Month' },
        ]}
      />
      {report.error ? (
        <ErrorState message={report.error} onRetry={report.reload} />
      ) : !report.data ? (
        <LoadingState label="Crunching numbers…" />
      ) : report.data.allTime.tasksCreated === 0 && report.data.period.events === 0 ? (
        <EmptyState
          icon="stats-chart-outline"
          title="No data yet"
          message="Add and complete a few tasks; your progress, streaks and trends will show up here."
          action={<Button label="Add a task" icon="add" onPress={() => router.push('/quick-add')} />}
        />
      ) : (
        <Report r={report.data} />
      )}
    </Screen>
  );
}

function Report({ r }: { r: StatsReport }) {
  const p = useTheme();
  const t = r.period;
  const label = PERIOD_LABEL[t.period];
  const maxWeekday = Math.max(...r.weekdays);

  return (
    <View style={{ gap: spacing.lg }}>
      <Card testID="stats-completion">
        <View style={styles.headline}>
          <View style={{ flex: 1 }}>
            <AppText variant="label" muted>
              {`COMPLETION ${label.toUpperCase()}`}
            </AppText>
            <AppText variant="caption" muted>
              {t.start === t.end ? formatDateKey(t.start, 'EEEE, MMM d') : `${formatDateKey(t.start, 'MMM d')} – ${formatDateKey(t.end, 'MMM d')}`}
            </AppText>
          </View>
          <AppText variant="display" color={p.primary} testID="stats-rate">
            {pct(t.completionRate)}
          </AppText>
        </View>
        <ProgressBar value={t.completionRate ?? 0} height={10} />
        <AppText muted>{t.total ? `${t.completed} of ${plural(t.total, 'task')} done` : `No tasks scheduled ${label}`}</AppText>
      </Card>

      <View style={styles.tiles}>
        <StatTile label="Pending" value={String(t.pending)} hint={label} />
        <StatTile label="Overdue" value={String(t.overdue)} hint="past date or deadline" tone={t.overdue ? 'danger' : undefined} />
        <StatTile label="Carried forward" value={String(t.carryMoves)} hint={t.carryDays ? `${plural(t.carryDays, 'day')} moved` : 'times moved'} tone={t.carryMoves ? 'warning' : undefined} />
        <StatTile label="Events" value={`${t.eventsDone}/${t.events}`} hint="attended / scheduled" />
        <StatTile label="Streak" value={plural(r.streak, 'day')} hint="in a row with a completion" tone={r.streak ? 'success' : undefined} />
        <StatTile
          label="Best day"
          value={r.bestDay ? String(r.bestDay.completed) : '—'}
          hint={r.bestDay ? `done on ${formatDateKey(r.bestDay.date, 'MMM d')}` : 'no completions yet'}
        />
      </View>

      <Card>
        <AppText variant="heading">Last 14 days</AppText>
        <BarChart
          accessibilityLabel={`Daily tasks for the last 14 days: ${r.trend.map((d) => `${formatDateKey(d.date, 'MMM d')} ${d.completed} of ${d.total}`).join(', ')}`}
          data={r.trend.map((d) => ({
            key: d.date,
            label: formatDateKey(d.date, 'd'),
            total: d.total,
            value: d.completed,
            highlight: d.date === r.today,
          }))}
        />
        <Legend
          items={[
            { label: 'Completed', color: p.primary },
            { label: 'Scheduled', color: p.primarySoft },
          ]}
        />
      </Card>

      <Card>
        <AppText variant="heading">Most productive days</AppText>
        <AppText variant="caption" muted>
          Tasks completed per weekday, last 8 weeks
        </AppText>
        <BarChart
          showValues
          height={90}
          accessibilityLabel={`Completions by weekday: ${r.weekdays.map((n, i) => `${WEEKDAY_SHORT[i]} ${n}`).join(', ')}`}
          data={r.weekdays.map((n, i) => ({
            key: String(i),
            label: WEEKDAY_SHORT[i],
            total: n,
            value: n,
            highlight: n > 0 && n === maxWeekday,
          }))}
        />
      </Card>

      <Card>
        <AppText variant="heading">{`By category ${label}`}</AppText>
        {r.categories.length === 0 ? (
          <AppText muted>Nothing scheduled {label}.</AppText>
        ) : (
          r.categories.map((c) => (
            <View key={c.categoryId ?? 'none'} style={{ gap: spacing.xs }} accessible accessibilityLabel={`${c.name}: ${c.completed} of ${c.total} done`}>
              <View style={styles.catRow}>
                <View style={[styles.dot, { backgroundColor: c.color }]} />
                <AppText style={{ flex: 1 }} numberOfLines={1}>
                  {c.name}
                </AppText>
                <AppText variant="caption" muted>
                  {`${c.completed}/${c.total} done`}
                </AppText>
              </View>
              <ProgressBar value={c.total ? c.completed / c.total : 0} color={c.color} />
            </View>
          ))
        )}
      </Card>

      {r.mostCarried.length ? (
        <Card>
          <AppText variant="heading">Carried over the most</AppText>
          <AppText variant="caption" muted>
            Still-open tasks that keep moving to the next day
          </AppText>
          {r.mostCarried.map((m) => (
            <Pressable
              key={m.occurrenceId}
              onPress={() => router.push({ pathname: '/item/[id]', params: { id: m.occurrenceId } })}
              style={({ pressed }) => [styles.carriedRow, pressed && { opacity: 0.7 }]}
              accessibilityRole="button">
              <Icon name="return-down-forward" size={18} color={p.warning} />
              <AppText style={{ flex: 1 }} numberOfLines={1}>
                {m.title}
              </AppText>
              <AppText variant="caption" color={p.warning}>
                {`carried ${m.carryForwardCount}×`}
              </AppText>
            </Pressable>
          ))}
        </Card>
      ) : null}

      <Card>
        <AppText variant="heading">All time</AppText>
        <AppText muted>
          {`${plural(r.allTime.tasksCreated, 'task')} created · ${r.allTime.completed} completed · ${plural(r.allTime.carryMoves, 'carry-forward')}`}
        </AppText>
      </Card>
    </View>
  );
}

const styles = StyleSheet.create({
  headline: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.md },
  catRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  dot: { width: 12, height: 12, borderRadius: 6 },
  carriedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
