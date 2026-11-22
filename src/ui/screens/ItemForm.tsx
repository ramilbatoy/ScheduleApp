import { router, Stack } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';

import { combineDateTime, formatDateKey, formatTime, toDateKey, todayKey } from '@/domain/dates';
import { PRIORITIES, type DateKey, type ItemKind, type SubtaskNode } from '@/domain/models';
import { describeOffset } from '@/domain/services/reminderService';
import type { EditScope, ItemInput } from '@/domain/services/taskService';
import { useAppStore, useServices, useSettings } from '@/state/appStore';

import { PRIORITY_LABEL } from '../components/AgendaRow';
import { DatePickerModal, OptionsModal, TimePickerModal } from '../components/Pickers';
import { AppText, Button, Card, Chip, ErrorState, Field, Input, LoadingState, Segmented, SelectButton, SwitchRow } from '../components/primitives';
import { RecurrenceEditor } from '../components/RecurrenceEditor';
import { SubtaskEditor } from '../components/SubtaskList';
import { errorMessage, useQuery, useTheme, useToast } from '../hooks';
import { goBackOrDashboard, useSafeAndroidBack } from '../navigation';
import { spacing } from '../theme';

const START_OFFSETS = [0, 5, 10, 15, 30, 60, 120, 1440];
const DEADLINE_OFFSETS = [0, 15, 60, 180, 1440, 2880, 10080];

export interface ItemFormParams {
  id?: string;
  scope?: EditScope;
  date?: DateKey;
  kind?: ItemKind;
  title?: string;
}

export function ItemForm({
  params,
  embedded,
  onDone,
}: {
  params: ItemFormParams;
  /** When true, skip stack chrome and Android-back hook (used inside modals). */
  embedded?: boolean;
  /** Called instead of stack navigation after save/cancel when provided. */
  onDone?: () => void;
}) {
  const services = useServices();
  const today = todayKey(services.clock);
  const editing = !!params.id;
  const scope: EditScope = params.scope ?? 'series';
  const initial = useQuery(
    async (s): Promise<{ input: ItemInput; recurring: boolean }> => {
      if (params.id) {
        const detail = await s.tasks.getDetail(params.id);
        return { input: await s.tasks.formValues(params.id, scope), recurring: !!detail.rule };
      }
      const settings = await s.settings.get();
      return {
        recurring: false,
        input: {
          kind: params.kind ?? 'task',
          title: params.title ?? '',
          notes: '',
          categoryId: null,
          priority: 'medium',
          date: params.date ?? today,
          allDay: false,
          startTime: null,
          endTime: null,
          deadlineAt: null,
          reminderOffsetMinutes: params.kind === 'event' ? settings.defaultReminderOffsetMinutes : null,
          deadlineReminderOffsetMinutes: null,
          recurrence: null,
        },
      };
    },
    [params.id, scope],
  );

  if (initial.error) return <ErrorState message={initial.error} onRetry={initial.reload} />;
  if (!initial.data) return <LoadingState />;
  return (
    <Form
      key={params.id ?? 'new'}
      initial={initial.data.input}
      recurring={initial.data.recurring}
      editing={editing}
      scope={scope}
      occurrenceId={params.id}
      embedded={embedded}
      onDone={onDone}
    />
  );
}

function Form({
  initial,
  recurring,
  editing,
  scope,
  occurrenceId,
  embedded,
  onDone,
}: {
  initial: ItemInput;
  recurring: boolean;
  editing: boolean;
  scope: EditScope;
  occurrenceId?: string;
  embedded?: boolean;
  onDone?: () => void;
}) {
  const p = useTheme();
  const services = useServices();
  const settings = useSettings();
  const invalidate = useAppStore((s) => s.invalidate);
  const toast = useToast((s) => s.show);
  useSafeAndroidBack(!embedded);
  const finish = onDone ?? goBackOrDashboard;
  const today = todayKey(services.clock);
  const [v, setV] = useState<ItemInput>(initial);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [picker, setPicker] = useState<null | 'date' | 'start' | 'end' | 'deadlineDate' | 'deadlineTime' | 'category' | 'reminder' | 'deadlineReminder'>(null);
  const categories = useQuery((s) => s.categories.list(), []);
  const subtasks = useQuery(
    async (s): Promise<SubtaskNode[]> => (occurrenceId && v.kind === 'task' ? s.subtasks.treeForOccurrence(occurrenceId) : []),
    [occurrenceId, v.kind],
  );
  const occurrenceOnly = editing && recurring && scope === 'occurrence';
  const isEvent = v.kind === 'event';
  const set = (patch: Partial<ItemInput>) => setV((cur) => ({ ...cur, ...patch }));

  useEffect(() => setError(null), [v]);

  const deadlineDate = v.deadlineAt ? toDateKey(new Date(v.deadlineAt)) : null;
  const deadlineTime = v.deadlineAt
    ? `${String(new Date(v.deadlineAt).getHours()).padStart(2, '0')}:${String(new Date(v.deadlineAt).getMinutes()).padStart(2, '0')}`
    : null;
  const category = categories.data?.find((c) => c.id === v.categoryId) ?? null;

  const title = useMemo(() => {
    if (!editing) return isEvent ? 'New event' : 'New task';
    if (occurrenceOnly) return 'Edit this occurrence';
    if (recurring && scope === 'future') return 'Edit this and following';
    if (recurring) return 'Edit series';
    return isEvent ? 'Edit event' : 'Edit task';
  }, [editing, isEvent, occurrenceOnly, recurring, scope]);

  async function ensureReminderPermission() {
    if (v.reminderOffsetMinutes === null && v.deadlineReminderOffsetMinutes === null) return;
    if (!(await services.settings.get()).notificationsEnabled) return;
    const state = await services.reminders.permission();
    if (state === 'granted' || state === 'unsupported') return;
    const next = await services.reminders.requestPermission();
    if (next === 'denied') toast('Reminders were saved, but notification permission is blocked.', 'error');
  }

  async function save() {
    setSaving(true);
    try {
      await ensureReminderPermission();
      if (editing && occurrenceId) {
        const updated = await services.tasks.update(occurrenceId, v, scope);
        invalidate();
        toast('Saved', 'success');
        finish();
        // A series edit can regenerate the instance being viewed; point the detail screen at its replacement.
        if (!embedded && updated.id !== occurrenceId) setTimeout(() => router.setParams({ id: updated.id }), 0);
      } else {
        const created = await services.tasks.create(v);
        invalidate();
        toast(isEvent ? 'Event added' : 'Task added', 'success');
        if (embedded) finish();
        else router.replace({ pathname: '/item/[id]', params: { id: created.id } });
      }
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: p.background }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      {embedded ? null : <Stack.Screen options={{ title }} />}
      {embedded ? (
        <AppText variant="title" style={{ paddingHorizontal: spacing.lg, paddingTop: spacing.md }}>
          {title}
        </AppText>
      ) : null}
      <ScrollView contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 140 }} keyboardShouldPersistTaps="handled">
        {occurrenceOnly ? (
          <Card style={{ backgroundColor: p.infoSoft, borderColor: p.infoSoft }}>
            <AppText color={p.info}>Changes to title, notes, date and time apply to this occurrence only. Other fields belong to the series.</AppText>
          </Card>
        ) : null}

        {!editing ? (
          <Segmented<ItemKind>
            testID="kind-segmented"
            value={v.kind}
            onChange={(kind) => set({ kind, ...(kind === 'task' ? { allDay: false } : {}) })}
            options={[
              { value: 'task', label: 'Task' },
              { value: 'event', label: 'Event / schedule' },
            ]}
          />
        ) : null}

        <Field label="Title" error={error && /title/i.test(error) ? error : null}>
          <Input testID="input-title" value={v.title} onChangeText={(title) => set({ title })} placeholder={isEvent ? 'e.g. Team meeting' : 'e.g. Submit expense report'} autoFocus={!editing} maxLength={200} />
        </Field>

        <Field label="Notes">
          <Input testID="input-notes" value={v.notes} onChangeText={(notes) => set({ notes })} placeholder="Details, links, checklist…" multiline />
        </Field>

        {editing && occurrenceId && !isEvent ? (
          <SubtaskEditor occurrenceId={occurrenceId} nodes={subtasks.data ?? []} testID="edit-subtasks" />
        ) : !editing && !isEvent ? (
          <AppText variant="caption" muted>
            After you save, open the task to add nested subtasks with their own checkboxes and notes.
          </AppText>
        ) : null}

        <Field label={recurring && !occurrenceOnly && scope === 'series' ? 'Series starts' : isEvent ? 'Date' : 'Assigned date'}>
          <SelectButton testID="input-date" icon="calendar-outline" placeholder="Pick a date" value={formatDateKey(v.date, 'EEE, MMM d, yyyy')} onPress={() => setPicker('date')} />
        </Field>

        {isEvent ? <SwitchRow testID="toggle-all-day" label="All-day" value={v.allDay} onChange={(allDay) => set({ allDay, ...(allDay ? { startTime: null, endTime: null } : {}) })} /> : null}

        {!v.allDay ? (
          <View style={{ flexDirection: 'row', gap: spacing.md }}>
            <View style={{ flex: 1 }}>
              <Field label={isEvent ? 'Start time' : 'Start time (optional)'}>
                <SelectButton testID="input-start" icon="time-outline" placeholder="None" value={v.startTime ? formatTime(v.startTime) : null} onPress={() => setPicker('start')} onClear={() => set({ startTime: null, endTime: null })} />
              </Field>
            </View>
            <View style={{ flex: 1 }}>
              <Field label="End time">
                <SelectButton testID="input-end" icon="time-outline" placeholder="None" value={v.endTime ? formatTime(v.endTime) : null} onPress={() => setPicker('end')} onClear={() => set({ endTime: null })} />
              </Field>
            </View>
          </View>
        ) : null}

        <View style={{ gap: spacing.lg, opacity: occurrenceOnly ? 0.5 : 1 }} pointerEvents={occurrenceOnly ? 'none' : 'auto'}>
          <Field label="Priority">
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
              {PRIORITIES.map((pr) => (
                <Chip key={pr} testID={`priority-${pr}`} label={PRIORITY_LABEL[pr]} color={p.priority[pr]} icon="flag" selected={v.priority === pr} onPress={() => set({ priority: pr })} />
              ))}
            </View>
          </Field>

          <Field label="Category">
            <SelectButton testID="input-category" icon="pricetag-outline" placeholder="No category" value={category?.name ?? null} onPress={() => setPicker('category')} onClear={() => set({ categoryId: null })} />
          </Field>

          <Field label="Deadline" hint="Independent of the assigned date. Shows as overdue once passed.">
            <View style={{ flexDirection: 'row', gap: spacing.md }}>
              <View style={{ flex: 3 }}>
                <SelectButton testID="input-deadline-date" icon="hourglass-outline" placeholder="No deadline" value={deadlineDate ? formatDateKey(deadlineDate, 'MMM d, yyyy') : null} onPress={() => setPicker('deadlineDate')} onClear={() => set({ deadlineAt: null, deadlineReminderOffsetMinutes: null })} />
              </View>
              {deadlineDate ? (
                <View style={{ flex: 2 }}>
                  <SelectButton testID="input-deadline-time" icon="time-outline" placeholder="Time" value={deadlineTime ? formatTime(deadlineTime) : null} onPress={() => setPicker('deadlineTime')} />
                </View>
              ) : null}
            </View>
          </Field>

          <Field
            label="Reminder"
            hint={settings.notificationsEnabled ? (v.allDay || !v.startTime ? 'Without a start time, reminders use 9:00 AM on the day.' : undefined) : 'Notifications are turned off in Settings.'}>
            <SelectButton testID="input-reminder" icon="notifications-outline" placeholder="No reminder" value={v.reminderOffsetMinutes !== null ? describeOffset(v.reminderOffsetMinutes) : null} onPress={() => setPicker('reminder')} onClear={() => set({ reminderOffsetMinutes: null })} />
          </Field>

          {v.deadlineAt ? (
            <Field label="Deadline reminder">
              <SelectButton testID="input-deadline-reminder" icon="alarm-outline" placeholder="No deadline reminder" value={v.deadlineReminderOffsetMinutes !== null ? describeOffset(v.deadlineReminderOffsetMinutes) : null} onPress={() => setPicker('deadlineReminder')} onClear={() => set({ deadlineReminderOffsetMinutes: null })} />
            </Field>
          ) : null}

          <Field label="Repeat">
            <RecurrenceEditor value={v.recurrence} startDate={v.date} today={today} onChange={(recurrence) => set({ recurrence })} disabled={occurrenceOnly} />
          </Field>
        </View>

        {error ? (
          <Card style={{ backgroundColor: p.dangerSoft, borderColor: p.dangerSoft }}>
            <AppText color={p.danger} testID="form-error">
              {error}
            </AppText>
          </Card>
        ) : null}

        <View style={{ flexDirection: 'row', gap: spacing.md }}>
          <Button label="Cancel" tone="secondary" onPress={finish} style={{ flex: 1 }} testID="cancel-item" />
          <Button testID="save-item" label={editing ? 'Save changes' : isEvent ? 'Add event' : 'Add task'} onPress={save} loading={saving} disabled={!v.title.trim()} style={{ flex: 2 }} />
        </View>
      </ScrollView>

      <DatePickerModal visible={picker === 'date'} value={v.date} today={today} onChange={(date) => set({ date })} onClose={() => setPicker(null)} />
      <TimePickerModal
        visible={picker === 'start'}
        value={v.startTime}
        title="Start time"
        onChange={(startTime) =>
          set({
            startTime,
            ...(v.endTime && v.endTime <= startTime ? { endTime: null } : {}),
            // First time a start clock is chosen, apply the Settings default reminder so an OS alarm is scheduled.
            ...(v.reminderOffsetMinutes === null && settings.defaultReminderOffsetMinutes !== null
              ? { reminderOffsetMinutes: settings.defaultReminderOffsetMinutes }
              : {}),
          })
        }
        onClose={() => setPicker(null)}
      />
      <TimePickerModal visible={picker === 'end'} value={v.endTime ?? v.startTime} title="End time" onChange={(endTime) => set({ endTime, ...(v.startTime ? {} : { startTime: endTime }) })} onClose={() => setPicker(null)} />
      <DatePickerModal
        visible={picker === 'deadlineDate'}
        value={deadlineDate}
        today={today}
        title="Deadline date"
        onChange={(d) => set({ deadlineAt: combineDateTime(d, deadlineTime ?? '17:00').toISOString() })}
        onClose={() => setPicker(null)}
      />
      <TimePickerModal
        visible={picker === 'deadlineTime'}
        value={deadlineTime}
        title="Deadline time"
        onChange={(t) => deadlineDate && set({ deadlineAt: combineDateTime(deadlineDate, t).toISOString() })}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<string | null>
        visible={picker === 'category'}
        title="Category"
        value={v.categoryId}
        options={[{ value: null, label: 'No category' }, ...(categories.data ?? []).map((c) => ({ value: c.id, label: c.name, color: c.color }))]}
        onChange={(categoryId) => set({ categoryId })}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<number | null>
        visible={picker === 'reminder'}
        title={v.startTime ? 'Remind me before start' : 'Remind me on the day'}
        value={v.reminderOffsetMinutes}
        options={[{ value: null, label: 'No reminder' }, ...START_OFFSETS.map((m) => ({ value: m, label: describeOffset(m) }))]}
        onChange={(reminderOffsetMinutes) => set({ reminderOffsetMinutes })}
        onClose={() => setPicker(null)}
      />
      <OptionsModal<number | null>
        visible={picker === 'deadlineReminder'}
        title="Remind me before the deadline"
        value={v.deadlineReminderOffsetMinutes}
        options={[{ value: null, label: 'No deadline reminder' }, ...DEADLINE_OFFSETS.map((m) => ({ value: m, label: describeOffset(m) }))]}
        onChange={(deadlineReminderOffsetMinutes) => set({ deadlineReminderOffsetMinutes })}
        onClose={() => setPicker(null)}
      />
    </KeyboardAvoidingView>
  );
}
