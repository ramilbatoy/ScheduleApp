import { router } from 'expo-router';
import { Pressable, View } from 'react-native';

import type { DateKey } from '@/domain/models';
import { folderTargetStatus } from '@/domain/folderProgress';
import { folderFocusId, type TaskFolderGroup } from '@/domain/taskListFolders';
import { radius, spacing } from '@/ui/theme';
import { useTheme } from '@/ui/hooks';

import { AppText, Card, Icon, type IconName } from './primitives';

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
export function FolderTaskCard({ group, today, testID }: { group: TaskFolderGroup; today: DateKey; testID?: string }) {
  const p = useTheme();
  const due = targetLine(group, today);
  const focus = folderFocusId(group);
  const title = (a: (typeof group.matches)[number]) => a.occurrence.titleOverride ?? a.task.title;
  return (
    <Card testID={testID} style={{ gap: spacing.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${group.folder.name}, ${group.completed} completed, ${group.pending} pending`}
        onPress={() => openFolder(group.folder.id, focus)}
        style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', gap: spacing.md, alignItems: 'center' }}>
        <View style={{ width: 44, height: 44, borderRadius: radius.md, backgroundColor: `${group.folder.color}22`, alignItems: 'center', justifyContent: 'center' }}>
          <Icon name={group.folder.icon as IconName} color={group.folder.color} />
        </View>
        <View style={{ flex: 1, gap: 2 }}>
          <AppText variant="title" numberOfLines={1}>
            {group.folder.name}
          </AppText>
          <AppText variant="caption" muted>
            {group.completed} completed · {group.pending} pending · {group.total} total
          </AppText>
        </View>
        <AppText variant="label" color={group.folder.color}>
          {group.percent}%
        </AppText>
      </View>
      <View style={{ height: 8, borderRadius: radius.sm, backgroundColor: p.surfaceVariant, overflow: 'hidden' }}>
        <View style={{ width: `${group.percent}%`, height: 8, backgroundColor: group.folder.color }} />
      </View>
      {due ? <AppText color={due.urgent ? p.overdue : p.textSecondary}>{due.text}</AppText> : null}
      </Pressable>
      {group.matches.length > 0
        ? group.matches.map((a) => (
            <Pressable
              key={a.occurrence.id}
              accessibilityRole="button"
              accessibilityLabel={`Open ${title(a)} in ${group.folder.name}`}
              onPress={() => openFolder(group.folder.id, a.occurrence.id)}
              style={{ minHeight: 36, justifyContent: 'center' }}>
              <AppText color={p.primary}>{title(a)}</AppText>
            </Pressable>
          ))
        : null}
    </Card>
  );
}
