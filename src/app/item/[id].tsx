import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ScrollView, View } from 'react-native';

import { formatDateKey, formatTime, todayKey } from '@/domain/dates';
import type { HistoryEntry } from '@/domain/models';
import { describeRule } from '@/domain/recurrence';
import { agendaPriority, displayTitle, formatOverdueDetail, overdueTimeline } from '@/domain/services/agendaService';
import { describeOffset } from '@/domain/services/reminderService';
import type { EditScope } from '@/domain/services/taskService';
import { useServices } from '@/state/appStore';
import { formatDeadline, ItemBadges, PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { choose, confirm } from '@/ui/components/dialogs';
import { DatePickerModal } from '@/ui/components/Pickers';
import { AppText, Button, Card, Divider, EmptyState, Icon, LoadingState, type IconName } from '@/ui/components/primitives';
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
  const { id } = useLocalSearchParams<{ id: string }>();
  const p = useTheme();
  const services = useServices();
  const run = useAction();
  const [reschedule, setReschedule] = useState(false);
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
      </>
    );
  }
  if (!detail.data) return <LoadingState />;
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

  return (
    <>
      <Stack.Screen options={{ title: d.task.kind === 'event' ? 'Event' : 'Task' }} />
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.lg, paddingBottom: 80 }}>
        <View style={{ gap: spacing.sm }}>
          <AppText variant="title" testID="detail-title" style={o.status === 'completed' ? { textDecorationLine: 'line-through' } : undefined}>
            {displayTitle(d)}
          </AppText>
          <ItemBadges a={d} />
        </View>

        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          <Button
            testID="detail-toggle-complete"
            label={o.status === 'completed' ? 'Mark not completed' : 'Mark completed'}
            icon={o.status === 'completed' ? 'arrow-undo' : 'checkmark'}
            tone={o.status === 'completed' ? 'secondary' : 'primary'}
            onPress={() => run((s) => s.tasks.toggleComplete(o.id), o.status === 'completed' ? 'Reopened' : 'Completed')}
            style={{ flex: 1 }}
          />
          <Button testID="detail-edit" label="Edit" icon="create-outline" tone="secondary" onPress={onEdit} style={{ flex: 1 }} />
        </View>
        <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
          {pending ? <Button testID="detail-reschedule" label="Reschedule" icon="calendar-outline" tone="secondary" compact onPress={() => setReschedule(true)} /> : null}
          {pending && o.date < today ? (
            <Button testID="detail-move-today" label="Move to today" icon="return-down-forward" tone="secondary" compact onPress={() => run((s) => s.tasks.moveToToday([o.id]), 'Moved to today')} />
          ) : null}
          <Button testID="detail-delete" label="Delete" icon="trash-outline" tone="ghost" compact onPress={onDelete} />
          {d.folder ? (
            <Button
              testID="detail-open-folder"
              label="Open folder"
              icon="folder-outline"
              tone="secondary"
              compact
              onPress={() => router.push({ pathname: '/folder/[id]', params: { id: d.folder!.id } })}
            />
          ) : null}
        </View>

        <Card>
          <InfoRow icon="calendar-outline" label={d.task.kind === 'event' ? 'Date' : 'Assigned'} value={formatDateKey(o.date, 'EEEE, MMM d, yyyy')} />
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
            <InfoRow icon="return-down-forward" label="Carried" value={`${o.carryForwardCount} day${o.carryForwardCount === 1 ? '' : 's'} (originally ${formatDateKey(o.originalDate ?? o.date, 'MMM d')})`} />
          ) : null}
          {d.task.reminderOffsetMinutes !== null ? <InfoRow icon="notifications-outline" label="Reminder" value={describeOffset(d.task.reminderOffsetMinutes)} /> : null}
          {d.task.deadlineReminderOffsetMinutes !== null ? <InfoRow icon="alarm-outline" label="Deadline alert" value={describeOffset(d.task.deadlineReminderOffsetMinutes)} /> : null}
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

        {d.task.kind === 'task' ? <SubtaskEditor occurrenceId={o.id} nodes={d.subtasks} testID="detail-subtasks" /> : null}

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
                  {h.fromDate && h.toDate ? ` · ${formatDateKey(h.fromDate, 'MMM d')} → ${formatDateKey(h.toDate, 'MMM d')}` : h.toDate ? ` · ${formatDateKey(h.toDate, 'MMM d')}` : ''}
                </AppText>
                <AppText variant="caption" muted>
                  {new Date(h.createdAt).toLocaleString()}
                </AppText>
              </View>
            </View>
          ))}
        </Card>
      </ScrollView>
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
