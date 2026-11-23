import { useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Switch, View } from 'react-native';

import { describeOffset } from '@/domain/services/reminderService';
import { useTheme } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

import { AppText, Icon } from './primitives';

/** Offsets shown as primary rows (screenshot-style). Remaining values stay under Custom. */
const PRIMARY_START = [0, 10, 60, 1440];
const PRIMARY_DEADLINE = [0, 15, 60, 1440];

function alertLabel(minutes: number, kind: 'start' | 'deadline'): string {
  if (minutes === 0) return kind === 'deadline' ? 'At deadline' : 'At time of event';
  if (minutes % 1440 === 0) {
    const days = minutes / 1440;
    return days === 1 ? '1 day before' : `${days} days before`;
  }
  if (minutes % 60 === 0) {
    const hours = minutes / 60;
    return hours === 1 ? '1 hour before' : `${hours} hours before`;
  }
  if (minutes === 1) return '1 min before';
  return `${minutes} mins before`;
}

type Props = {
  visible: boolean;
  title?: string;
  value: number | null;
  /** Full option set to preserve (including values not in the primary list). */
  offsets: number[];
  kind?: 'start' | 'deadline';
  /** Default offset when turning the master switch on with no prior value. */
  defaultOnOffset?: number;
  onChange: (v: number | null) => void;
  onClose: () => void;
  testID?: string;
};

/**
 * Reminder / alert sheet matching the reference layout:
 * back + title, On/Off toggle, circular radio rows, Custom alert expander.
 * All `offsets` remain selectable; no duplicate notification scheduling.
 */
export function ReminderAlertModal({
  visible,
  title = 'Alert',
  value,
  offsets,
  kind = 'start',
  defaultOnOffset = 10,
  onChange,
  onClose,
  testID = 'reminder-alert',
}: Props) {
  const p = useTheme();
  const enabled = value !== null;
  /** User expanded Custom; null means derive from whether the current value is a custom offset. */
  const [customForced, setCustomForced] = useState<boolean | null>(null);

  const primary = kind === 'deadline' ? PRIMARY_DEADLINE : PRIMARY_START;
  const primaryRows = useMemo(() => primary.filter((m) => offsets.includes(m)), [offsets, primary]);
  const customRows = useMemo(
    () => offsets.filter((m) => !primary.includes(m)).sort((a, b) => a - b),
    [offsets, primary],
  );
  const valueInCustom = value !== null && customRows.includes(value);
  const customOpen = customForced ?? valueInCustom;

  function turnOn(next: boolean) {
    if (!next) {
      onChange(null);
      setCustomForced(null);
      return;
    }
    if (value !== null) return;
    const fallback = offsets.includes(defaultOnOffset)
      ? defaultOnOffset
      : offsets.includes(10)
        ? 10
        : (offsets[0] ?? 0);
    onChange(fallback);
  }

  function pick(minutes: number) {
    onChange(minutes);
    if (!primary.includes(minutes)) setCustomForced(true);
  }

  return (
    <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
      <View style={[styles.fill, { backgroundColor: p.background }]} testID={testID}>
        <View style={styles.header}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Close alert"
            testID={`${testID}-back`}
            onPress={onClose}
            style={styles.backBtn}
            hitSlop={8}>
            <Icon name="chevron-back" size={28} color={p.text} />
          </Pressable>
          <AppText variant="display" style={{ flex: 1 }}>
            {title}
          </AppText>
        </View>

        <View style={[styles.toggleCard, { backgroundColor: p.surfaceVariant }]}>
          <AppText color={enabled ? p.primary : p.textSecondary} style={{ fontWeight: '600' }}>
            {enabled ? 'On' : 'Off'}
          </AppText>
          <Switch
            testID={`${testID}-toggle`}
            value={enabled}
            onValueChange={turnOn}
            trackColor={{ false: p.border, true: p.primary }}
            thumbColor="#fff"
          />
        </View>

        {enabled ? (
          <View style={[styles.listCard, { backgroundColor: p.surface, borderColor: p.border }]}>
            <ScrollView style={{ maxHeight: 420 }} bounces={false}>
              {primaryRows.map((m, i) => {
                const selected = value === m;
                return (
                  <Pressable
                    key={m}
                    testID={`${testID}-option-${m}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => pick(m)}
                    style={[
                      styles.row,
                      i < primaryRows.length - 1 || customRows.length ? styles.rowBorder : null,
                      { borderBottomColor: p.border },
                    ]}>
                    <View
                      style={[
                        styles.radio,
                        {
                          borderColor: selected ? p.primary : p.border,
                          backgroundColor: selected ? p.primary : 'transparent',
                        },
                      ]}>
                      {selected ? <Icon name="checkmark" size={14} color="#fff" /> : null}
                    </View>
                    <AppText color={p.text}>{alertLabel(m, kind)}</AppText>
                  </Pressable>
                );
              })}

              {customRows.length ? (
                <>
                  <Pressable
                    testID={`${testID}-custom`}
                    accessibilityRole="button"
                    onPress={() => setCustomForced((o) => !(o ?? valueInCustom))}
                    style={[styles.row, customOpen ? styles.rowBorder : null, { borderBottomColor: p.border }]}>
                    <Icon name="add" size={22} color={p.success} />
                    <AppText color={p.text}>Custom alert</AppText>
                    {valueInCustom ? (
                      <AppText variant="caption" muted style={{ marginLeft: 'auto' }}>
                        {describeOffset(value!)}
                      </AppText>
                    ) : null}
                  </Pressable>
                  {customOpen
                    ? customRows.map((m, i) => {
                        const selected = value === m;
                        return (
                          <Pressable
                            key={m}
                            testID={`${testID}-custom-${m}`}
                            accessibilityRole="radio"
                            accessibilityState={{ selected }}
                            onPress={() => pick(m)}
                            style={[
                              styles.row,
                              styles.customRow,
                              i < customRows.length - 1 ? styles.rowBorder : null,
                              { borderBottomColor: p.border, backgroundColor: p.surfaceVariant },
                            ]}>
                            <View
                              style={[
                                styles.radio,
                                {
                                  borderColor: selected ? p.primary : p.border,
                                  backgroundColor: selected ? p.primary : 'transparent',
                                },
                              ]}>
                              {selected ? <Icon name="checkmark" size={14} color="#fff" /> : null}
                            </View>
                            <AppText color={p.text}>{alertLabel(m, kind)}</AppText>
                          </Pressable>
                        );
                      })
                    : null}
                </>
              ) : null}
            </ScrollView>
          </View>
        ) : (
          <AppText muted style={{ paddingHorizontal: spacing.lg }}>
            Turn on to choose when you are notified. Only one alert is scheduled per reminder.
          </AppText>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1, paddingTop: spacing.lg, gap: spacing.md },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.sm,
    gap: spacing.xs,
    minHeight: 48,
  },
  backBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  toggleCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    paddingHorizontal: spacing.lg,
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  listCard: {
    marginHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: 'hidden',
  },
  row: {
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  customRow: { paddingLeft: spacing.xl },
  rowBorder: { borderBottomWidth: StyleSheet.hairlineWidth },
  radio: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
