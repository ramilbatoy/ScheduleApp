import { addMonths, format } from 'date-fns';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { fromDateKey, nowTimeOfDay, toDateKey } from '@/domain/dates';
import type { DateKey, TimeOfDay } from '@/domain/models';
import { jumpAnchorToMonth, parseYearMonth } from '@/domain/monthTable';

import { useTheme } from '../hooks';
import { radius, spacing } from '../theme';
import { MonthGrid } from './MonthGrid';
import { AppText, Button, IconButton } from './primitives';

const MONTH_OPTIONS = [
  { value: 1, label: 'January' },
  { value: 2, label: 'February' },
  { value: 3, label: 'March' },
  { value: 4, label: 'April' },
  { value: 5, label: 'May' },
  { value: 6, label: 'June' },
  { value: 7, label: 'July' },
  { value: 8, label: 'August' },
  { value: 9, label: 'September' },
  { value: 10, label: 'October' },
  { value: 11, label: 'November' },
  { value: 12, label: 'December' },
] as const;

export function Sheet({ visible, onClose, children, title }: { visible: boolean; onClose: () => void; children: React.ReactNode; title: string }) {
  const p = useTheme();
  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={onClose}>
        <Pressable style={[styles.sheet, { backgroundColor: p.surface }]} onPress={() => undefined}>
          <AppText variant="title">{title}</AppText>
          {children}
        </Pressable>
      </Pressable>
    </Modal>
  );
}

export function DatePickerModal({
  visible,
  value,
  today,
  title = 'Pick a date',
  onChange,
  onClose,
  allDay,
  onAllDayChange,
  timeLabel,
  onTimePress,
}: {
  visible: boolean;
  value: DateKey | null;
  today: DateKey;
  title?: string;
  onChange: (d: DateKey) => void;
  onClose: () => void;
  /** When set with `onAllDayChange`, shows All Day next to Today (quick-add When). */
  allDay?: boolean;
  onAllDayChange?: (next: boolean) => void;
  /** Label for the Time button; omitted from UI when All Day is on. */
  timeLabel?: string;
  onTimePress?: () => void;
}) {
  const p = useTheme();
  const [month, setMonth] = useState(value ?? today);
  const [pick, setPick] = useState<null | 'month' | 'year'>(null);
  const showWhenExtras = typeof allDay === 'boolean' && !!onAllDayChange;
  useEffect(() => {
    if (visible) {
      setMonth(value ?? today);
      setPick(null);
    }
  }, [visible, value, today]);

  const ym = parseYearMonth(month);
  const yearOptions = useMemo(() => {
    const center = ym.year;
    return Array.from({ length: 21 }, (_, i) => {
      const y = center - 10 + i;
      return { value: y, label: String(y) };
    });
  }, [ym.year]);

  function setMonthYear(nextYear: number, nextMonth: number) {
    setMonth(jumpAnchorToMonth(month, nextYear, nextMonth));
  }

  return (
    <>
      <Sheet visible={visible && pick === null} onClose={onClose} title={title}>
        <View style={styles.monthNav}>
          <IconButton
            icon="chevron-back"
            label="Previous month"
            onPress={() => setMonth(toDateKey(addMonths(fromDateKey(month), -1)))}
            testID="goto-prev-month"
          />
          <View style={styles.monthYearPickers}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Month ${MONTH_OPTIONS[ym.month - 1]?.label}`}
              onPress={() => setPick('month')}
              testID="goto-pick-month"
              style={[styles.monthYearChip, { backgroundColor: p.surfaceVariant }]}>
              <AppText variant="heading">{format(fromDateKey(month), 'MMMM')}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Year ${ym.year}`}
              onPress={() => setPick('year')}
              testID="goto-pick-year"
              style={[styles.monthYearChip, { backgroundColor: p.surfaceVariant }]}>
              <AppText variant="heading">{String(ym.year)}</AppText>
            </Pressable>
          </View>
          <IconButton
            icon="chevron-forward"
            label="Next month"
            onPress={() => setMonth(toDateKey(addMonths(fromDateKey(month), 1)))}
            testID="goto-next-month"
          />
        </View>
        <MonthGrid
          compact
          month={month}
          selected={value}
          today={today}
          onSelect={(d) => {
            onChange(d);
            if (!showWhenExtras) onClose();
          }}
        />
        <View style={styles.whenRow}>
          <Button
            testID="goto-today"
            label="Today"
            tone="secondary"
            compact
            onPress={() => {
              onChange(today);
              if (!showWhenExtras) onClose();
            }}
          />
          {showWhenExtras ? (
            <>
              <Pressable
                testID="goto-all-day"
                accessibilityRole="switch"
                accessibilityState={{ checked: allDay }}
                accessibilityLabel="All Day"
                onPress={() => onAllDayChange(!allDay)}
                style={[
                  styles.allDayChip,
                  {
                    borderColor: allDay ? p.primary : p.border,
                    backgroundColor: allDay ? `${p.primary}22` : p.surface,
                  },
                ]}>
                <AppText variant="label" color={allDay ? p.primary : p.text}>
                  All Day
                </AppText>
              </Pressable>
              {!allDay && onTimePress ? (
                <Button
                  testID="goto-time"
                  label={timeLabel ?? 'Time'}
                  tone="secondary"
                  compact
                  icon="time-outline"
                  onPress={onTimePress}
                />
              ) : null}
            </>
          ) : null}
          <View style={{ flex: 1 }} />
          <Button label={showWhenExtras ? 'Done' : 'Cancel'} tone="ghost" compact onPress={onClose} />
        </View>
      </Sheet>
      <OptionsModal
        visible={pick === 'month'}
        title="Month"
        value={ym.month}
        options={[...MONTH_OPTIONS]}
        onChange={(m) => {
          setMonthYear(ym.year, m);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
      <OptionsModal
        visible={pick === 'year'}
        title="Year"
        value={ym.year}
        options={yearOptions}
        onChange={(y) => {
          setMonthYear(y, ym.month);
          setPick(null);
        }}
        onClose={() => setPick(null)}
      />
    </>
  );
}

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5);

function label12(h: number) {
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 === 0 ? 12 : h % 12} ${suffix}`;
}

export function TimePickerModal({
  visible,
  value,
  title = 'Pick a time',
  onChange,
  onClose,
}: {
  visible: boolean;
  value: TimeOfDay | null;
  title?: string;
  onChange: (t: TimeOfDay) => void;
  onClose: () => void;
}) {
  const p = useTheme();
  const [h, setH] = useState(9);
  const [m, setM] = useState(0);
  useEffect(() => {
    if (!visible) return;
    // Seed empty pickers with the current local time; never overwrite an existing/user-chosen value.
    const seed = value ?? nowTimeOfDay();
    const [hh, mm] = seed.split(':').map(Number);
    setH(hh);
    setM(mm);
  }, [visible, value]);
  const minuteOptions = MINUTES.includes(m) ? MINUTES : [...MINUTES, m].sort((a, b) => a - b);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <AppText variant="display" style={{ textAlign: 'center' }}>
        {`${h % 12 === 0 ? 12 : h % 12}:${String(m).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`}
      </AppText>
      <View style={{ flexDirection: 'row', gap: spacing.md, height: 240 }}>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
          {HOURS.map((x) => (
            <Pressable key={x} testID={`hour-${x}`} onPress={() => setH(x)} style={[styles.option, x === h && { backgroundColor: p.primarySoft }]}>
              <AppText color={x === h ? p.primary : p.text}>{label12(x)}</AppText>
            </Pressable>
          ))}
        </ScrollView>
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ gap: 4 }}>
          {minuteOptions.map((x) => (
            <Pressable key={x} testID={`minute-${x}`} onPress={() => setM(x)} style={[styles.option, x === m && { backgroundColor: p.primarySoft }]}>
              <AppText color={x === m ? p.primary : p.text}>{`:${String(x).padStart(2, '0')}`}</AppText>
            </Pressable>
          ))}
        </ScrollView>
      </View>
      <View style={styles.row}>
        <Button label="Cancel" tone="ghost" compact onPress={onClose} />
        <Button
          testID="time-done"
          label="Set time"
          compact
          onPress={() => {
            onChange(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
            onClose();
          }}
        />
      </View>
    </Sheet>
  );
}

export function OptionsModal<T extends string | number | null>({
  visible,
  title,
  options,
  value,
  onChange,
  onClose,
}: {
  visible: boolean;
  title: string;
  options: { value: T; label: string; color?: string }[];
  value: T;
  onChange: (v: T) => void;
  onClose: () => void;
}) {
  const p = useTheme();
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <ScrollView style={{ maxHeight: 380 }} contentContainerStyle={{ gap: 4 }}>
        {options.map((o) => (
          <Pressable
            key={String(o.value)}
            testID={`option-${o.label}`}
            onPress={() => {
              onChange(o.value);
              onClose();
            }}
            style={[styles.option, { flexDirection: 'row', gap: spacing.md }, o.value === value && { backgroundColor: p.primarySoft }]}>
            {o.color ? <View style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: o.color }} /> : null}
            <AppText color={o.value === value ? p.primary : p.text}>{o.label}</AppText>
          </Pressable>
        ))}
      </ScrollView>
      <Button label="Cancel" tone="ghost" compact onPress={onClose} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, justifyContent: 'center', padding: spacing.lg },
  sheet: { borderRadius: radius.xl, padding: spacing.lg, gap: spacing.md, maxWidth: 440, width: '100%', alignSelf: 'center' },
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.xs },
  monthYearPickers: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: spacing.xs },
  monthYearChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  whenRow: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.sm },
  allDayChip: {
    minHeight: 36,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  option: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
});
