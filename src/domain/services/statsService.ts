import { endOfMonth, endOfWeek, startOfMonth, startOfWeek } from 'date-fns';

import type { Database } from '../../db/types';
import { addDaysKey, dateRange, diffDays, fromDateKey, todayKey, toDateKey, type Clock } from '../dates';
import type { Category, DateKey, Occurrence, Task } from '../models';
import { createRepos } from '../repos/repositories';

export type StatsPeriod = 'day' | 'week' | 'month';
export const WEEK_STARTS_ON = 0;
export const TREND_DAYS = 14;
const WEEKDAY_LOOKBACK_DAYS = 56;

export interface PeriodTotals {
  period: StatsPeriod;
  start: DateKey;
  end: DateKey;
  /** Tasks scheduled in the period (excludes cancelled/deleted entries). */
  total: number;
  completed: number;
  pending: number;
  /** Pending tasks dated before today, or whose deadline has passed. */
  overdue: number;
  /** Past recurring instances that were superseded without being done. */
  missed: number;
  /** completed / total, or null when nothing was scheduled. */
  completionRate: number | null;
  events: number;
  eventsDone: number;
  /** Times a task was carried into a day of this period, and the days moved. */
  carryMoves: number;
  carryDays: number;
}

export interface DayPoint {
  date: DateKey;
  total: number;
  completed: number;
}

export interface CategorySlice {
  categoryId: string | null;
  name: string;
  color: string;
  total: number;
  completed: number;
}

export interface CarriedItem {
  occurrenceId: string;
  taskId: string;
  title: string;
  date: DateKey;
  carryForwardCount: number;
}

export interface StatsReport {
  today: DateKey;
  period: PeriodTotals;
  /** Daily scheduled vs completed tasks for the last TREND_DAYS days. */
  trend: DayPoint[];
  categories: CategorySlice[];
  /** Completions by local weekday (0 = Sunday) over the last eight weeks. */
  weekdays: number[];
  bestDay: { date: DateKey; completed: number } | null;
  /** Consecutive days, ending today (or yesterday if nothing is done yet today), with a completion. */
  streak: number;
  /** Pending tasks carried the most times, oldest-first on ties. */
  mostCarried: CarriedItem[];
  allTime: { tasksCreated: number; completed: number; carryMoves: number };
}

export function periodRange(period: StatsPeriod, today: DateKey): { start: DateKey; end: DateKey } {
  const d = fromDateKey(today);
  if (period === 'day') return { start: today, end: today };
  if (period === 'week') {
    return {
      start: toDateKey(startOfWeek(d, { weekStartsOn: WEEK_STARTS_ON })),
      end: toDateKey(endOfWeek(d, { weekStartsOn: WEEK_STARTS_ON })),
    };
  }
  return { start: toDateKey(startOfMonth(d)), end: toDateKey(endOfMonth(d)) };
}

const counts = (o: Occurrence) => o.status !== 'cancelled';

export class StatsService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async report(period: StatsPeriod): Promise<StatsReport> {
    const repos = createRepos(this.db);
    const today = todayKey(this.clock);
    const now = this.clock.now();
    const { start, end } = periodRange(period, today);
    const trendStart = addDaysKey(today, -(TREND_DAYS - 1));
    const lookbackStart = addDaysKey(today, -(WEEKDAY_LOOKBACK_DAYS - 1));
    const windowStart = [start, trendStart, lookbackStart].sort()[0];
    const windowEnd = end > today ? end : today;

    const [tasks, categories, inWindow, allCompleted, carryHistory] = await Promise.all([
      repos.tasks.list(),
      repos.categories.list(),
      repos.occurrences.listInRange(windowStart, windowEnd),
      repos.occurrences.list({ status: 'completed' }),
      repos.history.list({ event_type: 'carried_forward' }),
    ]);
    const taskById = new Map(tasks.map((t) => [t.id, t]));
    const isTask = (o: Occurrence) => taskById.get(o.taskId)?.kind === 'task';
    const isEvent = (o: Occurrence) => taskById.get(o.taskId)?.kind === 'event';

    const inPeriod = inWindow.filter((o) => o.date >= start && o.date <= end && counts(o));
    const periodTasks = inPeriod.filter(isTask);
    const periodEvents = inPeriod.filter(isEvent);
    const completed = periodTasks.filter((o) => o.status === 'completed').length;
    const overdue = periodTasks.filter((o) => {
      if (o.status !== 'pending') return false;
      const deadline = taskById.get(o.taskId)?.deadlineAt;
      return o.date < today || (deadline !== null && deadline !== undefined && new Date(deadline) < now);
    }).length;
    const carriedIn = carryHistory.filter((h) => h.toDate !== null && h.toDate >= start && h.toDate <= end);

    const totals: PeriodTotals = {
      period,
      start,
      end,
      total: periodTasks.length,
      completed,
      pending: periodTasks.filter((o) => o.status === 'pending').length,
      overdue,
      missed: periodTasks.filter((o) => o.status === 'missed').length,
      completionRate: periodTasks.length ? completed / periodTasks.length : null,
      events: periodEvents.length,
      eventsDone: periodEvents.filter((o) => o.status === 'completed').length,
      carryMoves: carriedIn.length,
      carryDays: carriedIn.reduce((s, h) => s + daysMoved(h.fromDate, h.toDate), 0),
    };

    const trendByDate = new Map<DateKey, DayPoint>(dateRange(trendStart, today).map((d) => [d, { date: d, total: 0, completed: 0 }]));
    for (const o of inWindow) {
      const p = trendByDate.get(o.date);
      if (!p || !counts(o) || !isTask(o)) continue;
      p.total++;
      if (o.status === 'completed') p.completed++;
    }

    const completedByDay = new Map<DateKey, number>();
    for (const o of allCompleted) {
      if (!o.completedAt || !isTask(o)) continue;
      const day = toDateKey(new Date(o.completedAt));
      completedByDay.set(day, (completedByDay.get(day) ?? 0) + 1);
    }
    const weekdays = [0, 0, 0, 0, 0, 0, 0];
    let bestDay: StatsReport['bestDay'] = null;
    for (const [day, n] of completedByDay) {
      if (day >= lookbackStart && day <= today) weekdays[fromDateKey(day).getDay()] += n;
      if (day > today) continue;
      if (!bestDay || n > bestDay.completed || (n === bestDay.completed && day > bestDay.date)) bestDay = { date: day, completed: n };
    }
    let streak = 0;
    let cursor = completedByDay.has(today) ? today : addDaysKey(today, -1);
    while (completedByDay.has(cursor)) {
      streak++;
      cursor = addDaysKey(cursor, -1);
    }

    const mostCarried = (await repos.occurrences.list({ status: 'pending', carry_forward_count: { gt: 0 } }))
      .map((o) => ({ o, t: taskById.get(o.taskId) }))
      .filter((x): x is { o: Occurrence; t: Task } => !!x.t && x.t.kind === 'task' && !x.t.deletedAt)
      .sort((a, b) => b.o.carryForwardCount - a.o.carryForwardCount || a.o.createdAt.localeCompare(b.o.createdAt))
      .slice(0, 5)
      .map(({ o, t }) => ({
        occurrenceId: o.id,
        taskId: t.id,
        title: o.titleOverride ?? t.title,
        date: o.date,
        carryForwardCount: o.carryForwardCount,
      }));

    return {
      today,
      period: totals,
      trend: [...trendByDate.values()],
      categories: categoryBreakdown(inPeriod, taskById, categories),
      weekdays,
      bestDay,
      streak,
      mostCarried,
      allTime: {
        tasksCreated: tasks.filter((t) => t.kind === 'task').length,
        completed: allCompleted.filter(isTask).length,
        carryMoves: carryHistory.length,
      },
    };
  }
}

function daysMoved(from: DateKey | null, to: DateKey | null): number {
  if (!from || !to) return 0;
  return Math.max(0, diffDays(to, from));
}

function categoryBreakdown(items: Occurrence[], taskById: Map<string, Task>, categories: Category[]): CategorySlice[] {
  const byId = new Map(categories.map((c) => [c.id, c]));
  const slices = new Map<string, CategorySlice>();
  for (const o of items) {
    const t = taskById.get(o.taskId);
    if (!t) continue;
    const c = t.categoryId ? byId.get(t.categoryId) : undefined;
    const key = c?.id ?? '-';
    let s = slices.get(key);
    if (!s) {
      s = { categoryId: c?.id ?? null, name: c?.name ?? 'Uncategorized', color: c?.color ?? '#9CA3AF', total: 0, completed: 0 };
      slices.set(key, s);
    }
    s.total++;
    if (o.status === 'completed') s.completed++;
  }
  return [...slices.values()].sort((a, b) => b.total - a.total || a.name.localeCompare(b.name));
}
