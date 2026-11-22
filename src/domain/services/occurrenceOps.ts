import { addDaysKey, diffDays, isDateKey } from '../dates';
import { newId } from '../ids';
import type { DateKey, HistoryEventType, Occurrence, RecurringRule, Task } from '../models';
import { expandRule } from '../recurrence';
import type { Repos } from '../repos/repositories';

/** How far ahead recurring instances are materialized. */
export const GENERATION_WINDOW_DAYS = 60;

/**
 * Rows created before `original_occurrence_date` was always written have a null
 * start date. When the occurrence was never carried, the current assigned date
 * is that start — persist it. Carried rows are left alone so we don't invent
 * a start date the move already discarded.
 */
export async function backfillMissingOriginalDates(repos: Repos): Promise<number> {
  const missing = await repos.occurrences.list({ original_occurrence_date: null });
  let filled = 0;
  for (const occ of missing) {
    if (occ.isCarriedForward || occ.carryForwardCount > 0 || !isDateKey(occ.date)) continue;
    await repos.occurrences.patch(occ.id, { originalDate: occ.date });
    filled++;
  }
  return filled;
}

export async function recordHistory(
  repos: Repos,
  now: string,
  taskId: string,
  occurrenceId: string | null,
  eventType: HistoryEventType,
  extra: { fromDate?: DateKey | null; toDate?: DateKey | null; payload?: Record<string, unknown> | null } = {},
): Promise<void> {
  await repos.history.insert({
    id: newId(),
    taskId,
    occurrenceId,
    eventType,
    fromDate: extra.fromDate ?? null,
    toDate: extra.toDate ?? null,
    payload: extra.payload ?? null,
    createdAt: now,
  });
}

export function newOccurrence(task: Task, date: DateKey, now: string, source: Occurrence['source'], key: string | null): Occurrence {
  return {
    id: newId(),
    taskId: task.id,
    date,
    startTime: task.allDay ? null : task.defaultStartTime,
    endTime: task.allDay ? null : task.defaultEndTime,
    status: 'pending',
    completedAt: null,
    isCarriedForward: false,
    carryForwardCount: 0,
    source,
    recurrenceInstanceKey: key,
    originalDate: date,
    isException: false,
    titleOverride: null,
    notesOverride: null,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Inserts any missing instances of a recurring task in [from, to].
 * Idempotent: an instance whose key already exists (in any status, including
 * cancelled single-instance deletions) is never recreated.
 */
export async function generateInstances(
  repos: Repos,
  task: Task,
  rule: RecurringRule,
  from: DateKey,
  to: DateKey,
  now: string,
): Promise<number> {
  if (task.deletedAt) return 0;
  const start = rule.generatedUntil && addDaysKey(rule.generatedUntil, 1) > from ? addDaysKey(rule.generatedUntil, 1) : from;
  let created = 0;
  if (start <= to) {
    const existing = await repos.occurrences.list({ task_id: task.id, occurrence_date: { gte: start, lte: to } });
    const existingKeys = new Set(
      (await repos.occurrences.list({ task_id: task.id, recurrence_instance_key: { gte: start, lte: to } })).map(
        (o) => o.recurrenceInstanceKey,
      ),
    );
    const activeDates = new Set(existing.filter((o) => o.status === 'pending' || o.status === 'completed').map((o) => o.date));
    for (const date of expandRule(rule, start, to)) {
      if (existingKeys.has(date)) continue;
      const occ = newOccurrence(task, date, now, 'recurrence', date);
      // A moved/carried instance may already sit on this date; keep a cancelled
      // placeholder so the key is reserved without breaking one-active-per-day.
      if (activeDates.has(date)) occ.status = 'cancelled';
      await repos.occurrences.insert(occ);
      activeDates.add(date);
      created++;
    }
  }
  const generatedUntil = rule.endDate && rule.endDate < to ? rule.endDate : to;
  if (!rule.generatedUntil || generatedUntil > rule.generatedUntil) {
    await repos.rules.update({ ...rule, generatedUntil, updatedAt: now });
  }
  return created;
}

export type CarryOutcome = 'moved' | 'missed' | 'skipped';

/**
 * Moves one pending task occurrence onto `today`, preserving its history.
 * If a newer instance of the same task already occupies (date, today], the
 * stale instance is marked `missed` instead so no day ever holds duplicates.
 */
export async function carryOccurrence(repos: Repos, occ: Occurrence, task: Task, today: DateKey, now: string): Promise<CarryOutcome> {
  if (occ.status !== 'pending' || task.deletedAt || task.kind !== 'task' || occ.date >= today) return 'skipped';
  const newer = await repos.occurrences.list({
    task_id: task.id,
    occurrence_date: { gt: occ.date, lte: today },
    status: { in: ['pending', 'completed'] },
  });
  if (newer.some((o) => o.id !== occ.id)) {
    await repos.occurrences.patch(occ.id, { status: 'missed', updatedAt: now });
    await recordHistory(repos, now, task.id, occ.id, 'missed', { fromDate: occ.date, payload: { reason: 'superseded_by_newer_instance' } });
    return 'missed';
  }
  const days = diffDays(today, occ.date);
  await repos.occurrences.patch(occ.id, {
    date: today,
    isCarriedForward: true,
    carryForwardCount: occ.carryForwardCount + days,
    originalDate: occ.originalDate ?? occ.date,
    updatedAt: now,
  });
  await recordHistory(repos, now, task.id, occ.id, 'carried_forward', { fromDate: occ.date, toDate: today, payload: { days } });
  return 'moved';
}
