import { useState } from 'react';
import { View } from 'react-native';

import { formatDateKey, fromDateKey, isoWeekday } from '@/domain/dates';
import type { DateKey, Frequency } from '@/domain/models';
import { presetFor, WEEKDAYS, WEEKEND, type RecurrencePreset } from '@/domain/recurrence';
import type { RecurrenceInput } from '@/domain/services/taskService';

import { useTheme } from '../hooks';
import { spacing } from '../theme';
import { DatePickerModal } from './Pickers';
import { AppText, Chip, Field, Input, SelectButton } from './primitives';

const PRESETS: { value: RecurrencePreset | 'none'; label: string }[] = [
  { value: 'none', label: 'Never' },
  { value: 'daily', label: 'Daily' },
  { value: 'weekdays', label: 'Weekdays' },
  { value: 'weekends', label: 'Weekends' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'monthly', label: 'Monthly' },
  { value: 'yearly', label: 'Yearly' },
  { value: 'custom', label: 'Custom' },
];

const DAY_LABELS = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const UNITS: { value: Frequency; label: string }[] = [
  { value: 'daily', label: 'Days' },
  { value: 'weekly', label: 'Weeks' },
  { value: 'monthly', label: 'Months' },
  { value: 'yearly', label: 'Years' },
];

export function RecurrenceEditor({
  value,
  startDate,
  today,
  onChange,
  disabled,
}: {
  value: RecurrenceInput | null;
  startDate: DateKey;
  today: DateKey;
  onChange: (v: RecurrenceInput | null) => void;
  disabled?: boolean;
}) {
  const p = useTheme();
  const [endPicker, setEndPicker] = useState(false);
  const preset: RecurrencePreset | 'none' = value ? presetFor(value) : 'none';
  const [customOpen, setCustomOpen] = useState(preset === 'custom');
  const shown = customOpen && value ? 'custom' : preset;

  function choose(next: RecurrencePreset | 'none') {
    setCustomOpen(next === 'custom');
    const endDate = value?.endDate ?? null;
    const base = { interval: 1, byMonthday: null, endDate };
    switch (next) {
      case 'none':
        return onChange(null);
      case 'daily':
        return onChange({ ...base, frequency: 'daily', byWeekday: null });
      case 'weekdays':
        return onChange({ ...base, frequency: 'weekly', byWeekday: WEEKDAYS });
      case 'weekends':
        return onChange({ ...base, frequency: 'weekly', byWeekday: WEEKEND });
      case 'weekly':
        return onChange({ ...base, frequency: 'weekly', byWeekday: [isoWeekday(startDate)] });
      case 'monthly':
        return onChange({ ...base, frequency: 'monthly', byWeekday: null, byMonthday: fromDateKey(startDate).getDate() });
      case 'yearly':
        return onChange({ ...base, frequency: 'yearly', byWeekday: null });
      case 'custom':
        return onChange({ ...base, frequency: value?.frequency ?? 'daily', interval: Math.max(2, value?.interval ?? 2), byWeekday: value?.byWeekday ?? null, byMonthday: value?.byMonthday ?? null });
    }
  }

  function toggleDay(d: number) {
    if (!value) return;
    const days = new Set(value.byWeekday ?? [isoWeekday(startDate)]);
    if (days.has(d)) days.delete(d);
    else days.add(d);
    onChange({ ...value, byWeekday: [...days].sort() });
  }

  return (
    <View style={{ gap: spacing.md, opacity: disabled ? 0.5 : 1 }} pointerEvents={disabled ? 'none' : 'auto'}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
        {PRESETS.map((o) => (
          <Chip key={o.value} testID={`repeat-${o.value}`} label={o.label} selected={shown === o.value} onPress={() => choose(o.value)} />
        ))}
      </View>
      {value && shown === 'custom' ? (
        <View style={{ gap: spacing.sm }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
            <AppText>Every</AppText>
            <Input
              testID="repeat-interval"
              keyboardType="number-pad"
              value={String(value.interval)}
              onChangeText={(t) => {
                const n = Number(t.replace(/\D/g, ''));
                onChange({ ...value, interval: Number.isFinite(n) && n > 0 ? Math.min(n, 365) : 1 });
              }}
              style={{ width: 64, textAlign: 'center' }}
            />
          </View>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            {UNITS.map((u) => (
              <Chip
                key={u.value}
                label={u.label}
                selected={value.frequency === u.value}
                onPress={() =>
                  onChange({
                    ...value,
                    frequency: u.value,
                    byWeekday: u.value === 'weekly' ? (value.byWeekday ?? [isoWeekday(startDate)]) : null,
                    byMonthday: u.value === 'monthly' ? fromDateKey(startDate).getDate() : null,
                  })
                }
              />
            ))}
          </View>
        </View>
      ) : null}
      {value && value.frequency === 'weekly' && (shown === 'weekly' || shown === 'custom') ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {[1, 2, 3, 4, 5, 6, 7].map((d) => (
            <Chip key={d} testID={`weekday-${d}`} label={DAY_LABELS[d]} selected={(value.byWeekday ?? [isoWeekday(startDate)]).includes(d)} onPress={() => toggleDay(d)} />
          ))}
        </View>
      ) : null}
      {value ? (
        <Field label="Ends" hint="Leave empty to repeat indefinitely.">
          <SelectButton
            testID="repeat-end"
            icon="flag-outline"
            placeholder="Never"
            value={value.endDate ? `On ${formatDateKey(value.endDate, 'EEE, MMM d, yyyy')}` : null}
            onPress={() => setEndPicker(true)}
            onClear={() => onChange({ ...value, endDate: null })}
          />
        </Field>
      ) : null}
      <DatePickerModal
        visible={endPicker}
        value={value?.endDate ?? null}
        today={startDate > today ? startDate : today}
        title="Repeat until"
        onChange={(d) => value && onChange({ ...value, endDate: d })}
        onClose={() => setEndPicker(false)}
      />
      {disabled ? (
        <AppText variant="caption" color={p.textMuted}>
          Repeat settings apply to the whole series.
        </AppText>
      ) : null}
    </View>
  );
}
