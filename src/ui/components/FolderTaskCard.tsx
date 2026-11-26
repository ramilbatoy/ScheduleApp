import { router } from 'expo-router';
import { Pressable } from 'react-native';

import type { DateKey } from '@/domain/models';
import { folderTargetStatus } from '@/domain/folderProgress';
import { folderFocusId, type TaskFolderGroup } from '@/domain/taskListFolders';
import { PRIORITY_LABEL } from '@/ui/components/AgendaRow';
import { FolderCardChrome } from '@/ui/components/FolderCardChrome';
import { spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { AppText, Card } from './primitives';

function openFolder(folderId: string, focus?: string | null) {
  router.push({
    pathname: '/folder/[id]',
    params: focus ? { id: folderId, focus } : { id: folderId },
  });
}

function targetLine(group: TaskFolderGroup, today: DateKey): { text: string; urgent: boolean } | null {
  const target = folderTargetStatus(group.folder.targetDate, today);
  if (!target.date || target.remainingDays === null) return null;
  if (target.overdue && group.percent < 100) {
    const n = Math.abs(target.remainingDays);
    return { text: `Target ${n} day${n === 1 ? '' : 's'} overdue`, urgent: true };
  }
  if (target.remainingDays === 0) return { text: 'Target today', urgent: true };
  if (target.approaching) return { text: `Target in ${target.remainingDays} day${target.remainingDays === 1 ? '' : 's'}`, urgent: false };
  return { text: `Target ${target.date}`, urgent: false };
}

/** One folder on the Tasks list. Counts are the filtered tasks inside the card, not the folder's stored progress. */
export function FolderTaskCard({
  group,
  today,
  testID,
  compact = false,
}: {
  group: TaskFolderGroup;
  today: DateKey;
  testID?: string;
  compact?: boolean;
}) {
  const p = useTheme();
  const due = targetLine(group, today);
  const focus = folderFocusId(group);
  const title = (a: (typeof group.matches)[number]) => a.occurrence.titleOverride ?? a.task.title;
  const summary = `${group.completed} completed · ${group.pending} pending · ${group.total} total`;
  return (
    <Card testID={testID} style={{ gap: compact ? spacing.xs : spacing.sm, minWidth: 0 }}>
      <FolderCardChrome
        name={group.folder.name}
        color={group.folder.color}
        icon={group.folder.icon}
        percent={group.percent}
        summary={summary}
        priorityLabel={PRIORITY_LABEL[group.folder.priority]}
        priorityColor={p.priority[group.folder.priority]}
        targetText={due?.text}
        targetUrgent={!!due?.urgent}
        compact={compact}
        titleLines={2}
        testID={testID}
        onPressHeader={() => openFolder(group.folder.id, focus)}
        headerAccessibilityLabel={`${group.folder.name}, ${group.completed} completed, ${group.pending} pending`}
        trailing={
          <AppText variant="label" color={group.folder.color} style={{ flexShrink: 0 }}>
            {group.percent}%
          </AppText>
        }
      />
      {group.matches.length > 0
        ? group.matches.map((a) => (
            <Pressable
              key={a.occurrence.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${title(a)} in ${group.folder.name}`}
              onPress={() => openFolder(group.folder.id, a.occurrence.id)}
              style={{ minHeight: compact ? 28 : 36, justifyContent: 'center', minWidth: 0 }}>
              <AppText color={p.primary} variant={compact ? 'caption' : undefined} numberOfLines={2}>
                {title(a)}
              </AppText>
            </Pressable>
          ))
        : null}
    </Card>
  );
}
