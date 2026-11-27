import { format } from 'date-fns';
import { useRef } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { fromDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import { monthDayMarkers } from '@/domain/plannerGroups';
import { cellTaskPreview, monthPrefix } from '@/domain/monthTable';
import { agendaPriority, displayTitle, formatOverdueLabels, isOverdue, overdueTimeline } from '@/domain/services/agendaService';

import { useTheme } from '../hooks';
import { radius } from '../theme';
import { monthMatrix, weekdayLabels } from './MonthGrid';
import { AppText } from './primitives';

const CELL_LIMIT = 3;
const DOUBLE_TAP_MS = 280;

export function MonthTaskGrid({
  month,
  selected,
  today,
  itemsByDate,
  now,
  onSelectDay,
  onDoubleSelectDay,
  onSelectTask,
  presentation = 'tasks',
  testID = 'month-task-grid',
}: {
  month: DateKey;
  selected: DateKey | null;
  today: DateKey;
  itemsByDate: Record<DateKey, Agenda[]>;
  now: Date;
  onSelectDay: (d: DateKey) => void;
  /** Double-tap / double-click a day cell (e.g. open quick-add for that date). */
  onDoubleSelectDay?: (d: DateKey) => void;
  /** Task chips. Omitted when `presentation` is `folders` — markers are not buttons. */
  onSelectTask?: (a: Agenda) => void;
  /** `folders` draws color markers and counts instead of task titles. */
  presentation?: 'tasks' | 'folders';
  testID?: string;
}) {
  const p = useTheme();
  const prefix = monthPrefix(month);
  const lastTap = useRef<{ date: DateKey; at: number } | null>(null);
  const singleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  function handleCellPress(d: DateKey) {
    if (!onDoubleSelectDay) {
      onSelectDay(d);
      return;
    }
    const nowMs = Date.now();
    const prev = lastTap.current;
    if (prev && prev.date === d && nowMs - prev.at < DOUBLE_TAP_MS) {
      if (singleTimer.current) {
        clearTimeout(singleTimer.current);
        singleTimer.current = null;
      }
      lastTap.current = null;
      onDoubleSelectDay(d);
      return;
    }
    lastTap.current = { date: d, at: nowMs };
    if (singleTimer.current) clearTimeout(singleTimer.current);
    singleTimer.current = setTimeout(() => {
      singleTimer.current = null;
      onSelectDay(d);
    }, DOUBLE_TAP_MS);
  }

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
            const preview = presentation === 'tasks' ? cellTaskPreview(dayItems, CELL_LIMIT) : null;
            const markers = presentation === 'folders' ? monthDayMarkers(dayItems) : null;
            const markerBits = markers?.folders.map((f) => `${f.count} in ${f.name}`) ?? [];
            if (markers?.unassigned) markerBits.push(`${markers.unassigned} unassigned`);
            const folderLabel = markerBits.length ? `, ${markerBits.join(', ')}` : '';
            return (
              // Task mode: no button role on the cell so title chips can be real buttons.
              // Folder mode: markers are views, so the cell itself is the only button.
              <Pressable
                key={d}
                testID={`month-cell-${d}`}
                accessibilityRole={presentation === 'folders' ? 'button' : undefined}
                accessibilityLabel={`${format(fromDateKey(d), 'EEEE, MMMM d')}${presentation === 'folders' ? folderLabel : dayItems.length ? `, ${dayItems.length} items` : ''}`}
                accessibilityHint={onDoubleSelectDay ? 'Double tap to quick add' : undefined}
                accessibilityState={{ selected: isSel }}
                onPress={() => handleCellPress(d)}
                style={[
                  styles.cell,
                  {
                    backgroundColor: isSel ? p.primarySoft : inMonth ? p.surface : p.surfaceVariant,
                    borderColor: isToday ? p.primary : p.border,
                    borderWidth: isToday ? 1.5 : StyleSheet.hairlineWidth,
                    opacity: inMonth ? 1 : 0.55,
                  },
                ]}>
                <AppText
                  variant="label"
                  color={isSel ? p.primary : inMonth ? p.text : p.textSecondary}
                  style={styles.dayNum}>
                  {Number(d.slice(8))}
                </AppText>
                <View style={styles.tasks}>
                  {markers
                    ? markers.folders.slice(0, CELL_LIMIT).map((f) => (
                        <View key={f.folderId} testID={`month-marker-${d}-${f.folderId}`} style={[styles.marker, { backgroundColor: `${f.color}22`, borderLeftColor: f.color }]}>
                          <AppText numberOfLines={1} color={p.text} style={{ fontSize: 10, lineHeight: 13 }}>
                            {f.name} {f.count}
                          </AppText>
                        </View>
                      ))
                    : null}
                  {markers && markers.folders.length > CELL_LIMIT ? (
                    <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 12 }}>
                      +{markers.folders.length - CELL_LIMIT} folders
                    </AppText>
                  ) : null}
                  {markers && markers.unassigned > 0 ? (
                    <AppText variant="caption" muted style={{ fontSize: 10, lineHeight: 12 }} testID={`month-marker-unassigned-${d}`}>
                      {markers.unassigned} other
                    </AppText>
                  ) : null}
                  {preview?.shown.map((a) => {
                    const done = a.occurrence.status === 'completed';
                    const overdue = isOverdue(a, today, now);
                    const timeline = overdue && !done ? overdueTimeline(a, today, now) : null;
                    const overdueLabels = timeline ? formatOverdueLabels(timeline, today) : null;
                    const accent =
                      a.task.kind === 'event' ? (a.category?.color ?? p.primary) : overdue ? p.overdue : p.priority[agendaPriority(a)];
                    const title = displayTitle(a);
                    return (
                      <Pressable
                        key={a.occurrence.id}
                        testID={`month-cell-task-${a.occurrence.id}`}
                        accessibilityRole="button"
                        accessibilityLabel={
                          overdueLabels ? `Edit ${title}, ${overdueLabels.started}, ${overdueLabels.overdue}` : overdue ? `Edit overdue ${title}` : `Edit ${title}`
                        }
                        onPress={(e) => {
                          // Avoid also selecting the day when opening a chip (web).
                          (e as { stopPropagation?: () => void }).stopPropagation?.();
                          onSelectTask?.(a);
                        }}
                        style={[styles.taskChip, { backgroundColor: `${accent}22`, borderLeftColor: accent }]}>
                        <AppText
                          variant="caption"
                          numberOfLines={1}
                          color={done ? p.textSecondary : overdue ? p.overdue : p.text}
                          style={done ? { textDecorationLine: 'line-through', fontSize: 10, lineHeight: 13 } : { fontSize: 10, lineHeight: 13 }}>
                          {overdue && !done ? `Overdue · ${title}` : title}
                        </AppText>
                        {overdueLabels ? (
                          <AppText variant="caption" numberOfLines={2} color={p.error} testID={`month-cell-overdue-${a.occurrence.id}`} style={{ fontSize: 9, lineHeight: 11 }}>
                            {overdueLabels.started}
                            {'\n'}
                            {overdueLabels.overdue}
                          </AppText>
                        ) : null}
                      </Pressable>
                    );
                  })}
                  {preview && preview.more > 0 ? (
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
  marker: {
    borderLeftWidth: 3,
    borderRadius: 3,
    paddingHorizontal: 3,
    paddingVertical: 1,
  },
});
