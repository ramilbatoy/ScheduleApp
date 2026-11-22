import { format } from 'date-fns';
import { Pressable, StyleSheet, View } from 'react-native';

import { fromDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { cellTaskPreview, monthPrefix } from '@/domain/monthTable';
import { displayTitle, isOverdue } from '@/domain/services/agendaService';

import { useTheme } from '../hooks';
import { radius } from '../theme';
import { monthMatrix, weekdayLabels } from './MonthGrid';
import { AppText } from './primitives';

const CELL_LIMIT = 3;

export function MonthTaskGrid({
  month,
  selected,
  today,
  itemsByDate,
  now,
  onSelectDay,
  onSelectTask,
  testID = 'month-task-grid',
}: {
  month: DateKey;
  selected: DateKey | null;
  today: DateKey;
  itemsByDate: Record<DateKey, Agenda[]>;
  now: Date;
  onSelectDay: (d: DateKey) => void;
  onSelectTask: (a: Agenda) => void;
  testID?: string;
}) {
  const p = useTheme();
  const prefix = monthPrefix(month);

  return (
    <View testID={testID}>
      <View style={styles.week}>
        {weekdayLabels().map((l, i) => (
          <View key={i} style={styles.headCell}>
            <AppText variant="caption" muted>
              {l}
            </AppText>
          </View>
        ))}
      </View>
      {monthMatrix(month).map((week) => (
        <View key={week[0]} style={styles.week}>
          {week.map((d) => {
            const inMonth = d.startsWith(prefix);
            const isSel = d === selected;
            const isToday = d === today;
            const dayItems = itemsByDate[d] ?? [];
            const preview = cellTaskPreview(dayItems, CELL_LIMIT);
            return (
              <Pressable
                key={d}
                testID={`month-cell-${d}`}
                accessibilityRole="button"
                accessibilityLabel={`${format(fromDateKey(d), 'EEEE, MMMM d')}${dayItems.length ? `, ${dayItems.length} items` : ''}`}
                accessibilityState={{ selected: isSel }}
                onPress={() => onSelectDay(d)}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isSel ? p.primarySoft : inMonth ? p.surface : p.surfaceAlt,
                    borderColor: isToday ? p.primary : p.border,
                    borderWidth: isToday ? 1.5 : StyleSheet.hairlineWidth,
                    opacity: inMonth ? 1 : 0.55,
                  },
                ]}>
                <AppText
                  variant="label"
                  color={isSel ? p.primary : inMonth ? p.text : p.textMuted}
                  style={styles.dayNum}>
                  {Number(d.slice(8))}
                </AppText>
                <View style={styles.tasks}>
                  {preview.shown.map((a) => {
                    const done = a.occurrence.status === 'completed';
                    const overdue = isOverdue(a, today, now);
                    const accent =
                      a.task.kind === 'event' ? (a.category?.color ?? p.primary) : overdue ? p.danger : p.priority[a.task.priority];
                    const title = displayTitle(a);
                    return (
                      <Pressable
                        key={a.occurrence.id}
                        testID={`month-cell-task-${a.occurrence.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={`Edit ${title}`}
                        onPress={() => onSelectTask(a)}
                        style={[styles.taskChip, { backgroundColor: `${accent}22`, borderLeftColor: accent }]}>
                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          color={done ? p.textMuted : p.text}
                          style={done ? { textDecorationLine: 'line-through', fontSize: 10, lineHeight: 13 } : { fontSize: 10, lineHeight: 13 }}>
                          {title}
                        </AppText>
                      </Pressable>
                    );
                  })}
                  {preview.more > 0 ? (
                    <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 12 }}>
                      +{preview.more} more
                    </AppText>
                  ) : null}
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  week: { flexDirection: 'row', gap: 2, marginBottom: 2 },
  headCell: { flex: 1, alignItems: 'center', paddingVertical: 4 },
  cell: {
    flex: 1,
    minHeight: 96,
    borderRadius: radius.sm,
    padding: 4,
    gap: 2,
  },
  dayNum: { fontSize: 12, lineHeight: 14, marginBottom: 2 },
  tasks: { gap: 2, flex: 1 },
  taskChip: {
    borderLeftWidth: 2,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
