import { diffDays } from './dates';
import { PRIORITY_RANK, type DateKey, type Folder, type ItemKind, type OccurrenceStatus, type Priority, type Task } from './models';

/**
 * Folder progress is computed from occurrences. It is never stored.
 *
 * Events are listed on the folder but do not affect total, completed, pending,
 * overdue, or percent (`events` is a separate count). Cancelled occurrences
 * are ignored. Deleted tasks are not passed in.
 *
 * A non-recurring task contributes each pending or completed occurrence
 * (normally one). Carry-forward updates that row in place, so it still counts once.
 *
 * A recurring task contributes occurrences on or before today (completed,
 * pending, or missed). Later generated instances are not pending work yet, so
 * they do not dilute the percent. A missed instance counts as overdue.
 *
 * Pending with an occurrence date before today is overdue. Other pending is pending.
 * percent = round(completed / total * 100), or 0 when nothing counts.
 *
 * The folder target date is a project deadline only. It never changes these units.
 */
export interface ProgressSource {
  taskId: string;
  kind: ItemKind;
  recurring: boolean;
  status: OccurrenceStatus;
  date: DateKey;
}

export interface FolderProgress {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  events: number;
  percent: number;
}

export interface FolderTargetStatus {
  date: DateKey | null;
  /** Calendar days from today until the target. Negative when the target has passed. */
  remainingDays: number | null;
  overdue: boolean;
  /** Target is today or within the next 7 days, and the folder is not already overdue. */
  approaching: boolean;
}

export const FOLDER_APPROACHING_DAYS = 7;

export function effectivePriority(task: Pick<Task, 'priority' | 'priorityExplicit'>, folder: Pick<Folder, 'priority'> | null | undefined): Priority {
  if (task.priorityExplicit === false && folder) return folder.priority;
  return task.priority;
}

export function folderTargetStatus(targetDate: DateKey | null, today: DateKey): FolderTargetStatus {
  if (!targetDate) return { date: null, remainingDays: null, overdue: false, approaching: false };
  const remainingDays = diffDays(targetDate, today);
  const overdue = targetDate < today;
  const approaching = !overdue && remainingDays <= FOLDER_APPROACHING_DAYS;
  return { date: targetDate, remainingDays, overdue, approaching };
}

export function computeFolderProgress(items: readonly ProgressSource[], today: DateKey): FolderProgress {
  const events = items.filter((i) => i.kind === 'event' && i.status !== 'cancelled').length;
  const byTask = new Map<string, ProgressSource[]>();
  for (const item of items) {
    if (item.kind !== 'task') continue;
    const list = byTask.get(item.taskId) ?? [];
    list.push(item);
    byTask.set(item.taskId, list);
  }
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  for (const group of byTask.values()) {
    const recurring = group.some((g) => g.recurring);
    for (const g of group) {
      if (g.status === 'cancelled') continue;
      if (recurring && g.date > today) continue;
      if (!recurring && g.status !== 'pending' && g.status !== 'completed') continue;
      if (g.status === 'completed') completed++;
      else if (g.status === 'missed' || (g.status === 'pending' && g.date < today)) overdue++;
      else if (g.status === 'pending') pending++;
    }
  }
  const total = completed + pending + overdue;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, pending, overdue, events, percent };
}

export interface FolderCard extends Folder {
  progress: FolderProgress;
  target: FolderTargetStatus;
  taskCount: number;
}

export type FolderListFilter = 'all' | 'active' | 'overdue' | 'completed' | 'archived';
export type FolderSortKey = 'name' | 'target' | 'priority' | 'progress' | 'created' | 'updated' | 'manual';

/** Active folder whose target has passed and work is still open (or there is no work yet). */
export function folderIsOverdue(card: FolderCard): boolean {
  if (card.status !== 'active' || !card.target.overdue) return false;
  return card.progress.percent < 100;
}

export function presentFolders(cards: readonly FolderCard[], opts: { filter?: FolderListFilter; sort?: FolderSortKey; text?: string }): FolderCard[] {
  const filter = opts.filter ?? 'all';
  const q = opts.text?.trim().toLowerCase() ?? '';
  let out = cards.filter((c) => {
    if (q && !`${c.name} ${c.description}`.toLowerCase().includes(q)) return false;
    if (filter === 'active') return c.status === 'active';
    if (filter === 'archived') return c.status === 'archived';
    if (filter === 'completed') return c.status === 'completed';
    if (filter === 'overdue') return folderIsOverdue(c);
    return true;
  });
  const sort = opts.sort ?? 'name';
  out = [...out].sort((a, b) => {
    if (sort === 'manual') return a.sortOrder - b.sortOrder || a.name.localeCompare(b.name);
    if (sort === 'priority') return PRIORITY_RANK[b.priority] - PRIORITY_RANK[a.priority] || a.name.localeCompare(b.name);
    if (sort === 'progress') return b.progress.percent - a.progress.percent || a.name.localeCompare(b.name);
    if (sort === 'created') return a.createdAt < b.createdAt ? 1 : a.createdAt > b.createdAt ? -1 : 0;
    if (sort === 'updated') return a.updatedAt < b.updatedAt ? 1 : a.updatedAt > b.updatedAt ? -1 : 0;
    if (sort === 'target') {
      if (!a.targetDate && !b.targetDate) return a.name.localeCompare(b.name);
      if (!a.targetDate) return 1;
      if (!b.targetDate) return -1;
      return a.targetDate < b.targetDate ? -1 : a.targetDate > b.targetDate ? 1 : a.name.localeCompare(b.name);
    }
    return a.name.localeCompare(b.name);
  });
  return out;
}

export function resolvePriority(
  input: { priority: Priority; priorityExplicit?: boolean },
  folder: Pick<Folder, 'priority'> | null,
): { priority: Priority; priorityExplicit: boolean } {
  if (input.priorityExplicit === false && folder) return { priority: folder.priority, priorityExplicit: false };
  return { priority: input.priority, priorityExplicit: true };
}
