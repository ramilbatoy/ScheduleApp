import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDateKey, formatTime, todayKey } from '@/domain/dates';
import type { Agenda } from '@/domain/models';
import { displayTitle, isOverdue } from '@/domain/services/agendaService';
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
  const deadlinePassed = !!a.task.deadlineAt && new Date(a.task.deadlineAt) < now && o.status === 'pending';
  return (
    <View style={styles.badges}>
      {showDate ? <Badge label={formatDateKey(o.date, 'MMM d')} color={p.textMuted} background={p.surfaceAlt} icon="calendar-outline" /> : null}
      {a.task.kind === 'task' && a.task.priority !== 'medium' ? (
        <Badge label={PRIORITY_LABEL[a.task.priority]} color={p.priority[a.task.priority]} background={`${p.priority[a.task.priority]}22`} icon="flag" />
      ) : null}
      {a.category ? <Badge label={a.category.name} color={a.category.color} background={`${a.category.color}22`} /> : null}
      {o.isCarriedForward && o.status === 'pending' ? (
        <Badge label={`Carried over${o.carryForwardCount > 1 ? ` ×${o.carryForwardCount}` : ''}`} color={p.warning} background={p.warningSoft} icon="return-down-forward" />
      ) : null}
      {overdue ? <Badge label={deadlinePassed ? 'Past deadline' : 'Overdue'} color={p.danger} background={p.dangerSoft} icon="alert-circle" /> : null}
      {a.rule ? <Badge label="Repeats" color={p.info} background={p.infoSoft} icon="repeat" /> : null}
      {a.task.deadlineAt && !deadlinePassed ? (
        <Badge label={`Due ${formatDeadline(a.task.deadlineAt)}`} color={p.textMuted} background={p.surfaceAlt} icon="hourglass-outline" />
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

  return (
    <View style={[styles.row, { backgroundColor: p.surface, borderColor: p.border }]}>
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
              color={done ? p.success : p.textMuted}
            />
          </Pressable>
          <Pressable
            testID={testID}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: o.id } })}
            accessibilityRole="button"
            accessibilityLabel={`${title}${done ? ', completed' : ''}`}
            style={({ pressed }) => [{ flex: 1, gap: 4, paddingVertical: spacing.md, paddingRight: spacing.md }, pressed && { opacity: 0.7 }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
              {a.task.kind === 'event' ? <Ionicons name="calendar" size={14} color={p.textMuted} /> : null}
              <AppText
                variant="heading"
                numberOfLines={2}
                style={[{ flex: 1 }, done && { textDecorationLine: 'line-through' }]}
                color={done ? p.textMuted : p.text}>
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
        {a.task.kind === 'task' && a.subtasks.length > 0 ? (
          <AgendaSubtasks nodes={a.subtasks} testID={testID ? `${testID}-subs` : undefined} />
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'stretch', borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
  accent: { width: 4 },
  check: { width: TOUCH, alignItems: 'center', justifyContent: 'center' },
  badges: { flexDirection: 'row', flexWrap: 'wrap', gap: 4 },
});
