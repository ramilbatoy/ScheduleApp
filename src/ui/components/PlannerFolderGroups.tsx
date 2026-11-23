import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
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

function SummaryLines({ rangeLabel, range, overall, testID }: { rangeLabel: string; range: RangeSummary; overall: PlannerFolderGroup['overall']; testID: string }) {
  const p = useTheme();
  const overdue = range.overdue ? ` · ${range.overdue} overdue` : '';
  return (
    <View style={{ gap: 2 }}>
      <AppText variant="caption" testID={`${testID}-range`}>
        {rangeLabel} {range.completed}/{range.scheduled}
      </AppText>
      <AppText variant="caption" muted>
        {range.scheduled} scheduled · {range.completed} done · {range.pending} pending
        {overdue}
      </AppText>
      {overall ? (
        <AppText variant="caption" color={p.primary} testID={`${testID}-overall`}>
          Overall {overall.completed}/{overall.total}
        </AppText>
      ) : null}
    </View>
  );
}

function FolderGroupCard({
  folder,
  today,
  rangeLabel,
  range,
  overall,
  testID,
  children,
}: {
  folder: Folder;
  today: DateKey;
  rangeLabel: string;
  range: RangeSummary;
  overall: PlannerFolderGroup['overall'];
  testID: string;
  children: ReactNode;
}) {
  const p = useTheme();
  const collapseByDefault = useSettings().collapseFoldersByDefault;
  const [open, setOpen] = useState(!collapseByDefault);
  const target = targetPhrase(folder, today);
  return (
    <Card testID={testID} style={{ gap: spacing.sm, flex: 1, minWidth: 0 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
        onPress={() => setOpen((v) => !v)}
        testID={`${testID}-toggle`}
        style={{ gap: spacing.sm }}>
        <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
          <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: `${folder.color}22`, alignItems: 'center', justifyContent: 'center' }}>
            <Icon name={folder.icon as IconName} color={folder.color} />
          </View>
          <View style={{ flex: 1, gap: 2 }}>
            <AppText variant="title" numberOfLines={1}>
              {folder.name}
            </AppText>
            <AppText variant="caption" color={target?.includes('overdue') ? p.overdue : p.priority[folder.priority]}>
              {PRIORITY_LABEL[folder.priority]}
              {target ? ` · ${target}` : ''}
            </AppText>
          </View>
          <Icon name={open ? 'chevron-up' : 'chevron-down'} color={p.textSecondary} />
        </View>
        <SummaryLines rangeLabel={rangeLabel} range={range} overall={overall} testID={testID} />
      </Pressable>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Open folder ${folder.name}`}
        onPress={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
        testID={`${testID}-open`}
        hitSlop={4}>
        <AppText variant="caption" color={p.primary}>
          Open folder details
        </AppText>
      </Pressable>
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
}: {
  groups: DayFolderGroups;
  today: DateKey;
  rangeLabel: string;
  testID: string;
  emptyText: string;
  showTaskDate?: (a: Agenda) => boolean;
}) {
  if (!groups.folders.length && !groups.unassigned.length) return <AppText muted>{emptyText}</AppText>;
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      {groups.folders.map((group) => (
        <FolderGroupCard
          key={group.folder.id}
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
      ))}
      <View style={{ gap: spacing.sm }} testID={`${testID}-unassigned`}>
        <SectionHeader title="Unassigned" count={groups.unassigned.length} />
        {groups.unassigned.length ? (
          <TaskList items={groups.unassigned} testPrefix={`${testID}-loose`} showDate={showTaskDate} />
        ) : (
          <AppText muted>No unassigned tasks.</AppText>
        )}
      </View>
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

export function PlannerWeekGroups({ groups, today, testID }: { groups: WeekFolderGroups; today: DateKey; testID: string }) {
  const p = useTheme();
  const { width } = useWindowDimensions();
  const columns = weekFolderColumns(width);
  const looseCount = groups.unassignedByDay.reduce((n, d) => n + d.tasks.length, 0);
  if (!groups.folders.length && !looseCount) return <AppText muted>No tasks this week.</AppText>;
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View style={[styles.grid, { gap: spacing.md }]} testID={`${testID}-grid`}>
        {groups.folders.map((group) => (
          <View
            key={group.folder.id}
            style={{
              flexGrow: 1,
              flexBasis: columns === 1 ? '100%' : columns === 2 ? '47%' : '30%',
              maxWidth: columns === 1 ? '100%' : columns === 2 ? '49%' : '32%',
              minWidth: columns === 1 ? '100%' : 220,
            }}>
            <FolderGroupCard
              folder={group.folder}
              today={today}
              rangeLabel="This week"
              range={group.range}
              overall={group.overall}
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
});
