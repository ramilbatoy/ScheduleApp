import { useState, type ReactNode } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';

import { formatDateKey } from '@/domain/dates';
import { folderTargetStatus } from '@/domain/folderProgress';
import type { Agenda, DateKey, Folder } from '@/domain/models';
import type { DayFolderGroups, PlannerFolderGroup, RangeSummary, WeekFolderGroup, WeekFolderGroups } from '@/domain/plannerGroups';
import { useSettings } from '@/state/appStore';
import { useFolderGridColumns } from '@/ui/hooks/useFolderGridColumns';
import { folderGridCellStyle, folderGridWrapStyle } from '@/ui/layout/folderGrid';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { AgendaRow, PRIORITY_LABEL } from './AgendaRow';
import { FolderCardChrome } from './FolderCardChrome';
import { AppText, Card, Icon, SectionHeader } from './primitives';

export { weekFolderColumns, folderGridColumns } from '@/ui/layout/folderGrid';

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

/** Same chrome as the Folders list. Expand shows tasks and their subtasks. */
function FolderGroupCard({
  folder,
  today,
  rangeLabel,
  range,
  overall,
  testID,
  stretch = false,
  compact = false,
  children,
}: {
  folder: Folder;
  today: DateKey;
  rangeLabel: string;
  range: RangeSummary;
  overall: PlannerFolderGroup['overall'];
  testID: string;
  stretch?: boolean;
  compact?: boolean;
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
  const overallBit = overall ? ` · Overall ${overall.completed}/${overall.total}` : '';
  const summary = `${rangeLabel} ${range.completed}/${range.scheduled} completed · ${pct}%${pending}${overdue}${overallBit}`;

  return (
    <Card
      testID={testID}
      style={{
        gap: compact ? spacing.xs : spacing.sm,
        minWidth: 0,
        alignSelf: 'stretch',
        backgroundColor: folder.status === 'completed' ? (p.scheme === 'dark' ? '#3A414B' : '#E4E6EB') : p.surface,
        ...(stretch ? { flex: 1 } : null),
      }}>
      <FolderCardChrome
        name={folder.name}
        color={folder.color}
        icon={folder.icon}
        percent={pct}
        summary={summary}
        priorityLabel={PRIORITY_LABEL[folder.priority]}
        priorityColor={p.priority[folder.priority]}
        targetText={target}
        targetUrgent={!!target?.includes('overdue')}
        statusLabel={statusLabel}
        compact={compact}
        titleLines={2}
        testID={testID}
        onOpen={() => router.push({ pathname: '/folder/[id]', params: { id: folder.id } })}
        onPressHeader={toggle}
        headerAccessibilityLabel={`${open ? 'Collapse' : 'Expand'} ${folder.name}`}
        headerExpanded={open}
        trailing={
          <View style={{ width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Icon name={open ? 'chevron-up' : 'chevron-down'} color={p.textSecondary} size={compact ? 18 : 20} />
          </View>
        }
      />
      {open ? <View style={{ gap: compact ? spacing.xs : spacing.sm, minWidth: 0 }}>{children}</View> : null}
    </Card>
  );
}

function TaskList({
  items,
  testPrefix,
  showDate,
  compact,
}: {
  items: Agenda[];
  testPrefix: string;
  showDate?: (a: Agenda) => boolean;
  compact?: boolean;
}) {
  return (
    <View style={{ gap: compact ? spacing.xs : spacing.sm, minWidth: 0 }}>
      {items.map((a, i) => (
        <AgendaRow key={a.occurrence.id} a={a} showDate={showDate?.(a)} compact={compact} testID={`${testPrefix}-${i}`} />
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
  const { columns, onGridLayout, compact } = useFolderGridColumns(layout);
  if (!groups.folders.length && !groups.unassigned.length) return <AppText muted>{emptyText}</AppText>;
  const grid = layout === 'grid';
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View style={grid ? folderGridWrapStyle() : undefined} onLayout={grid ? onGridLayout : undefined}>
        {groups.folders.map((group) => (
          <View key={group.folder.id} style={grid ? folderGridCellStyle(columns) : undefined}>
            <FolderGroupCard
              folder={group.folder}
              today={today}
              rangeLabel={rangeLabel}
              range={group.range}
              overall={group.overall}
              compact={compact}
              testID={`${testID}-folder-${group.folder.id}`}>
              {group.tasks.length ? (
                <TaskList items={group.tasks} testPrefix={`${testID}-task-${group.folder.id}`} showDate={showTaskDate} compact={compact} />
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

function WeekFolderBody({
  group,
  today,
  testID,
  compact,
}: {
  group: WeekFolderGroup;
  today: DateKey;
  testID: string;
  compact?: boolean;
}) {
  const p = useTheme();
  if (!group.days.length) return <AppText muted>No matching tasks.</AppText>;
  return (
    <View style={{ gap: compact ? spacing.xs : spacing.sm, minWidth: 0 }}>
      {group.days.map((day) => (
        <View key={day.date} style={{ gap: compact ? spacing.xs : spacing.sm }} testID={`${testID}-day-${day.date}`}>
          <AppText variant="label" color={day.date === today ? p.primary : p.text} numberOfLines={1}>
            {formatDateKey(day.date, 'EEE')}
            {day.date === today ? ' · Today' : ''}
          </AppText>
          <TaskList
            items={day.tasks}
            testPrefix={`${testID}-${day.date}`}
            showDate={(a) => a.occurrence.date !== day.date}
            compact={compact}
          />
        </View>
      ))}
    </View>
  );
}

export function PlannerWeekGroups({
  groups,
  today,
  testID,
  layout = 'grid',
  /** Match Day: hide Unassigned label / empty copy / count; still list loose tasks. */
  hideUnassignedHeader = true,
}: {
  groups: WeekFolderGroups;
  today: DateKey;
  testID: string;
  layout?: 'grid' | 'list';
  hideUnassignedHeader?: boolean;
}) {
  const p = useTheme();
  const { columns, onGridLayout, compact } = useFolderGridColumns(layout);
  const grid = layout === 'grid';
  const looseCount = groups.unassignedByDay.reduce((n, d) => n + d.tasks.length, 0);
  if (!groups.folders.length && !looseCount) return <AppText muted>Nothing is currently listed here.</AppText>;
  const showUnassignedBlock = looseCount > 0 || !hideUnassignedHeader;
  return (
    <View style={{ gap: spacing.md }} testID={testID}>
      <View
        style={[folderGridWrapStyle(), { marginHorizontal: 0 }]}
        onLayout={grid ? onGridLayout : undefined}
        testID={`${testID}-grid`}>
        {groups.folders.map((group) => (
          <View
            key={group.folder.id}
            style={
              columns === 1
                ? { width: '100%', minWidth: 0, paddingBottom: spacing.sm }
                : {
                    ...folderGridCellStyle(columns, 4),
                    // Keep minWidth 0 so 2-col does not wrap under ~400px (old bug was minWidth 220).
                  }
            }>
            <FolderGroupCard
              folder={group.folder}
              today={today}
              rangeLabel="This week"
              range={group.range}
              overall={group.overall}
              stretch={grid && columns > 1}
              compact={compact}
              testID={`${testID}-folder-${group.folder.id}`}>
              <WeekFolderBody group={group} today={today} compact={compact} testID={`${testID}-folder-${group.folder.id}`} />
            </FolderGroupCard>
          </View>
        ))}
      </View>
      {showUnassignedBlock ? (
        <View style={{ gap: spacing.sm }} testID={`${testID}-unassigned`}>
          {hideUnassignedHeader ? null : <SectionHeader title="Unassigned" count={looseCount} />}
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
          ) : hideUnassignedHeader ? null : (
            <AppText muted>No unassigned tasks.</AppText>
          )}
        </View>
      ) : null}
    </View>
  );
}
