import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { router } from 'expo-router';

import { formatDateKey } from '@/domain/dates';
import { folderTargetStatus } from '@/domain/folderProgress';
import type { Agenda, DateKey, Folder } from '@/domain/models';
import type { DayFolderGroups, PlannerFolderGroup, RangeSummary, WeekFolderGroup, WeekFolderGroups } from '@/domain/plannerGroups';
import { useSettings } from '@/state/appStore';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { AgendaRow, PRIORITY_LABEL } from './AgendaRow';
import { AppText, Card, Icon, SectionHeader, type IconName } from './primitives';

function targetPhrase(folder: Folder, today: DateKey): string | null {
  const target = folderTargetStatus(folder.targetDate, today);
  if (!target.date || target.remainingDays === null) return null;
  if (target.overdue) {
    const n = Math.abs(target.remainingDays);
    return `Target ${n} day${n === 1 ? '' : 's'} overdue`;
  }
  if (target.remainingDays === 0) return 'Target today';
  if (target.approaching) return `Target in ${target.remainingDays} day${target.remainingDays === 1 ? '' : 's'}`;
  return null;
}

/** Same chrome as the Folders list: icon, counts, bar, priority and target. Expand shows tasks and their subtasks. */
function FolderGroupCard({
  folder,
  today,
  rangeLabel,
  range,
  overall,
  testID,
  /** Week grid cells need stretch height; Day/Month columns must size to content so the next card is not covered. */
  stretch = false,
  children,
}: {
  folder: Folder;
  today: DateKey;
  rangeLabel: string;
  range: RangeSummary;
  overall: PlannerFolderGroup['overall'];
  testID: string;
  stretch?: boolean;
  children: ReactNode;
}) {
  const p = useTheme();
  const collapseByDefault = useSettings().collapseFoldersByDefault;
  const [open, setOpen] = useState(!collapseByDefault);
  const target = targetPhrase(folder, today);
  const pct = range.scheduled > 0 ? Math.round((range.completed / range.scheduled) * 100) : (overall?.percent ?? 0);
  const toggle = () => setOpen((v) => !v);
  const statusLabel = folder.status === 'completed' ? 'Completed' : folder.status === 'archived' ? 'Archived' : null;
  const pending = range.pending ? ` · ${range.pending} pending` : '';
  const overdue = range.overdue ? ` · ${range.overdue} overdue` : '';
  return (
    <Card
      testID={testID}
      style={{
        gap: spacing.sm,
        minWidth: 0,
        alignSelf: 'stretch',
        backgroundColor: folder.status === 'completed' ? (p.scheme === 'dark' ? '#3A414B' : '#E4E6EB') : p.surface,
        ...(stretch ? { flex: 1 } : null),
      }}>
      <View style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Open folder details for ${folder.name}`}
            onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
            testID={`${testID}-open`}
            hitSlop={4}
            style={{ width: 40, height: 40, borderRadius: radius.md, backgroundColor: `${folder.color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={folder.icon as IconName} color={folder.color} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
            onPress={toggle}
            testID={`${testID}-toggle`}
            style={{ flex: 1, gap: 2 }}>
            <AppText variant="title" numberOfLines={1}>
              {folder.name}
            </AppText>
            <AppText variant="caption" muted testID={`${testID}-range`}>
              {rangeLabel} {range.completed}/{range.scheduled} completed · {pct}%{pending}{overdue}
            </AppText>
            {overall ? (
              <AppText variant="caption" color={p.primary} testID={`${testID}-overall`}>
                Overall {overall.completed}/{overall.total}
              </AppText>
            ) : null}
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ expanded: open }}
            accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
            onPress={toggle}
            hitSlop={8}
            style={{ width: 32, height: 32, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} color={p.textSecondary} />
          </Pressable>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name} summary`}
          onPress={toggle}
          testID={`${testID}-summary`}>
          <View style={{ height: 6, borderRadius: radius.sm, backgroundColor: p.surfaceVariant, overflow: 'hidden' }}>
            <View style={{ width: `${pct}%`, height: 6, backgroundColor: folder.color, borderRadius: radius.sm }} />
          </View>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          accessibilityState={{ expanded: open }}
          accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name} details`}
          onPress={toggle}>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
            <AppText variant="caption" color={p.priority[folder.priority]}>
              {PRIORITY_LABEL[folder.priority]}
            </AppText>
            {target ? (
              <AppText variant="caption" color={target.includes('overdue') ? p.overdue : p.textSecondary}>
                {target}
              </AppText>
            ) : (
              <AppText variant="caption" muted>
                No target
              </AppText>
            )}
            {statusLabel ? (
              <AppText variant="caption" muted>
                {statusLabel}
              </AppText>
            ) : null}
          </View>
        </Pressable>
      </View>
      {open ? <View style={{ gap: spacing.sm }}>{children}</View> : null}
    </Card>
  );
}

function TaskList({ items, testPrefix, showDate }: { items: Agenda[]; testPrefix: string; showDate?: (a: Agenda) => boolean }) {
  return (
    <View style={{ gap: spacing.sm }}>
      {items.map((a, i) => (
        <AgendaRow key={a.occurrence.id} a={a} showDate={showDate?.(a)} testID={`${testPrefix}-${i}`} />
      ))}
    </View>
  );
}

export function PlannerDayGroups({
  groups,
  today,
  rangeLabel,
  testID,
  emptyText,
  showTaskDate,
  /** Day tab: hide the Unassigned label + count; still list the tasks. */
  hideUnassignedHeader = false,
  layout = 'list',
}: {
  groups: DayFolderGroups;
  today: DateKey;
  rangeLabel: string;
  testID: string;
  emptyText: string;
  showTaskDate?: (a: Agenda) => boolean;
  hideUnassignedHeader?: boolean;
  layout?: 'grid' | 'list';
}) {
  if (!groups.folders.length && !groups.unassigned.length) return <AppText muted>{emptyText}</AppText>;
  const folderWrap = layout === 'grid' ? styles.dayGrid : undefined;
  const folderCell = layout === 'grid' ? styles.dayGridCell : undefined;
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View style={folderWrap}>
        {groups.folders.map((group) => (
          <View key={group.folder.id} style={folderCell}>
            <FolderGroupCard
              folder={group.folder}
              today={today}
              rangeLabel={rangeLabel}
              range={group.range}
              overall={group.overall}
              testID={`${testID}-folder-${group.folder.id}`}>
              {group.tasks.length ? (
                <TaskList items={group.tasks} testPrefix={`${testID}-task-${group.folder.id}`} showDate={showTaskDate} />
              ) : (
                <AppText muted>No matching tasks.</AppText>
              )}
            </FolderGroupCard>
          </View>
        ))}
      </View>
      {groups.unassigned.length || !hideUnassignedHeader ? (
        <View style={{ gap: spacing.sm }} testID={`${testID}-unassigned`}>
          {hideUnassignedHeader ? null : <SectionHeader title="Unassigned" count={groups.unassigned.length} />}
          {groups.unassigned.length ? (
            <TaskList items={groups.unassigned} testPrefix={`${testID}-loose`} showDate={showTaskDate} />
          ) : hideUnassignedHeader ? null : (
            <AppText muted>No unassigned tasks.</AppText>
          )}
        </View>
      ) : null}
    </View>
  );
}

function WeekFolderBody({ group, today, testID }: { group: WeekFolderGroup; today: DateKey; testID: string }) {
  const p = useTheme();
  if (!group.days.length) return <AppText muted>No matching tasks.</AppText>;
  return (
    <View style={{ gap: spacing.sm }}>
      {group.days.map((day) => (
        <View key={day.date} style={{ gap: spacing.sm }} testID={`${testID}-day-${day.date}`}>
          <AppText variant="label" color={day.date === today ? p.primary : p.text}>
            {formatDateKey(day.date, 'EEEE')}
            {day.date === today ? ' · Today' : ''}
          </AppText>
          <TaskList items={day.tasks} testPrefix={`${testID}-${day.date}`} showDate={(a) => a.occurrence.date !== day.date} />
        </View>
      ))}
    </View>
  );
}

/** 1 column on phones, 2 on tablets, 3 on wide web. */
export function weekFolderColumns(width: number): 1 | 2 | 3 {
  if (width >= 1100) return 3;
  if (width >= 700) return 2;
  return 1;
}

export function PlannerWeekGroups({
  groups,
  today,
  testID,
  layout = 'grid',
}: {
  groups: WeekFolderGroups;
  today: DateKey;
  testID: string;
  layout?: 'grid' | 'list';
}) {
  const p = useTheme();
  const columns = layout === 'list' ? 1 : 2;
  const looseCount = groups.unassignedByDay.reduce((n, d) => n + d.tasks.length, 0);
  if (!groups.folders.length && !looseCount) return <AppText muted>Nothing is currently listed here.</AppText>;
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View style={[styles.grid, { gap: spacing.md }]} testID={`${testID}-grid`}>
        {groups.folders.map((group) => (
          <View
            key={group.folder.id}
            style={{
              flexGrow: 1,
              flexBasis: columns === 1 ? '100%' : '47%',
              maxWidth: columns === 1 ? '100%' : '49%',
              minWidth: columns === 1 ? '100%' : 220,
            }}>
            <FolderGroupCard
              folder={group.folder}
              today={today}
              rangeLabel="This week"
              range={group.range}
              overall={group.overall}
              stretch={layout === 'grid'}
              testID={`${testID}-folder-${group.folder.id}`}>
              <WeekFolderBody group={group} today={today} testID={`${testID}-folder-${group.folder.id}`} />
            </FolderGroupCard>
          </View>
        ))}
      </View>
      <View style={{ gap: spacing.sm }} testID={`${testID}-unassigned`}>
        <SectionHeader title="Unassigned" count={looseCount} />
        {groups.unassignedByDay.length ? (
          groups.unassignedByDay.map((day) => (
            <View key={day.date} style={{ gap: spacing.sm }} testID={`${testID}-unassigned-${day.date}`}>
              <AppText variant="label" color={day.date === today ? p.primary : p.text}>
                {formatDateKey(day.date, 'EEEE')}
                {day.date === today ? ' · Today' : ''}
              </AppText>
              <TaskList items={day.tasks} testPrefix={`${testID}-loose-${day.date}`} showDate={(a) => a.occurrence.date !== day.date} />
            </View>
          ))
        ) : (
          <AppText muted>No unassigned tasks.</AppText>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'stretch' },
  dayGrid: { flexDirection: 'row', flexWrap: 'wrap', marginHorizontal: -6 },
  dayGridCell: { width: '50%', paddingHorizontal: 6, paddingBottom: 12 },
});
