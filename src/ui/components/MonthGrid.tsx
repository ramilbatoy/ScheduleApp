import { addDays, endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { fromDateKey, toDateKey } from '@/domain/dates';
import type { DateKey } from '@/domain/models';
import type { DaySummary } from '@/domain/services/agendaService';

import { useTheme } from '../hooks';
import { radius } from '../theme';
import { AppText } from './primitives';

export const WEEK_STARTS_ON = 0 as const;

export function monthMatrix(anyDay: DateKey): DateKey[][] {
  const first = startOfWeek(startOfMonth(fromDateKey(anyDay)), { weekStartsOn: WEEK_STARTS_ON });
  const last = endOfWeek(endOfMonth(fromDateKey(anyDay)), { weekStartsOn: WEEK_STARTS_ON });
  const weeks: DateKey[][] = [];
  for (let d = first; d <= last; d = addDays(d, 7)) {
    weeks.push(Array.from({ length: 7 }, (_, i) => toDateKey(addDays(d, i))));
  }
  return weeks;
}

export function weekdayLabels(): string[] {
  const start = startOfWeek(new Date(2026, 0, 4), { weekStartsOn: WEEK_STARTS_ON });
  return Array.from({ length: 7 }, (_, i) => format(addDays(start, i), 'EEEEEE'));
}

export function MonthGrid({
  month,
  selected,
  today,
  onSelect,
  summaries,
  compact,
}: {
  month: DateKey;
  selected: DateKey | null;
  today: DateKey;
  onSelect: (d: DateKey) => void;
  summaries?: Record<DateKey, DaySummary>;
  compact?: boolean;
}) {
  const p = useTheme();
  const monthPrefix = month.slice(0, 7);
  const cellHeight = compact ? 40 : 58;
  return (
    <View>
      <View style={styles.week}>
        {weekdayLabels().map((l, i) => (
          <View key={i} style={styles.cell}>
            <AppText variant="caption" muted>
              {l}
            </AppText>
          </View>
        ))}
      </View>
      {monthMatrix(month).map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((d) => {
            const inMonth = d.startsWith(monthPrefix);
            const isSel = d === selected;
            const isToday = d === today;
            const s = summaries?.[d];
            return (
              <Pressable
                key={d}
                testID={`day-${d}`}
                accessibilityRole="button"
                accessibilityLabel={`${format(fromDateKey(d), 'EEEE, MMMM d')}${s ? `, ${s.total} items, ${s.completed} done` : ''}`}
                accessibilityState={{ selected: isSel }}
                onPress={() => onSelect(d)}
                style={[styles.cell, { height: cellHeight }]}>
                <View
                  style={[
                    styles.dayBubble,
                    isSel && { backgroundColor: p.primary },
                    !isSel && isToday && { borderWidth: 1.5, borderColor: p.primary },
                  ]}>
                  <AppText variant="label" color={isSel ? p.onPrimary : inMonth ? p.text : p.textSecondary} style={!inMonth && { opacity: 0.5 }}>
                    {Number(d.slice(8))}
                  </AppText>
                </View>
                {s && !compact ? (
                  <View style={styles.indicators}>
                    {s.overdue > 0 ? <View style={[styles.dot, { backgroundColor: p.error }]} /> : null}
                    {s.pending > 0 ? <View style={[styles.dot, { backgroundColor: p.primary }]} /> : null}
                    {s.completed > 0 ? <View style={[styles.dot, { backgroundColor: p.success }]} /> : null}
                    <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 12 }}>
                      {s.total}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', justifyContent: 'flex-start', paddingTop: 4, minHeight: 32 },
  dayBubble: { width: 34, height: 34, borderRadius: radius.pill, alignItems: 'center', justifyContent: 'center' },
  indicators: { flexDirection: 'row', alignItems: 'center', gap: 2, marginTop: 2 },
  dot: { width: 5, height: 5, borderRadius: 3 },
});
