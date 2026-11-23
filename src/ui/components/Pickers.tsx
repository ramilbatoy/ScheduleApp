import { addMonths, format } from 'date-fns';
import { useEffect, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { fromDateKey, nowTimeOfDay, toDateKey } from '@/domain/dates';
import type { DateKey, TimeOfDay } from '@/domain/models';

import { useTheme } from '../hooks';
import { radius, spacing } from '../theme';
import { MonthGrid } from './MonthGrid';
import { AppText, Button, IconButton } from './primitives';

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
}: {
  visible: boolean;
  value: DateKey | null;
  today: DateKey;
  title?: string;
  onChange: (d: DateKey) => void;
  onClose: () => void;
}) {
  const [month, setMonth] = useState(value ?? today);
  useEffect(() => {
    if (visible) setMonth(value ?? today);
  }, [visible, value, today]);
  return (
    <Sheet visible={visible} onClose={onClose} title={title}>
      <View style={styles.monthNav}>
        <IconButton icon="chevron-back" label="Previous month" onPress={() => setMonth(toDateKey(addMonths(fromDateKey(month), -1)))} />
        <AppText variant="heading">{format(fromDateKey(month), 'MMMM yyyy')}</AppText>
        <IconButton icon="chevron-forward" label="Next month" onPress={() => setMonth(toDateKey(addMonths(fromDateKey(month), 1)))} />
      </View>
      <MonthGrid
        compact
        month={month}
        selected={value}
        today={today}
        onSelect={(d) => {
          onChange(d);
          onClose();
        }}
      />
      <View style={styles.row}>
        <Button
          label="Today"
          tone="secondary"
          compact
          onPress={() => {
            onChange(today);
            onClose();
          }}
        />
        <Button label="Cancel" tone="ghost" compact onPress={onClose} />
      </View>
    </Sheet>
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
  monthNav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  row: { flexDirection: 'row', justifyContent: 'flex-end', gap: spacing.sm },
  option: { minHeight: 44, paddingHorizontal: spacing.md, borderRadius: radius.md, justifyContent: 'center', alignItems: 'center' },
});
