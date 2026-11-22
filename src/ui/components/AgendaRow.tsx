import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDateKey, formatTime, todayKey } from '@/domain/dates';
import type { Agenda } from '@/domain/models';
import { displayTitle, formatOverdueLabels, isOverdue, overdueTimeline } from '@/domain/services/agendaService';
import { useAppStore } from '@/state/appStore';

import { useAction, useTheme } from '../hooks';
import { radius, spacing, TOUCH } from '../theme';
import { AppText, Badge } from './primitives';
import { AgendaSubtasks, SubtaskProgressBadge } from './SubtaskList';

export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' } as const;

export function formatDeadline(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString([], { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export function ItemBadges({ a, showDate }: { a: Agenda; showDate?: boolean }) {
  const p = useTheme();
  const services = useAppStore((s) => s.services);
  const today = services ? todayKey(services.clock) : '';
  const now = services ? services.clock.now() : new Date();
  const o = a.occurrence;
  const overdue = isOverdue(a, today, now);
  const timeline = overdue ? overdueTimeline(a, today, now) : null;
  const overdueLabels = timeline ? formatOverdueLabels(timeline, today) : null;
  const deadlinePassed = !!a.task.deadlineAt && new Date(a.task.deadlineAt) < now && o.status === 'pending';
  return (
    <View style={styles.badges}>
      {showDate ? <Badge label={formatDateKey(o.date, 'MMM d')} color={p.textSecondary} background={p.surfaceVariant} icon="calendar-outline" /> : null}
      {a.task.kind === 'task' && a.task.priority !== 'medium' ? (
        <Badge label={PRIORITY_LABEL[a.task.priority]} color={p.priority[a.task.priority]} background={`${p.priority[a.task.priority]}22`} icon="flag" />
      ) : null}
      {a.category ? <Badge label={a.category.name} color={a.category.color} background={`${a.category.color}22`} /> : null}
      {o.isCarriedForward && o.status === 'pending' ? (
        <Badge label={`Carried over${o.carryForwardCount > 1 ? ` ×${o.carryForwardCount}` : ''}`} color={p.warning} background={p.warningSoft} icon="return-down-forward" />
      ) : null}
      {overdueLabels ? (
        <View testID={`overdue-timeline-${o.id}`} style={styles.badges}>
          <Badge label={overdueLabels.started} color={p.textSecondary} background={p.surfaceVariant} icon="play-outline" />
          <Badge label={overdueLabels.overdue} color={p.overdue} background={p.errorSoft} icon="alert-circle" />
        </View>
      ) : overdue ? (
        <Badge label={deadlinePassed ? 'Past deadline' : 'Overdue'} color={p.overdue} background={p.errorSoft} icon="alert-circle" />
      ) : null}
      {a.rule ? <Badge label="Repeats" color={p.info} background={p.infoSoft} icon="repeat" /> : null}
      {a.task.deadlineAt && !deadlinePassed ? (
        <Badge label={`Due ${formatDeadline(a.task.deadlineAt)}`} color={p.textSecondary} background={p.surfaceVariant} icon="hourglass-outline" />
      ) : null}
    </View>
  );
}

/** One occurrence: tap the circle to complete/reopen, tap the row to open details. */
export function AgendaRow({ a, showDate, testID }: { a: Agenda; showDate?: boolean; testID?: string }) {
  const p = useTheme();
  const run = useAction();
  const o = a.occurrence;
  const done = o.status === 'completed';
  const title = displayTitle(a);
  const time = o.startTime ? `${formatTime(o.startTime)}${o.endTime ? ` – ${formatTime(o.endTime)}` : ''}` : a.task.allDay ? 'All day' : null;
  const accent = a.task.kind === 'event' ? (a.category?.color ?? p.primary) : p.priority[a.task.priority];
  const hasSubtasks = a.task.kind === 'task' && a.subtasks.length > 0;

  return (
    <View
      style={[
        styles.row,
        styles.mainTask,
        {
          backgroundColor: p.surface,
          borderColor: hasSubtasks ? accent : p.border,
          borderLeftColor: accent,
        },
      ]}
      testID={testID ? `${testID}-main` : undefined}
      accessibilityHint={hasSubtasks ? 'Main task with nested subtasks' : undefined}>
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `Mark ${title} not done` : `Mark ${title} done`}
            hitSlop={8}
            onPress={() => run((s) => s.tasks.toggleComplete(o.id), done ? 'Marked as not done' : 'Completed')}
            style={styles.check}>
            <Ionicons
              name={done ? 'checkmark-circle' : a.task.kind === 'event' ? 'ellipse-outline' : 'radio-button-off'}
              size={26}
              color={done ? p.success : p.textSecondary}
            />
          </Pressable>
          <Pressable
            testID={testID}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: o.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${title}${done ? ', completed' : ''}`}
            style={({ pressed }) => [{ flex: 1, gap: 4, paddingVertical: spacing.md, paddingRight: spacing.md }, pressed && { opacity: 0.7 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {a.task.kind === 'event' ? <Ionicons name="calendar" size={14} color={p.textSecondary} /> : null}
              <AppText
                variant="heading"
                numberOfLines={2}
                style={[{ flex: 1 }, done && { textDecorationLine: 'line-through' }]}
                color={done ? p.textSecondary : p.text}>
                {title}
              </AppText>
            </View>
            {time ? (
              <AppText variant="caption" muted>
                {time}
              </AppText>
            ) : null}
            <SubtaskProgressBadge nodes={a.subtasks} />
            <ItemBadges a={a} showDate={showDate} />
          </Pressable>
        </View>
        {hasSubtasks ? (
          <View style={[styles.subtaskRail, { borderLeftColor: accent, backgroundColor: p.surfaceVariant }]}>
            <AgendaSubtasks nodes={a.subtasks} testID={testID ? `${testID}-subs` : undefined} />
          </View>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  /** Main tasks: thicker left edge so hierarchy reads before nested subtasks. */
  mainTask: { borderLeftWidth: 3 },
  accent: { width: 4 },
  check: { width: TOUCH, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
  subtaskRail: {
    marginLeft: TOUCH,
    marginRight: spacing.md,
    marginBottom: spacing.sm,
    paddingTop: spacing.xs,
    borderLeftWidth: 2,
    borderRadius: radius.sm,
  },
});
