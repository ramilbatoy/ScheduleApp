import type { Database } from '../../db/types';
import { addDaysKey, combineDateTime, minutesOf, todayKey, type Clock } from '../dates';
import {
  PRIORITY_RANK,
  type Agenda,
  type Category,
  type DateKey,
  type ItemKind,
  type Occurrence,
  type Priority,
  type RecurringRule,
  type SubtaskNode,
} from '../models';
import { createRepos, type Repos } from '../repos/repositories';
import { GENERATION_WINDOW_DAYS } from './occurrenceOps';
import type { RecurrenceService } from './recurrenceService';
import { buildSubtaskTree, flattenSubtaskTree } from './subtaskService';

function flattenSubtaskTitles(nodes: SubtaskNode[]): string[] {
  return flattenSubtaskTree(nodes).flatMap((n) => [n.title, n.notes]);
}

/** Far-future calendar navigation is capped so generation stays bounded. */
const MAX_LOOKAHEAD_DAYS = 3 * 366;

export type StatusFilter = 'all' | 'pending' | 'completed' | 'overdue' | 'carried' | 'upcoming';
export type SortKey = 'date' | 'priority' | 'deadline' | 'created';

export interface ListFilter {
  text?: string;
  status?: StatusFilter;
  kinds?: ItemKind[];
  priorities?: Priority[];
  categoryIds?: string[];
  sort?: SortKey;
}

export interface DaySummary {
  total: number;
  completed: number;
  pending: number;
  overdue: number;
  events: number;
}

export interface Dashboard {
  today: DateKey;
  events: Agenda[];
  tasks: Agenda[];
  overdue: Agenda[];
  upcomingDeadlines: Agenda[];
  completed: number;
  total: number;
  carriedCount: number;
}

export function displayTitle(a: Agenda): string {
  return a.occurrence.titleOverride ?? a.task.title;
}

export function isOverdue(a: Agenda, today: DateKey, now: Date): boolean {
  if (a.occurrence.status !== 'pending') return false;
  if (a.task.kind === 'task' && a.occurrence.date < today) return true;
  return !!a.task.deadlineAt && new Date(a.task.deadlineAt) < now;
}

/** Dedupe by occurrence id, then sort. First list wins when ids collide. */
export function mergeAgendaUnique(...lists: Agenda[][]): Agenda[] {
  const seen = new Set<string>();
  const out: Agenda[] = [];
  for (const list of lists) {
    for (const a of list) {
      if (seen.has(a.occurrence.id)) continue;
      seen.add(a.occurrence.id);
      out.push(a);
    }
  }
  return out.sort(compareAgenda);
}

/**
 * Display-only: unfinished overdue tasks (occurrence.date &lt; today) also appear in
 * today's bucket without mutating dates or creating rows. Completed items stay off this surface.
 */
export function projectOverdueOntoToday(
  byDate: Record<DateKey, Agenda[]>,
  overduePending: Agenda[],
  today: DateKey,
): Record<DateKey, Agenda[]> {
  const extra = overduePending.filter(
    (a) => a.task.kind === 'task' && a.occurrence.status === 'pending' && a.occurrence.date < today,
  );
  if (!extra.length) return byDate;
  const out: Record<DateKey, Agenda[]> = { ...byDate };
  out[today] = mergeAgendaUnique(extra, out[today] ?? []);
  return out;
}

/** All-day first, then by start time, then by priority. */
export function compareAgenda(a: Agenda, b: Agenda): number {
  if (a.occurrence.date !== b.occurrence.date) return a.occurrence.date < b.occurrence.date ? -1 : 1;
  const ta = a.occurrence.startTime ? minutesOf(a.occurrence.startTime) : -1;
  const tb = b.occurrence.startTime ? minutesOf(b.occurrence.startTime) : -1;
  if (ta !== tb) return ta - tb;
  return PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority];
}

/** Pure status/kind/priority/category/text match — shared by Tasks list and Week/Month filters. */
export function matchesAgendaFilter(a: Agenda, filter: ListFilter, today: DateKey, now: Date): boolean {
  if (filter.kinds?.length && !filter.kinds.includes(a.task.kind)) return false;
  if (filter.priorities?.length && !filter.priorities.includes(a.task.priority)) return false;
  if (filter.categoryIds?.length && !(a.task.categoryId && filter.categoryIds.includes(a.task.categoryId))) return false;
  const text = filter.text?.trim().toLowerCase();
  if (text) {
    const hay = [
      displayTitle(a),
      a.occurrence.notesOverride ?? a.task.notes,
      a.category?.name ?? '',
      ...flattenSubtaskTitles(a.subtasks),
    ];
    if (!hay.some((s) => s.toLowerCase().includes(text))) return false;
  }
  const status = filter.status ?? 'all';
  const pending = a.occurrence.status === 'pending';
  switch (status) {
    case 'pending':
      return pending;
    case 'completed':
      return !pending;
    case 'overdue':
      return isOverdue(a, today, now);
    case 'carried':
      return pending && a.occurrence.isCarriedForward;
    case 'upcoming':
      return pending && a.occurrence.date > today;
    default:
      return true;
  }
}

export function sortAgendaItems(items: Agenda[], sort: SortKey = 'date'): Agenda[] {
  const out = [...items];
  const byDate = compareAgenda;
  out.sort((a, b) => {
    if (sort === 'priority') {
      const d = PRIORITY_RANK[b.task.priority] - PRIORITY_RANK[a.task.priority];
      return d || byDate(a, b);
    }
    if (sort === 'deadline') {
      const da = a.task.deadlineAt ?? '\uffff';
      const db = b.task.deadlineAt ?? '\uffff';
      return da === db ? byDate(a, b) : da < db ? -1 : 1;
    }
    if (sort === 'created') return a.task.createdAt === b.task.createdAt ? byDate(a, b) : a.task.createdAt < b.task.createdAt ? 1 : -1;
    return byDate(a, b);
  });
  return out;
}

/** Apply ListFilter to an already-loaded agenda slice (Week/Month day lists, trackers). */
export function filterAgendaItems(items: Agenda[], filter: ListFilter, today: DateKey, now: Date): Agenda[] {
  return sortAgendaItems(
    items.filter((a) => matchesAgendaFilter(a, filter, today, now)),
    filter.sort ?? 'date',
  );
}

export class AgendaService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly recurrence: RecurrenceService,
  ) {}

  private async join(repos: Repos, occs: Occurrence[], includeDeleted = false): Promise<Agenda[]> {
    const tasks = new Map((await repos.tasks.listByIds([...new Set(occs.map((o) => o.taskId))])).map((t) => [t.id, t]));
    const categories = new Map<string, Category>((await repos.categories.list()).map((c) => [c.id, c]));
    const ruleIds = [...new Set([...tasks.values()].map((t) => t.recurringRuleId).filter((x): x is string => !!x))];
    const rules = new Map<string, RecurringRule>();
    for (const id of ruleIds) {
      const r = await repos.rules.get(id);
      if (r) rules.set(id, r);
    }
    const subtaskRows = await repos.subtasks.listActiveForOccurrences(occs.map((o) => o.id));
    const byOcc = new Map<string, typeof subtaskRows>();
    for (const s of subtaskRows) {
      const list = byOcc.get(s.occurrenceId) ?? [];
      list.push(s);
      byOcc.set(s.occurrenceId, list);
    }
    const out: Agenda[] = [];
    for (const occurrence of occs) {
      const task = tasks.get(occurrence.taskId);
      if (!task || (!includeDeleted && task.deletedAt)) continue;
      const subtasks: SubtaskNode[] = task.kind === 'task' ? buildSubtaskTree(byOcc.get(occurrence.id) ?? []) : [];
      out.push({
        occurrence,
        task,
        rule: task.recurringRuleId ? (rules.get(task.recurringRuleId) ?? null) : null,
        category: task.categoryId ? (categories.get(task.categoryId) ?? null) : null,
        subtasks,
      });
    }
    return out;
  }

  private async ensureGenerated(end: DateKey) {
    const today = todayKey(this.clock);
    if (end <= addDaysKey(today, GENERATION_WINDOW_DAYS)) return;
    const capped = addDaysKey(today, MAX_LOOKAHEAD_DAYS);
    await this.recurrence.ensureThrough(end < capped ? end : capped);
  }

  /** Active (pending + completed) items whose assigned day is in [start, end]. */
  async range(start: DateKey, end: DateKey): Promise<Agenda[]> {
    await this.ensureGenerated(end);
    const repos = createRepos(this.db);
    const occs = await repos.occurrences.listInRange(start, end, ['pending', 'completed']);
    return (await this.join(repos, occs)).sort(compareAgenda);
  }

  /**
   * Pending task occurrences dated before today (still unfinished).
   * Used to surface overdue work on Today / current-date month cell without carry-forward.
   */
  async pendingOverdueBeforeToday(): Promise<Agenda[]> {
    const today = todayKey(this.clock);
    const repos = createRepos(this.db);
    const past = await this.join(repos, await repos.occurrences.listPendingBefore(today));
    return past.filter((a) => a.task.kind === 'task').sort(compareAgenda);
  }

  /**
   * Items for one civil day. When `date` is today, also includes unfinished overdue
   * tasks from earlier days (display merge — occurrence.date unchanged).
   */
  async day(date: DateKey): Promise<Agenda[]> {
    const today = todayKey(this.clock);
    const items = await this.range(date, date);
    if (date !== today) return items;
    return mergeAgendaUnique(await this.pendingOverdueBeforeToday(), items);
  }

  async summaries(start: DateKey, end: DateKey): Promise<Record<DateKey, DaySummary>> {
    const items = await this.range(start, end);
    const today = todayKey(this.clock);
    const now = this.clock.now();
    const out: Record<DateKey, DaySummary> = {};
    for (const a of items) {
      const s = (out[a.occurrence.date] ??= { total: 0, completed: 0, pending: 0, overdue: 0, events: 0 });
      s.total++;
      if (a.task.kind === 'event') s.events++;
      if (a.occurrence.status === 'completed') s.completed++;
      else if (isOverdue(a, today, now)) s.overdue++;
      else s.pending++;
    }
    return out;
  }

  async dashboard(): Promise<Dashboard> {
    const today = todayKey(this.clock);
    const now = this.clock.now();
    const repos = createRepos(this.db);
    // day(today) already projects past overdue onto today for the main agenda lists.
    const todays = await this.day(today);
    const pastPending = await this.pendingOverdueBeforeToday();
    const overdue = [
      ...pastPending,
      ...todays.filter(
        (a) =>
          a.occurrence.date === today &&
          a.task.deadlineAt &&
          new Date(a.task.deadlineAt) < now &&
          a.occurrence.status === 'pending',
      ),
    ].sort(compareAgenda);

    const horizon = addDaysKey(today, 7);
    const deadlineTasks = (await repos.tasks.list({ deleted_at: null, deadline_at: { ne: null } })).filter(
      (t) => t.deadlineAt && new Date(t.deadlineAt) >= now && combineDateTime(horizon, '23:59') >= new Date(t.deadlineAt),
    );
    const upcoming: Agenda[] = [];
    for (const t of deadlineTasks) {
      const pending = (await repos.occurrences.list({ task_id: t.id, status: 'pending' }))[0];
      if (pending) upcoming.push(...(await this.join(repos, [pending])));
    }
    upcoming.sort((a, b) => (a.task.deadlineAt! < b.task.deadlineAt! ? -1 : 1));

    return {
      today,
      events: todays.filter((a) => a.task.kind === 'event'),
      tasks: todays.filter((a) => a.task.kind === 'task'),
      overdue,
      upcomingDeadlines: upcoming,
      completed: todays.filter((a) => a.occurrence.status === 'completed').length,
      total: todays.length,
      carriedCount: todays.filter((a) => a.occurrence.isCarriedForward && a.occurrence.status === 'pending').length,
    };
  }

  /**
   * Global list/search. Recurring series show only their next pending
   * instance in pending-type views so a daily habit does not flood the list.
   */
  async list(filter: ListFilter = {}): Promise<Agenda[]> {
    const repos = createRepos(this.db);
    const today = todayKey(this.clock);
    const now = this.clock.now();
    const status = filter.status ?? 'all';
    const occs = await repos.occurrences.list({ status: { in: ['pending', 'completed'] } });
    let items = await this.join(repos, occs);

    const seenSeries = new Set<string>();
    items = items.filter((a) => {
      if (!a.rule || a.occurrence.status !== 'pending' || a.occurrence.date < today) return true;
      if (seenSeries.has(a.task.id)) return false;
      seenSeries.add(a.task.id);
      return true;
    });

    return filterAgendaItems(items, { ...filter, status }, today, now);
  }
}
