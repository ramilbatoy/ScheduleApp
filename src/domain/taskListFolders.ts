import { folderTargetStatus } from './folderProgress';
import type { Agenda, DateKey, Folder, SubtaskNode } from './models';
import type { FolderAssignmentFilter, FolderTargetFilter, StatusFilter } from './services/agendaService';

/**
 * Display grouping for the main Tasks list only.
 * Folder date and priority are not copied onto tasks. Other screens keep listing tasks one by one.
 */
export interface TaskFolderGroup {
  folder: Folder;
  /** Matching task occurrences only. Events stay out of the card. */
  tasks: Agenda[];
  total: number;
  completed: number;
  pending: number;
  percent: number;
  /**
   * Tasks the search matched on their own text.
   * A folder-name hit leaves this empty so opening the folder is not pinned to one task.
   */
  matches: Agenda[];
}

export type TaskListEntry = { kind: 'folder'; group: TaskFolderGroup } | { kind: 'item'; agenda: Agenda };

export interface EmptyFolderQuery {
  enabled: boolean;
  search?: string;
  status?: StatusFilter;
  hasPriority: boolean;
  hasCategory: boolean;
  folderTarget?: FolderTargetFilter;
  folderId?: string | null;
  folderAssignment?: FolderAssignmentFilter;
  /** False on the Events chip — empty folders are a task-list concern. */
  includeOnThisKind: boolean;
  today: DateKey;
}

function taskTitle(a: Agenda): string {
  return a.occurrence.titleOverride ?? a.task.title;
}

function walkSubtasks(nodes: readonly SubtaskNode[], into: string[]): void {
  for (const n of nodes) {
    into.push(n.title, n.notes);
    if (n.children.length) walkSubtasks(n.children, into);
  }
}

/** Search hit on the task itself. Folder name is ignored so a name-only hit does not pretend to focus a task. */
export function taskTextHit(a: Agenda, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return false;
  const hay = [taskTitle(a), a.occurrence.notesOverride ?? a.task.notes, a.category?.name ?? ''];
  walkSubtasks(a.subtasks, hay);
  return hay.some((s) => s.toLowerCase().includes(q));
}

function counts(tasks: readonly Agenda[]): Pick<TaskFolderGroup, 'total' | 'completed' | 'pending' | 'percent'> {
  const completed = tasks.filter((a) => a.occurrence.status === 'completed').length;
  const pending = tasks.filter((a) => a.occurrence.status === 'pending').length;
  const total = tasks.length;
  const percent = total === 0 ? 0 : Math.round((completed / total) * 100);
  return { total, completed, pending, percent };
}

/**
 * Collapse tasks that belong to a folder into one card, in the order of the first matching task.
 * Unassigned tasks and every event stay as their own rows. Tasks whose folder record is missing stay rows.
 */
export function groupFolderTasks(items: readonly Agenda[], opts?: { search?: string; emptyFolders?: readonly Folder[] }): TaskListEntry[] {
  const search = opts?.search ?? '';
  const groups = new Map<string, TaskFolderGroup>();
  const order: TaskListEntry[] = [];
  for (const agenda of items) {
    const folder = agenda.task.kind === 'task' ? agenda.folder : null;
    const folderId = agenda.task.folderId;
    if (agenda.task.kind !== 'task' || !folderId || !folder || folder.id !== folderId) {
      order.push({ kind: 'item', agenda });
      continue;
    }
    let group = groups.get(folder.id);
    if (!group) {
      group = { folder, tasks: [], matches: [], total: 0, completed: 0, pending: 0, percent: 0 };
      groups.set(folder.id, group);
      order.push({ kind: 'folder', group });
    }
    group.tasks.push(agenda);
    if (taskTextHit(agenda, search)) group.matches.push(agenda);
  }
  for (const group of groups.values()) {
    Object.assign(group, counts(group.tasks));
  }
  const seen = new Set(groups.keys());
  const extras = [...(opts?.emptyFolders ?? [])]
    .filter((f) => !seen.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name));
  for (const folder of extras) {
    order.push({
      kind: 'folder',
      group: { folder, tasks: [], matches: [], total: 0, completed: 0, pending: 0, percent: 0 },
    });
  }
  return order;
}

/** One focus id when the search found exactly one task in the folder. */
export function folderFocusId(group: TaskFolderGroup): string | null {
  return group.matches.length === 1 ? group.matches[0].occurrence.id : null;
}

/**
 * Folders with no items, for the Tasks list only.
 * Active filters that ask for tasks an empty folder cannot have hide it.
 * Pending (the default chip) and All still show them when the setting is on.
 */
export function selectEmptyFoldersForTasks<T extends Folder & { taskCount: number }>(folders: readonly T[], opts: EmptyFolderQuery): T[] {
  if (!opts.enabled || !opts.includeOnThisKind) return [];
  if (opts.folderAssignment === 'unassigned') return [];
  if (opts.hasPriority || opts.hasCategory) return [];
  const status = opts.status ?? 'pending';
  if (status === 'completed' || status === 'overdue' || status === 'carried' || status === 'upcoming') return [];
  const q = opts.search?.trim().toLowerCase() ?? '';
  return folders.filter((folder) => {
    if (folder.taskCount !== 0 || folder.status !== 'active') return false;
    if (opts.folderId && folder.id !== opts.folderId) return false;
    if (q && !`${folder.name} ${folder.description}`.toLowerCase().includes(q)) return false;
    const target = opts.folderTarget ?? 'any';
    if (target === 'any') return true;
    const info = folderTargetStatus(folder.targetDate, opts.today);
    if (target === 'none') return !info.date;
    if (target === 'set') return !!info.date;
    if (target === 'overdue') return info.overdue;
    return info.approaching;
  });
}
