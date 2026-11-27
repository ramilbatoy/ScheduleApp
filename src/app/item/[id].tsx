import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useRef, useState, type ComponentRef } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { formatAssignedOrDate, formatDeadline, formatTime, todayKey } from '@/domain/dates';
import type { HistoryEntry } from '@/domain/models';
import { describeRule } from '@/domain/recurrence';
import { agendaPriority, displayTitle, formatOverdueDetail, overdueTimeline } from '@/domain/services/agendaService';
import { describeOffset } from '@/domain/services/reminderService';
import type { EditScope } from '@/domain/services/taskService';
import { useServices } from '@/state/appStore';
import { ItemBadges, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FooterTabBar } from '@/ui/components/FooterTabBar';
import { ReadyScreen } from '@/ui/components/ReadyScreen';
import { choose, confirm } from '@/ui/components/dialogs';
import { DatePickerModal, OptionsModal } from '@/ui/components/Pickers';
import { AppText, Button, Card, Divider, EmptyState, Icon, IconButton, LoadingState, type IconName } from '@/ui/components/primitives';
import { SubtaskEditor } from '@/ui/components/SubtaskList';
import { useAction, useQuery, useTheme } from '@/ui/hooks';
import { goBackOrDashboard, useSafeAndroidBack } from '@/ui/navigation';
import { spacing } from '@/ui/theme';

const HISTORY_LABEL: Record<HistoryEntry['eventType'], string> = {
  created: 'Created',
  completed: 'Completed',
  reopened: 'Reopened',
  carried_forward: 'Carried forward',
  deleted: 'Deleted',
  date_changed: 'Rescheduled',
  missed: 'Missed (a newer instance replaced it)',
  restored: 'Restored',
};

type DetailAction = 'toggle' | 'edit' | 'reschedule' | 'move-today' | 'delete' | 'open-folder';

function InfoRow({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const p = useTheme();
  return (
    <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'flex-start', paddingVertical: 6 }}>
      <Icon name={icon} size={18} color={p.textSecondary} />
      <AppText muted style={{ width: 96 }}>
        {label}
      </AppText>
      <AppText style={{ flex: 1 }}>{value}</AppText>
    </View>
  );
}

export default function ItemDetailScreen() {
  return (
    <ReadyScreen testID="detail-boot">
      <ItemDetailBody />
    </ReadyScreen>
  );
}

function ItemDetailBody() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const services = useServices();
  const run = useAction();
  const [reschedule, setReschedule] = useState(false);
  const [actionsOpen, setActionsOpen] = useState(false);
  const scrollRef = useRef<ComponentRef<typeof ScrollView>>(null);
  const insets = useSafeAreaInsets();
  useSafeAndroidBack();
  const detail = useQuery((s) => s.tasks.getDetail(id), [id]);
  const reminders = useQuery((s) => (detail.data ? s.reminders.forTask(detail.data.task.id) : Promise.resolve([])), [detail.data?.task.id]);
  const today = todayKey(services.clock);
  const now = services.clock.now();

  if (detail.error) {
    return (
      <>
        <Stack.Screen options={{ title: 'Details' }} />
        <EmptyState icon="trash-outline" title="Not available" message={detail.error} action={<Button label="Go back" tone="secondary" onPress={goBackOrDashboard} />} />
        <FooterTabBar />
      </>
    );
  }
  if (!detail.data) {
    return (
      <>
        <LoadingState />
        <FooterTabBar />
      </>
    );
  }
  const d = detail.data;
  const o = d.occurrence;
  const recurring = !!d.rule;
  const pending = o.status === 'pending';
  const notes = o.notesOverride ?? d.task.notes;
  const overdueDetail = (() => {
    const timeline = overdueTimeline(d, today, now);
    return timeline ? formatOverdueDetail(timeline) : null;
  })();

  async function askScope(action: 'edit' | 'delete'): Promise<EditScope | null> {
    if (!recurring) return 'series';
    return choose<EditScope>(
      action === 'edit' ? 'Edit recurring item' : 'Delete recurring item',
      action === 'edit' ? 'Which occurrences do you want to change?' : 'Completed occurrences are kept in your history either way.',
      [
        { label: 'This occurrence only', value: 'occurrence', tone: 'secondary' },
        { label: 'This and following', value: 'future', tone: 'secondary' },
        { label: 'Entire series', value: 'series', tone: action === 'delete' ? 'danger' : 'primary' },
      ],
    );
  }

  async function onEdit() {
    const scope = await askScope('edit');
    if (scope) router.push({ pathname: '/item/edit', params: { id: o.id, scope } });
  }

  async function onDelete() {
    const scope = await askScope('delete');
    if (!scope) return;
    if (!recurring && !(await confirm('Delete this item?', `"${displayTitle(d)}" will be removed. Completed history is kept.`, 'Delete', true))) return;
    const ok = await run((s) => s.tasks.delete(o.id, scope).then(() => true), 'Deleted');
    if (ok) goBackOrDashboard();
  }

  async function onAction(action: DetailAction) {
    setActionsOpen(false);
    switch (action) {
      case 'toggle':
        await run((s) => s.tasks.toggleComplete(o.id), o.status === 'completed' ? 'Reopened' : 'Completed');
        return;
      case 'edit':
        await onEdit();
        return;
      case 'reschedule':
        setReschedule(true);
        return;
      case 'move-today':
        await run((s) => s.tasks.moveToToday([o.id]), 'Moved to today');
        return;
      case 'delete':
        await onDelete();
        return;
      case 'open-folder':
        if (d.folder) router.push({ pathname: '/folder/[id]', params: { id: d.folder.id } });
        return;
    }
  }

  const actionOptions: { value: DetailAction; label: string }[] = [
    { value: 'toggle', label: o.status === 'completed' ? 'Mark not completed' : 'Mark completed' },
    { value: 'edit', label: 'Edit' },
    ...(pending ? [{ value: 'reschedule' as const, label: 'Reschedule' }] : []),
    ...(pending && o.date < today ? [{ value: 'move-today' as const, label: 'Move to today' }] : []),
    { value: 'delete', label: 'Delete' },
    ...(d.folder ? [{ value: 'open-folder' as const, label: 'Open folder' }] : []),
  ];

  return (
    <>
      <Stack.Screen options={{ title: d.task.kind === 'event' ? 'Event' : 'Task' }} />
      <KeyboardAvoidingView
        style={{ flex: 1, backgroundColor: p.background }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? insets.top + 56 : 0}>
        <ScrollView
          ref={scrollRef}
          style={{ backgroundColor: p.background }}
          keyboardShouldPersistTaps="handled"
          automaticallyAdjustKeyboardInsets
          contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 40 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.sm }}>
            <View style={{ flex: 1, gap: spacing.sm, minWidth: 0 }}>
              <AppText variant="title" testID="detail-title" style={o.status === 'completed' ? { textDecorationLine: 'line-through' } : undefined}>
                {displayTitle(d)}
              </AppText>
              <ItemBadges a={d} />
            </View>
            <IconButton
              testID="detail-actions"
              icon="ellipsis-horizontal"
              label="Actions"
              onPress={() => setActionsOpen(true)}
            />
          </View>

          <Card>
            <InfoRow
              icon="calendar-outline"
              label={d.task.kind === 'event' ? 'Date' : 'Assigned'}
              value={formatAssignedOrDate(o.date, o.startTime, d.task.allDay)}
            />
            {overdueDetail ? <InfoRow icon="play-outline" label="Started" value={overdueDetail.started} /> : null}
            {overdueDetail ? <InfoRow icon="alert-circle-outline" label="Overdue" value={overdueDetail.overdue} /> : null}
            <InfoRow
              icon="time-outline"
              label="Time"
              value={d.task.allDay ? 'All day' : o.startTime ? `${formatTime(o.startTime)}${o.endTime ? ` – ${formatTime(o.endTime)}` : ''}` : 'Anytime'}
            />
            {d.task.deadlineAt ? <InfoRow icon="hourglass-outline" label="Deadline" value={formatDeadline(d.task.deadlineAt)} /> : null}
            {d.task.kind === 'task' ? (
              <InfoRow
                icon="flag-outline"
                label="Priority"
                value={
                  d.task.priorityExplicit === false && d.folder
                    ? `${PRIORITY_LABEL[agendaPriority(d)]} (inherited from ${d.folder.name})`
                    : PRIORITY_LABEL[agendaPriority(d)]
                }
              />
            ) : null}
            <InfoRow icon="folder-outline" label="Folder" value={d.folder?.name ?? 'None'} />
            <InfoRow icon="pricetag-outline" label="Category" value={d.category?.name ?? 'None'} />
            {d.rule ? <InfoRow icon="repeat" label="Repeats" value={describeRule(d.rule)} /> : null}
            {o.carryForwardCount > 0 ? (
              <InfoRow
                icon="return-down-forward"
                label="Carried"
                value={`${o.carryForwardCount} day${o.carryForwardCount === 1 ? '' : 's'} (originally ${formatAssignedOrDate(o.originalDate ?? o.date, null, true)})`}
              />
            ) : null}
            {d.task.reminderOffsetMinutes !== null ? <InfoRow icon="notifications-outline" label="Reminder" value={describeOffset(d.task.reminderOffsetMinutes)} /> : null}
            {d.task.deadlineReminderOffsetMinutes !== null ? (
              <InfoRow icon="alarm-outline" label="Deadline alert" value={describeOffset(d.task.deadlineReminderOffsetMinutes)} />
            ) : null}
            <InfoRow icon="create-outline" label="Created" value={new Date(d.task.createdAt).toLocaleString()} />
            {o.completedAt ? <InfoRow icon="checkmark-done-outline" label="Completed" value={new Date(o.completedAt).toLocaleString()} /> : null}
          </Card>

          {notes ? (
            <Card>
              <AppText variant="label" muted>
                NOTES
              </AppText>
              <AppText>{notes}</AppText>
            </Card>
          ) : null}

          {d.task.kind === 'task' ? <SubtaskEditor occurrenceId={o.id} nodes={d.subtasks} testID="detail-subtasks" scrollRef={scrollRef} /> : null}

          {reminders.data && reminders.data.length > 0 ? (
            <Card>
              <AppText variant="label" muted>
                UPCOMING REMINDERS
              </AppText>
              {reminders.data.slice(0, 5).map((r) => (
                <AppText key={r.id} muted={!r.notificationId}>
                  {new Date(r.triggerAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}
                  {r.kind === 'deadline' ? ' · deadline' : ''}
                  {r.notificationId ? '' : ' · not scheduled (notifications off)'}
                </AppText>
              ))}
            </Card>
          ) : null}

          <Card>
            <AppText variant="label" muted>
              HISTORY
            </AppText>
            {d.history.map((h, i) => (
              <View key={h.id}>
                {i > 0 ? <Divider /> : null}
                <View style={{ paddingVertical: 6 }}>
                  <AppText>
                    {HISTORY_LABEL[h.eventType]}
                    {h.fromDate && h.toDate
                      ? ` · ${formatAssignedOrDate(h.fromDate, null, true)} → ${formatAssignedOrDate(h.toDate, null, true)}`
                      : h.toDate
                        ? ` · ${formatAssignedOrDate(h.toDate, null, true)}`
                        : ''}
                  </AppText>
                  <AppText variant="caption" muted>
                    {new Date(h.createdAt).toLocaleString()}
                  </AppText>
                </View>
              </View>
            ))}
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
      <FooterTabBar />
      <OptionsModal<DetailAction>
        visible={actionsOpen}
        title="Actions"
        value={'edit'}
        options={actionOptions}
        onChange={(action) => {
          void onAction(action);
        }}
        onClose={() => setActionsOpen(false)}
      />
      <DatePickerModal
        visible={reschedule}
        value={o.date}
        today={today}
        title="Reschedule to"
        onChange={(date) => run((s) => s.tasks.changeDate(o.id, date), 'Rescheduled')}
        onClose={() => setReschedule(false)}
      />
    </>
  );
}
