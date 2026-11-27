import { useEffect, useMemo, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { addDaysKey, dateRange, formatDateKey } from '@/domain/dates';
import type { Agenda, DateKey } from '@/domain/models';
import type { DaySummary } from '@/domain/services/agendaService';
import { AppText, Button, IconButton } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

/** Days on each side of the selected date (window = 2*radius + 1). */
export const DATE_STRIP_RADIUS = 10;

const CELL_WIDTH = 52;
const CELL_GAP = spacing.sm;

/** Civil-date window centered on `selected` (inclusive). */
export function dateStripWindow(selected: DateKey, radius = DATE_STRIP_RADIUS): DateKey[] {
  return dateRange(addDaysKey(selected, -radius), addDaysKey(selected, radius));
}

export function shiftSelectedDate(selected: DateKey, dir: 1 | -1): DateKey {
  return addDaysKey(selected, dir);
}

/** Progress for the selected civil day (includes overdue projection when that day is system today). */
export function dayProgressFromAgenda(items: Agenda[]): { completed: number; total: number; carried: number } {
  const completed = items.filter((a) => a.occurrence.status === 'completed').length;
  const carried = items.filter((a) => a.occurrence.isCarriedForward && a.occurrence.status === 'pending').length;
  return { completed, total: items.length, carried };
}

type Props = {
  selected: DateKey;
  today: DateKey;
  /** Optional per-day activity markers (occurrence totals). */
  summaries?: Partial<Record<DateKey, DaySummary>>;
  onSelect: (date: DateKey) => void;
  testID?: string;
  /** When false, omit the text Today button (Day uses an icon on the toolbar instead). */
  showTodayButton?: boolean;
};

/**
 * Horizontal civil-date strip: arrows, swipe, tap-to-select, optional Today jump.
 * Nested inside a vertical ScrollView — locks to horizontal gestures where supported.
 */
export function DateStrip({ selected, today, summaries, onSelect, testID = 'date-strip', showTodayButton = true }: Props) {
  const p = useTheme();
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const days = useMemo(() => dateStripWindow(selected), [selected]);
  const selectedIndex = days.indexOf(selected);

  useEffect(() => {
    if (selectedIndex < 0) return;
    const x = Math.max(0, selectedIndex * (CELL_WIDTH + CELL_GAP) - CELL_WIDTH * 2);
    const id = requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ x, animated: true });
    });
    return () => cancelAnimationFrame(id);
  }, [selected, selectedIndex]);

  return (
    <View style={styles.wrap} testID={testID}>
      <View style={styles.row}>
        <IconButton
          icon="chevron-back"
          label="Previous day"
          testID={`${testID}-prev`}
          onPress={() => onSelect(shiftSelectedDate(selected, -1))}
        />
        <ScrollView
          ref={scrollRef}
          horizontal
          showsHorizontalScrollIndicator={false}
          nestedScrollEnabled
          directionalLockEnabled
          decelerationRate="fast"
          contentContainerStyle={styles.strip}
          style={styles.scroll}
          testID={`${testID}-scroll`}>
          {days.map((d) => {
            const isSelected = d === selected;
            const isToday = d === today;
            const hasItems = (summaries?.[d]?.total ?? 0) > 0;
            return (
              <Pressable
                key={d}
                testID={`${testID}-day-${d}`}
                accessibilityRole="button"
                accessibilityState={{ selected: isSelected }}
                accessibilityLabel={`${formatDateKey(d, 'EEEE, MMMM d')}${hasItems ? ', has items' : ''}`}
                onPress={() => onSelect(d)}
                style={({ pressed }) => [
                  styles.cell,
                  {
                    borderColor: isSelected ? p.primary : p.border,
                    backgroundColor: isSelected ? `${p.primary}22` : pressed ? p.surfaceVariant : p.surface,
                  },
                ]}>
                <AppText variant="caption" color={isToday ? p.primary : p.textSecondary} numberOfLines={1}>
                  {formatDateKey(d, 'EEE')}
                </AppText>
                <AppText variant="heading" color={isSelected ? p.primary : p.text} numberOfLines={1}>
                  {formatDateKey(d, 'd')}
                </AppText>
                <View style={styles.dotSlot}>
                  {hasItems ? <View style={[styles.dot, { backgroundColor: isSelected ? p.primary : p.textSecondary }]} /> : null}
                </View>
              </Pressable>
            );
          })}
        </ScrollView>
        <IconButton
          icon="chevron-forward"
          label="Next day"
          testID={`${testID}-next`}
          onPress={() => onSelect(shiftSelectedDate(selected, 1))}
        />
      </View>
      {showTodayButton && selected !== today ? (
        <Button
          testID={`${testID}-today`}
          label="Today"
          compact
          tone="ghost"
          icon="today-outline"
          onPress={() => onSelect(today)}
          style={styles.todayBtn}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  scroll: { flex: 1 },
  strip: { gap: CELL_GAP, paddingVertical: 2, ...(Platform.OS === 'web' ? ({ scrollSnapType: 'x proximity' } as object) : null) },
  cell: {
    width: CELL_WIDTH,
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: spacing.sm,
    gap: 2,
    ...(Platform.OS === 'web' ? ({ scrollSnapAlign: 'center' } as object) : null),
  },
  dotSlot: { height: 6, justifyContent: 'center', alignItems: 'center' },
  dot: { width: 5, height: 5, borderRadius: 2.5 },
  todayBtn: { alignSelf: 'center' },
});
