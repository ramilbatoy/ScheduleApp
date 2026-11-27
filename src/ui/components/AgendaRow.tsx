import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { formatDateKey, formatDeadline, formatTime, todayKey } from '@/domain/dates';
import type { Agenda } from '@/domain/models';
import { agendaPriority, displayTitle, formatOverdueLabels, isOverdue, overdueTimeline } from '@/domain/services/agendaService';
import { useAppStore } from '@/state/appStore';

import { useAction, useTheme } from '../hooks';
import { radius, spacing, TOUCH } from '../theme';
import { AppText, Badge, Icon } from './primitives';
import { AgendaSubtasks, SubtaskProgressBadge } from './SubtaskList';

export const PRIORITY_LABEL = { low: 'Low', medium: 'Medium', high: 'High', urgent: 'Urgent' } as const;

export function ItemBadges({
  a,
  showDate,
  hideFolder,
  /** Compact nested rows: keep urgency/priority; drop lower-priority chrome. */
  compact = false,
}: {
  a: Agenda;
  showDate?: boolean;
  /** Nested under a folder card — folder chip is redundant and eats width. */
  hideFolder?: boolean;
  compact?: boolean;
}) {
  const p = useTheme();
  const services = useAppStore((s) => s.services);
  const today = services ? todayKey(services.clock) : '';
  const now = services ? services.clock.now() : new Date();
  const o = a.occurrence;
  const overdue = isOverdue(a, today, now);
  const priority = agendaPriority(a);
  const inherited = a.task.priorityExplicit === false && !!a.folder;
  const timeline = overdue ? overdueTimeline(a, today, now) : null;
  const overdueLabels = timeline ? formatOverdueLabels(timeline, today) : null;
  const deadlinePassed = !!a.task.deadlineAt && new Date(a.task.deadlineAt) < now && o.status === 'pending';
  return (
    <View style={styles.badges}>
      {showDate ? <Badge label={formatDateKey(o.date, 'MMM d')} color={p.textSecondary} background={p.surfaceVariant} icon="calendar-outline" /> : null}
      {a.task.kind === 'task' && (priority !== 'medium' || inherited) ? (
        <Badge
          label={inherited && !compact ? `${PRIORITY_LABEL[priority]} · folder` : PRIORITY_LABEL[priority]}
          color={p.priority[priority]}
          background={`${p.priority[priority]}22`}
          icon="flag"
        />
      ) : null}
      {a.folder && !hideFolder ? (
        <Pressable
          testID={`folder-chip-${a.folder.id}`}
          accessibilityRole="button"
          accessibilityLabel={`Open folder ${a.folder.name}`}
          onPress={(e) => {
            // Chip is a real <button>. Stop the row press so web does not open the task too.
            e.stopPropagation();
            router.push({ pathname: '/folder/[id]', params: { id: a.folder!.id } });
          }}>
          <Badge label={a.folder.name} color={a.folder.color} background={`${a.folder.color}22`} icon="folder-outline" />
        </Pressable>
      ) : null}
      {!compact && a.category ? <Badge label={a.category.name} color={a.category.color} background={`${a.category.color}22`} /> : null}
      {o.isCarriedForward && o.status === 'pending' ? (
        <Badge
          label={compact ? 'Carried' : `Carried over${o.carryForwardCount > 1 ? ` ×${o.carryForwardCount}` : ''}`}
          color={p.warning}
          background={p.warningSoft}
          icon="return-down-forward"
        />
      ) : null}
      {overdueLabels ? (
        <View testID={`overdue-timeline-${o.id}`} style={styles.badges}>
          {!compact ? <Badge label={overdueLabels.started} color={p.textSecondary} background={p.surfaceVariant} icon="play-outline" /> : null}
          <Badge label={overdueLabels.overdue} color={p.overdue} background={p.errorSoft} icon="alert-circle" />
        </View>
      ) : overdue ? (
        <Badge label={deadlinePassed ? 'Past deadline' : 'Overdue'} color={p.overdue} background={p.errorSoft} icon="alert-circle" />
      ) : null}
      {!compact && a.rule ? <Badge label="Repeats" color={p.info} background={p.infoSoft} icon="repeat" /> : null}
      {!compact && a.task.deadlineAt && !deadlinePassed ? (
        <Badge label={`Due ${formatDeadline(a.task.deadlineAt)}`} color={p.textSecondary} background={p.surfaceVariant} icon="hourglass-outline" />
      ) : null}
    </View>
  );
}

/** One occurrence: tap the circle to complete/reopen, tap the row to open details. */
export function AgendaRow({
  a,
  showDate,
  testID,
  /** Narrow folder grid cells (~400px / 2-col): tighter chrome, hide folder chip. */
  compact = false,
  /** When true (folder detail), nested subtasks start collapsed. */
  collapseSubtasksByDefault = false,
}: {
  a: Agenda;
  showDate?: boolean;
  testID?: string;
  compact?: boolean;
  collapseSubtasksByDefault?: boolean;
}) {
  const p = useTheme();
  const run = useAction();
  const o = a.occurrence;
  const done = o.status === 'completed';
  const title = displayTitle(a);
  const time = o.startTime ? `${formatTime(o.startTime)}${o.endTime ? ` – ${formatTime(o.endTime)}` : ''}` : a.task.allDay ? 'All day' : null;
  const accent = a.task.kind === 'event' ? (a.category?.color ?? p.primary) : p.priority[agendaPriority(a)];
  const hasSubtasks = a.task.kind === 'task' && a.subtasks.length > 0;
  const [subsOpen, setSubsOpen] = useState(!collapseSubtasksByDefault);
  const checkW = compact ? 36 : TOUCH;

  return (
    <View
      style={[
        styles.row,
        styles.mainTask,
        {
          backgroundColor: p.surface,
          borderColor: hasSubtasks ? accent : p.border,
          borderLeftColor: accent,
          minWidth: 0,
        },
      ]}
      testID={testID ? `${testID}-main` : undefined}
      accessibilityHint={hasSubtasks ? 'Main task with nested subtasks' : undefined}>
      <View style={[styles.accent, { backgroundColor: accent, width: compact ? 3 : 4 }]} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>
          <Pressable
            testID={testID ? `${testID}-toggle` : undefined}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: done }}
            accessibilityLabel={done ? `Mark ${title} not completed` : `Mark ${title} completed`}
            hitSlop={8}
            onPress={() => run((s) => s.tasks.toggleComplete(o.id), done ? 'Marked as not completed' : 'Completed')}
            style={{ width: checkW, alignItems: 'center', justifyContent: 'center' }}>
            <Ionicons
              name={done ? 'checkmark-circle' : a.task.kind === 'event' ? 'ellipse-outline' : 'radio-button-off'}
              size={compact ? 22 : 26}
              color={done ? p.success : p.textSecondary}
            />
          </Pressable>
          <Pressable
            testID={testID}
            onPress={() => router.push({ pathname: '/item/[id]', params: { id: o.id } })}
            // A folder chip inside this row is its own <button>. Omit the button role then so
            // RN-web renders a <div> (still pressable) instead of nesting buttons.
            accessibilityRole={a.folder && !compact ? undefined : 'button'}
            accessibilityLabel={`${title}${done ? ', completed' : ''}`}
            style={({ pressed }) => [
              {
                flex: 1,
                minWidth: 0,
                gap: compact ? 2 : 4,
                paddingVertical: compact ? spacing.sm : spacing.md,
                paddingRight: compact ? spacing.sm : spacing.md,
              },
              pressed && { opacity: 0.7 },
            ]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minWidth: 0 }}>
              {a.task.kind === 'event' ? <Ionicons name="calendar" size={14} color={p.textSecondary} /> : null}
              <AppText
                variant={compact ? 'label' : 'heading'}
                numberOfLines={2}
                style={[{ flex: 1, minWidth: 0 }, done && { textDecorationLine: 'line-through' }]}
                color={done ? p.textSecondary : p.text}>
                {title}
              </AppText>
            </View>
            {time ? (
              <AppText variant="caption" muted numberOfLines={1}>
                {time}
              </AppText>
            ) : null}
            {!compact ? <SubtaskProgressBadge nodes={a.subtasks} /> : null}
            <ItemBadges a={a} showDate={showDate} hideFolder={compact} compact={compact} />
          </Pressable>
          {hasSubtasks && collapseSubtasksByDefault ? (
            <Pressable
              testID={testID ? `${testID}-subs-toggle` : undefined}
              accessibilityRole="button"
              accessibilityState={{ expanded: subsOpen }}
              accessibilityLabel={subsOpen ? 'Collapse subtasks' : 'Expand subtasks'}
              onPress={() => setSubsOpen((v) => !v)}
              hitSlop={6}
              style={{
                width: 36,
                alignItems: 'center',
                justifyContent: 'center',
                paddingTop: compact ? spacing.sm : spacing.md,
              }}>
              <Icon name={subsOpen ? 'chevron-up' : 'chevron-down'} size={18} color={p.primary} />
            </Pressable>
          ) : null}
        </View>
        {hasSubtasks && subsOpen ? (
          <View
            style={[
              styles.subtaskRail,
              {
                borderLeftColor: accent,
                backgroundColor: p.surfaceVariant,
                marginLeft: checkW,
                marginRight: compact ? spacing.sm : spacing.md,
                overflow: 'hidden',
              },
            ]}>
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
