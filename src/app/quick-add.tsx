import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { addDaysKey, formatDateKey, formatTime, todayKey } from '@/domain/dates';
import { PRIORITIES, type DateKey, type ItemKind, type Priority, type TimeOfDay } from '@/domain/models';
import { parseQuickAdd } from '@/domain/quickParse';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { DatePickerModal, TimePickerModal } from '@/ui/components/Pickers';
import { AppText, Badge, Button, Chip, Input, Segmented } from '@/ui/components/primitives';
import { errorMessage, useQuery, useTheme, useToast } from '@/ui/hooks';
import { radius, spacing } from '@/ui/theme';

export default function QuickAddScreen() {
  const params = useLocalSearchParams<{ date?: DateKey; kind?: ItemKind }>();
  const p = useTheme();
  const insets = useSafeAreaInsets();
  const services = useServices();
  const settings = useSettings();
  const invalidate = useAppStore((s) => s.invalidate);
  const toast = useToast((s) => s.show);
  const today = todayKey(services.clock);
  const categories = useQuery((s) => s.categories.list(), []);

  const [kind, setKind] = useState<ItemKind>(params.kind ?? 'task');
  const [text, setText] = useState('');
  const [date, setDate] = useState<DateKey | null>(null);
  const [time, setTime] = useState<TimeOfDay | null>(null);
  const [priority, setPriority] = useState<Priority | null>(null);
  const [picker, setPicker] = useState<null | 'date' | 'time'>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const parsed = useMemo(() => parseQuickAdd(text, today), [text, today]);
  const effectiveDate = date ?? parsed.date ?? params.date ?? today;
  const effectiveTime = time ?? parsed.time;
  const effectivePriority = priority ?? parsed.priority ?? 'medium';
  const category = parsed.categoryName
    ? (categories.data?.find((c) => c.name.toLowerCase() === parsed.categoryName!.toLowerCase()) ?? null)
    : null;
  const title = parsed.title || text.trim();

  async function add() {
    if (!title) return;
    setSaving(true);
    setError(null);
    try {
      const reminderOffsetMinutes = effectiveTime ? settings.defaultReminderOffsetMinutes : null;
      if (reminderOffsetMinutes !== null && settings.notificationsEnabled) {
        const perm = await services.reminders.permission();
        if (perm !== 'granted' && perm !== 'unsupported') {
          const next = await services.reminders.requestPermission();
          if (next === 'denied') toast('Item saved, but notification permission is blocked.', 'error');
        }
      }
      await services.tasks.create({
        kind,
        title,
        notes: '',
        categoryId: category?.id ?? null,
        priority: effectivePriority,
        date: effectiveDate,
        allDay: false,
        startTime: effectiveTime,
        endTime: null,
        deadlineAt: null,
        // Timed items (task or event) get the Settings default reminder offset so alarms schedule immediately.
        reminderOffsetMinutes,
        deadlineReminderOffsetMinutes: null,
        recurrence: null,
      });
      invalidate();
      toast(`${kind === 'event' ? 'Event' : 'Task'} added for ${effectiveDate === today ? 'today' : formatDateKey(effectiveDate, 'EEE, MMM d')}`, 'success');
      router.back();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  function moreOptions() {
    router.replace({ pathname: '/item/edit', params: { kind, date: effectiveDate, title } });
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
      <Pressable style={[styles.backdrop, { backgroundColor: p.overlay }]} onPress={() => router.back()} accessibilityLabel="Close quick add" />
      <View style={[styles.sheet, { backgroundColor: p.surface, paddingBottom: insets.bottom + spacing.lg }]}>
        <View style={[styles.grabber, { backgroundColor: p.border }]} />
        <Segmented<ItemKind>
          value={kind}
          onChange={setKind}
          options={[
            { value: 'task', label: 'Task' },
            { value: 'event', label: 'Event' },
          ]}
        />
        <Input
          testID="quick-title"
          autoFocus
          value={text}
          onChangeText={setText}
          placeholder={kind === 'event' ? 'e.g. Dentist fri 3pm #health' : 'e.g. Submit report tomorrow !high #work'}
          returnKeyType="done"
          onSubmitEditing={add}
        />
        {parsed.matched.length ? (
          <View style={styles.wrap}>
            {parsed.matched.map((m) => (
              <Badge key={m} label={m} color={p.primary} background={p.primarySoft} icon="sparkles" />
            ))}
            {parsed.categoryName && !category ? <Badge label={`No category "${parsed.categoryName}"`} color={p.warning} background={p.warningSoft} /> : null}
          </View>
        ) : null}
        <View style={styles.wrap}>
          <Chip label="Today" icon="sunny-outline" selected={effectiveDate === today} onPress={() => setDate(today)} />
          <Chip label="Tomorrow" icon="arrow-forward" selected={effectiveDate === addDaysKey(today, 1)} onPress={() => setDate(addDaysKey(today, 1))} />
          <Chip
            testID="quick-date"
            label={effectiveDate !== today && effectiveDate !== addDaysKey(today, 1) ? formatDateKey(effectiveDate, 'EEE, MMM d') : 'Pick date'}
            icon="calendar-outline"
            selected={effectiveDate !== today && effectiveDate !== addDaysKey(today, 1)}
            onPress={() => setPicker('date')}
          />
          <Chip testID="quick-time" label={effectiveTime ? formatTime(effectiveTime) : 'Add time'} icon="time-outline" selected={!!effectiveTime} onPress={() => setPicker('time')} />
          {category ? <Chip label={category.name} color={category.color} selected /> : null}
        </View>
        {kind === 'task' ? (
          <View style={styles.wrap}>
            {PRIORITIES.map((pr) => (
              <Chip key={pr} label={PRIORITY_LABEL[pr]} icon="flag" color={p.priority[pr]} selected={effectivePriority === pr} onPress={() => setPriority(pr)} />
            ))}
          </View>
        ) : null}
        {error ? <AppText color={p.danger}>{error}</AppText> : null}
        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="More options" tone="secondary" icon="options-outline" onPress={moreOptions} style={{ flex: 1 }} />
          <Button testID="quick-save" label="Add" icon="add" onPress={add} loading={saving} disabled={!title} style={{ flex: 1 }} />
        </View>
      </View>
      <DatePickerModal visible={picker === 'date'} value={effectiveDate} today={today} onChange={setDate} onClose={() => setPicker(null)} />
      <TimePickerModal visible={picker === 'time'} value={effectiveTime} onChange={setTime} onClose={() => setPicker(null)} />
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing.lg, gap: spacing.md, width: '100%', maxWidth: 640, alignSelf: 'center' },
  grabber: { width: 40, height: 4, borderRadius: 2, alignSelf: 'center' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
