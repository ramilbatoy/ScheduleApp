import type { FolderProgress } from './folderProgress';
import type { Agenda, DateKey, Folder } from './models';
import { isOverdue, sortAgendaItems, type SortKey } from './services/agendaService';

/**
 * Presentation grouping for Today, Week, and Month.
 * Occurrence dates stay on the task. The folder target date is never a placement key.
 * Callers filter and sort first; these functions do not drop tasks except exact id duplicates.
 */

export interface RangeSummary {
  /** Tasks in this slice, including completed. */
  scheduled: number;
  completed: number;
  pending: number;
  /** Pending tasks that are overdue. Subset of the slice, not of `pending` alone when a deadline passed. */
  overdue: number;
}

export interface PlannerFolderGroup {
  folder: Folder;
  /** Filtered tasks in caller sort order. Occurrence dates are unchanged. */
  tasks: Agenda[];
  range: RangeSummary;
  /** Folder-wide progress. Independent of `range`. Null when the caller did not supply it. */
  overall: FolderProgress | null;
}

export interface DayFolderGroups {
  folders: PlannerFolderGroup[];
  unassigned: Agenda[];
}

export interface WeekDaySlice {
  date: DateKey;
  tasks: Agenda[];
}

export interface WeekFolderGroup {
  folder: Folder;
  /** Weekdays that actually have tasks, in `days` order. */
  days: WeekDaySlice[];
  range: RangeSummary;
  overall: FolderProgress | null;
}

export interface WeekFolderGroups {
  folders: WeekFolderGroup[];
  unassignedByDay: WeekDaySlice[];
}

export interface MonthFolderMarker {
  folderId: string;
  name: string;
  color: string;
  icon: string;
  count: number;
}

export interface MonthDayMarkers {
  folders: MonthFolderMarker[];
  unassigned: number;
}

export interface GroupOpts {
  today: DateKey;
  now: Date;
  overall?: ReadonlyMap<string, FolderProgress>;
  /** Shown even with zero matching tasks. Omit to hide empty folders. */
  emptyFolders?: readonly Folder[];
  sort?: SortKey;
}

function folderOf(a: Agenda): Folder | null {
  if (a.task.kind !== 'task') return null;
  const folder = a.folder;
  if (!a.task.folderId || !folder || folder.id !== a.task.folderId) return null;
  return folder;
}

function uniqueAgenda(items: readonly Agenda[]): Agenda[] {
  const seen = new Set<string>();
  const out: Agenda[] = [];
  for (const a of items) {
    if (seen.has(a.occurrence.id)) continue;
    seen.add(a.occurrence.id);
    out.push(a);
  }
  return out;
}

export function rangeSummary(tasks: readonly Agenda[], today: DateKey, now: Date): RangeSummary {
  let completed = 0;
  let pending = 0;
  let overdue = 0;
  for (const a of tasks) {
    if (a.occurrence.status === 'completed') completed += 1;
    else if (a.occurrence.status === 'pending') pending += 1;
    if (isOverdue(a, today, now)) overdue += 1;
  }
  return { scheduled: tasks.length, completed, pending, overdue };
}

function overallFor(folderId: string, overall?: ReadonlyMap<string, FolderProgress>): FolderProgress | null {
  return overall?.get(folderId) ?? null;
}

function emptyFolderGroups(seen: ReadonlySet<string>, emptyFolders: readonly Folder[] | undefined, overall?: ReadonlyMap<string, FolderProgress>): PlannerFolderGroup[] {
  if (!emptyFolders?.length) return [];
  return [...emptyFolders]
    .filter((f) => !seen.has(f.id))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((folder) => ({
      folder,
      tasks: [],
      range: { scheduled: 0, completed: 0, pending: 0, overdue: 0 },
      overall: overallFor(folder.id, overall),
    }));
}

/** One day (Today, or the month's selected day). Input order is kept. */
export function groupDayByFolder(items: readonly Agenda[], opts: GroupOpts): DayFolderGroups {
  const folders: PlannerFolderGroup[] = [];
  const byId = new Map<string, PlannerFolderGroup>();
  const unassigned: Agenda[] = [];
  for (const agenda of uniqueAgenda(items)) {
    const folder = folderOf(agenda);
    if (!folder) {
      unassigned.push(agenda);
      continue;
    }
    let group = byId.get(folder.id);
    if (!group) {
      group = { folder, tasks: [], range: { scheduled: 0, completed: 0, pending: 0, overdue: 0 }, overall: overallFor(folder.id, opts.overall) };
      byId.set(folder.id, group);
      folders.push(group);
    }
    group.tasks.push(agenda);
  }
  for (const group of folders) group.range = rangeSummary(group.tasks, opts.today, opts.now);
  const extras = emptyFolderGroups(new Set(folders.map((g) => g.folder.id)), opts.emptyFolders, opts.overall);
  return { folders: [...folders, ...extras], unassigned };
}

/**
 * Day this task is drawn on in a Monday–Sunday week.
 * In-week tasks use their occurrence date. Pending tasks from before the week
 * stay visible on today when today is in the week. The folder target is not consulted.
 * `days` must be ascending.
 */
export function weekDisplayDate(a: Agenda, days: readonly DateKey[], today: DateKey): DateKey | null {
  if (days.includes(a.occurrence.date)) return a.occurrence.date;
  const start = days[0];
  if (
    start &&
    days.includes(today) &&
    a.occurrence.date < start &&
    a.task.kind === 'task' &&
    a.occurrence.status === 'pending'
  ) {
    return today;
  }
  return null;
}

/**
 * Folder groups for a week. `days` is the week, ascending.
 * `items` are already filtered. They are sorted here with `opts.sort` (task fields / effective priority).
 * A task dated Monday stays under Monday even when the folder target is another day.
 */
export function groupWeekByFolder(days: readonly DateKey[], items: readonly Agenda[], opts: GroupOpts): WeekFolderGroups {
  const sorted = sortAgendaItems(uniqueAgenda(items), opts.sort ?? 'date');
  const order: string[] = [];
  const byId = new Map<string, { folder: Folder; byDay: Map<DateKey, Agenda[]> }>();
  const loose = new Map<DateKey, Agenda[]>();

  for (const agenda of sorted) {
    const date = weekDisplayDate(agenda, days, opts.today);
    if (!date) continue;
    const folder = folderOf(agenda);
    if (!folder) {
      const list = loose.get(date) ?? [];
      list.push(agenda);
      loose.set(date, list);
      continue;
    }
    let group = byId.get(folder.id);
    if (!group) {
      group = { folder, byDay: new Map() };
      byId.set(folder.id, group);
      order.push(folder.id);
    }
    const list = group.byDay.get(date) ?? [];
    list.push(agenda);
    group.byDay.set(date, list);
  }

  const folders: WeekFolderGroup[] = order.map((id) => {
    const group = byId.get(id)!;
    const slices = days.filter((d) => group.byDay.has(d)).map((date) => ({ date, tasks: group.byDay.get(date)! }));
    const tasks = slices.flatMap((s) => s.tasks);
    return {
      folder: group.folder,
      days: slices,
      range: rangeSummary(tasks, opts.today, opts.now),
      overall: overallFor(id, opts.overall),
    };
  });

  const extras = emptyFolderGroups(new Set(order), opts.emptyFolders, opts.overall).map(
    (group): WeekFolderGroup => ({ folder: group.folder, days: [], range: group.range, overall: group.overall }),
  );

  return {
    folders: [...folders, ...extras],
    unassignedByDay: days.filter((d) => loose.has(d)).map((date) => ({ date, tasks: loose.get(date)! })),
  };
}

/** Compact month-cell counts. One marker per folder that has tasks on this day. */
export function monthDayMarkers(items: readonly Agenda[]): MonthDayMarkers {
  const folders: MonthFolderMarker[] = [];
  const byId = new Map<string, MonthFolderMarker>();
  let unassigned = 0;
  for (const agenda of uniqueAgenda(items)) {
    const folder = folderOf(agenda);
    if (!folder) {
      unassigned += 1;
      continue;
    }
    let marker = byId.get(folder.id);
    if (!marker) {
      marker = { folderId: folder.id, name: folder.name, color: folder.color, icon: folder.icon, count: 0 };
      byId.set(folder.id, marker);
      folders.push(marker);
    }
    marker.count += 1;
  }
  return { folders, unassigned };
}
