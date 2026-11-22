import type { Database } from '../../db/types';
import { addDaysKey, deviceTimeZone, isDateKey, isTimeOfDay, minutesOf, nowIso, todayKey, type Clock } from '../dates';
import { newId } from '../ids';
import {
  NotFoundError,
  PRIORITIES,
  ValidationError,
  type Agenda,
  type DateKey,
  type Frequency,
  type HistoryEntry,
  type ItemKind,
  type Occurrence,
  type Priority,
  type RecurringRule,
  type SubtaskNode,
  type Task,
  type TimeOfDay,
} from '../models';
import { createRepos, type Repos } from '../repos/repositories';
import { resolvePriority } from '../folderProgress';
import { resolveFolderForWrite } from './folderService';
import { carryOccurrence, GENERATION_WINDOW_DAYS, generateInstances, newOccurrence, recordHistory } from './occurrenceOps';
import { buildSubtaskTree } from './subtaskService';

export interface RecurrenceInput {
  frequency: Frequency;
  interval: number;
  byWeekday: number[] | null;
  byMonthday: number | null;
  endDate: DateKey | null;
}

export interface ItemInput {
  kind: ItemKind;
  title: string;
  notes: string;
  categoryId: string | null;
  /** Omit or null to leave the task out of every folder. */
  folderId?: string | null;
  priority: Priority;
  /** False inherits the folder priority. Omitted means explicit, matching tasks created before folders. */
  priorityExplicit?: boolean;
  date: DateKey;
  allDay: boolean;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  deadlineAt: string | null;
  reminderOffsetMinutes: number | null;
  deadlineReminderOffsetMinutes: number | null;
  recurrence: RecurrenceInput | null;
}

/** `occurrence`: only this instance. `future`: this and following. `series`: every instance. */
export type EditScope = 'occurrence' | 'future' | 'series';

export interface ItemDetail extends Agenda {
  history: HistoryEntry[];
}

function sameRule(a: RecurringRule, b: RecurrenceInput & { startDate: DateKey }): boolean {
  return (
    a.frequency === b.frequency &&
    a.interval === b.interval &&
    JSON.stringify(a.byWeekday ?? null) === JSON.stringify(b.byWeekday ?? null) &&
    (a.byMonthday ?? null) === (b.byMonthday ?? null) &&
    (a.endDate ?? null) === (b.endDate ?? null) &&
    a.startDate === b.startDate
  );
}

export function validateItemInput(input: ItemInput): ItemInput {
  const title = input.title.trim();
  if (!title) throw new ValidationError('Title is required.');
  if (title.length > 200) throw new ValidationError('Title must be 200 characters or fewer.');
  if (input.kind !== 'task' && input.kind !== 'event') throw new ValidationError('Unknown item type.');
  if (!PRIORITIES.includes(input.priority)) throw new ValidationError('Unknown priority.');
  if (!isDateKey(input.date)) throw new ValidationError('A valid date is required.');
  const startTime = input.allDay ? null : input.startTime;
  const endTime = input.allDay ? null : input.endTime;
  if (startTime && !isTimeOfDay(startTime)) throw new ValidationError('Start time is invalid.');
  if (endTime && !isTimeOfDay(endTime)) throw new ValidationError('End time is invalid.');
  if (endTime && !startTime) throw new ValidationError('Set a start time before an end time.');
  if (startTime && endTime && minutesOf(endTime) <= minutesOf(startTime)) {
    throw new ValidationError('End time must be after the start time.');
  }
  if (input.deadlineAt && Number.isNaN(Date.parse(input.deadlineAt))) throw new ValidationError('Deadline is invalid.');
  for (const m of [input.reminderOffsetMinutes, input.deadlineReminderOffsetMinutes]) {
    if (m !== null && (!Number.isInteger(m) || m < 0 || m > 60 * 24 * 30)) {
      throw new ValidationError('Reminder offset must be between 0 minutes and 30 days.');
    }
  }
  if (input.deadlineReminderOffsetMinutes !== null && !input.deadlineAt) {
    throw new ValidationError('Set a deadline before adding a deadline reminder.');
  }
  const r = input.recurrence;
  if (r) {
    if (!['daily', 'weekly', 'monthly', 'yearly'].includes(r.frequency)) throw new ValidationError('Unknown repeat frequency.');
    if (!Number.isInteger(r.interval) || r.interval < 1 || r.interval > 365) {
      throw new ValidationError('Repeat interval must be between 1 and 365.');
    }
    if (r.frequency === 'weekly' && r.byWeekday && (r.byWeekday.length === 0 || r.byWeekday.some((d) => d < 1 || d > 7))) {
      throw new ValidationError('Pick at least one weekday.');
    }
    if (r.byMonthday !== null && (r.byMonthday < 1 || r.byMonthday > 31)) throw new ValidationError('Day of month must be 1–31.');
    if (r.endDate && (!isDateKey(r.endDate) || r.endDate < input.date)) {
      throw new ValidationError('Repeat end date must be on or after the start date.');
    }
  }
  return {
    ...input,
    title,
    notes: input.notes.trim(),
    startTime,
    endTime,
    folderId: input.folderId || null,
    priorityExplicit: input.priorityExplicit !== false,
  };
}

export class TaskService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly onChanged: (taskIds: string[]) => Promise<void> = async () => undefined,
  ) {}

  private ctx(repos: Repos) {
    return { repos, now: nowIso(this.clock), today: todayKey(this.clock) };
  }

  private async load(repos: Repos, occurrenceId: string) {
    const occ = await repos.occurrences.get(occurrenceId);
    if (!occ) throw new NotFoundError('This item no longer exists.');
    const task = await repos.tasks.get(occ.taskId);
    if (!task || task.deletedAt) throw new NotFoundError('This item was deleted.');
    const rule = task.recurringRuleId ? await repos.rules.get(task.recurringRuleId) : null;
    return { occ, task, rule };
  }

  private generationEnd(today: DateKey, start: DateKey): DateKey {
    return addDaysKey(start > today ? start : today, GENERATION_WINDOW_DAYS);
  }

  /** Creates a task or event; returns the first occurrence. */
  async create(raw: ItemInput): Promise<Occurrence> {
    const input = validateItemInput(raw);
    const result = await this.db.transaction(async (tx) => {
      const { repos, now, today } = this.ctx(createRepos(tx));
      if (input.categoryId && !(await repos.categories.get(input.categoryId))) {
        throw new ValidationError('That category no longer exists.');
      }
      const folder = await resolveFolderForWrite(repos, input.folderId ?? null, null);
      const resolved = resolvePriority(input, folder);
      let rule: RecurringRule | null = null;
      if (input.recurrence) {
        rule = { id: newId(), ...input.recurrence, startDate: input.date, timezone: deviceTimeZone(), generatedUntil: null, createdAt: now, updatedAt: now };
        await repos.rules.insert(rule);
      }
      const task: Task = {
        id: newId(),
        kind: input.kind,
        title: input.title,
        notes: input.notes,
        categoryId: input.categoryId,
        folderId: folder?.id ?? null,
        priority: resolved.priority,
        priorityExplicit: resolved.priorityExplicit,
        allDay: input.allDay,
        defaultStartTime: input.startTime,
        defaultEndTime: input.endTime,
        deadlineAt: input.deadlineAt,
        recurringRuleId: rule?.id ?? null,
        seriesId: null,
        reminderOffsetMinutes: input.reminderOffsetMinutes,
        deadlineReminderOffsetMinutes: input.deadlineReminderOffsetMinutes,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      task.seriesId = rule ? task.id : null;
      await repos.tasks.insert(task);
      await recordHistory(repos, now, task.id, null, 'created', { toDate: input.date });
      if (rule) {
        await generateInstances(repos, task, rule, input.date, this.generationEnd(today, input.date), now);
        const first = (await repos.occurrences.list({ task_id: task.id, status: 'pending' }))[0];
        if (!first) throw new ValidationError('This repeat rule produces no dates. Check the end date and weekdays.');
        return first;
      }
      const occ = newOccurrence(task, input.date, now, 'manual', null);
      await repos.occurrences.insert(occ);
      return occ;
    });
    await this.onChanged([result.taskId]);
    return result;
  }

  async getDetail(occurrenceId: string): Promise<ItemDetail> {
    const repos = createRepos(this.db);
    const { occ, task, rule } = await this.load(repos, occurrenceId);
    const category = task.categoryId ? await repos.categories.get(task.categoryId) : null;
    const folder = task.folderId ? await repos.folders.get(task.folderId) : null;
    const history = await repos.history.listByTask(task.id);
    const subtasks: SubtaskNode[] =
      task.kind === 'task' ? buildSubtaskTree(await repos.subtasks.listActiveForOccurrence(occ.id)) : [];
    return { occurrence: occ, task, rule, category, folder, history, subtasks };
  }

  /** The values an edit form should start from for the given scope. */
  async formValues(occurrenceId: string, scope: EditScope): Promise<ItemInput> {
    const { occurrence: occ, task, rule } = await this.getDetail(occurrenceId);
    const series = scope !== 'occurrence' && rule;
    return {
      kind: task.kind,
      title: scope === 'occurrence' ? (occ.titleOverride ?? task.title) : task.title,
      notes: scope === 'occurrence' ? (occ.notesOverride ?? task.notes) : task.notes,
      categoryId: task.categoryId,
      folderId: task.folderId,
      priority: task.priority,
      priorityExplicit: task.priorityExplicit,
      date: series ? (scope === 'future' ? occ.date : rule.startDate) : occ.date,
      allDay: task.allDay,
      startTime: series ? task.defaultStartTime : occ.startTime,
      endTime: series ? task.defaultEndTime : occ.endTime,
      deadlineAt: task.deadlineAt,
      reminderOffsetMinutes: task.reminderOffsetMinutes,
      deadlineReminderOffsetMinutes: task.deadlineReminderOffsetMinutes,
      recurrence: rule
        ? { frequency: rule.frequency, interval: rule.interval, byWeekday: rule.byWeekday, byMonthday: rule.byMonthday, endDate: rule.endDate }
        : null,
    };
  }

  /**
   * Edits an item. Non-recurring items ignore `scope`. For recurring items:
   * `occurrence` changes only this instance's title/notes/date/time;
   * `future` splits the series at this instance; `series` rewrites the rule and
   * regenerates future pending instances (past and completed ones are kept).
   */
  async update(occurrenceId: string, raw: ItemInput, scope: EditScope): Promise<Occurrence> {
    const input = validateItemInput(raw);
    const result = await this.db.transaction(async (tx) => {
      const { repos, now, today } = this.ctx(createRepos(tx));
      const { occ, task, rule } = await this.load(repos, occurrenceId);
      if (input.categoryId && !(await repos.categories.get(input.categoryId))) {
        throw new ValidationError('That category no longer exists.');
      }

      if (rule && scope === 'occurrence') {
        const patch: Partial<Occurrence> = {
          titleOverride: input.title !== task.title ? input.title : null,
          notesOverride: input.notes !== task.notes ? input.notes : null,
          startTime: input.startTime,
          endTime: input.endTime,
          isException: true,
          updatedAt: now,
        };
        if (input.date !== occ.date) {
          await this.assertDayFree(repos, task.id, input.date, occ.id);
          patch.date = input.date;
          await recordHistory(repos, now, task.id, occ.id, 'date_changed', { fromDate: occ.date, toDate: input.date });
        }
        await repos.occurrences.patch(occ.id, patch);
        return [task.id, occ.id];
      }

      if (rule && scope === 'future' && occ.date > rule.startDate) {
        return this.splitSeries(repos, now, today, task, rule, occ, input);
      }

      const folder = await resolveFolderForWrite(repos, input.folderId ?? null, task.folderId);
      const resolved = resolvePriority(input, folder);
      const taskPatch: Partial<Task> = {
        kind: task.kind,
        title: input.title,
        notes: input.notes,
        categoryId: input.categoryId,
        folderId: folder?.id ?? null,
        priority: resolved.priority,
        priorityExplicit: resolved.priorityExplicit,
        allDay: input.allDay,
        defaultStartTime: input.startTime,
        defaultEndTime: input.endTime,
        deadlineAt: input.deadlineAt,
        reminderOffsetMinutes: input.reminderOffsetMinutes,
        deadlineReminderOffsetMinutes: input.deadlineReminderOffsetMinutes,
        updatedAt: now,
      };

      if (!rule) {
        if (input.date !== occ.date) {
          await this.assertDayFree(repos, task.id, input.date, occ.id);
          await recordHistory(repos, now, task.id, occ.id, 'date_changed', { fromDate: occ.date, toDate: input.date });
        }
        await repos.occurrences.patch(occ.id, {
          date: input.date,
          startTime: input.startTime,
          endTime: input.endTime,
          updatedAt: now,
        });
        if (input.recurrence) {
          const newRule: RecurringRule = { id: newId(), ...input.recurrence, startDate: input.date, timezone: deviceTimeZone(), generatedUntil: input.date, createdAt: now, updatedAt: now };
          await repos.rules.insert(newRule);
          await repos.occurrences.patch(occ.id, { recurrenceInstanceKey: input.date, source: 'recurrence' });
          const updated = { ...task, ...taskPatch, recurringRuleId: newRule.id, seriesId: task.id };
          await repos.tasks.patch(task.id, { ...taskPatch, recurringRuleId: newRule.id, seriesId: task.id });
          await generateInstances(repos, updated, newRule, input.date, this.generationEnd(today, input.date), now);
        } else {
          await repos.tasks.patch(task.id, taskPatch);
        }
        return [task.id, occ.id];
      }

      // Whole series (or "future" from the first instance, which is the same thing).
      const updatedTask = { ...task, ...taskPatch };
      await repos.tasks.patch(task.id, taskPatch);
      const timesChanged = task.defaultStartTime !== input.startTime || task.defaultEndTime !== input.endTime || task.allDay !== input.allDay;

      if (!input.recurrence) {
        // Repeat turned off: keep history, drop future generated instances, keep one on `date`.
        await this.dropFuturePending(repos, task.id, today);
        await repos.tasks.patch(task.id, { recurringRuleId: null, updatedAt: now });
        const kept = await repos.occurrences.findActiveOnDate(task.id, input.date);
        if (kept) return [task.id, kept.id];
        const single = newOccurrence(updatedTask, input.date, now, 'manual', null);
        await repos.occurrences.insert(single);
        return [task.id, single.id];
      }

      const startDate = scope === 'series' ? input.date : rule.startDate;
      const nextRule = { ...input.recurrence, startDate };
      if (!sameRule(rule, nextRule) || timesChanged) {
        await this.dropFuturePending(repos, task.id, today);
        const regenFrom = startDate > today ? startDate : today;
        const updatedRule: RecurringRule = { ...rule, ...nextRule, generatedUntil: addDaysKey(regenFrom, -1), updatedAt: now };
        await repos.rules.update(updatedRule);
        await generateInstances(repos, updatedTask, updatedRule, regenFrom, this.generationEnd(today, startDate), now);
      }
      const current = (await repos.occurrences.get(occ.id)) ?? (await repos.occurrences.findActiveOnDate(task.id, occ.date));
      if (current && current.status !== 'cancelled') return [task.id, current.id];
      const next = (await repos.occurrences.list({ task_id: task.id, status: 'pending', occurrence_date: { gte: today } }))[0];
      return [task.id, (next ?? current ?? occ).id];
    });
    await this.onChanged([result[0]]);
    const updated = await createRepos(this.db).occurrences.get(result[1]);
    if (!updated) throw new NotFoundError('Updated item could not be reloaded.');
    return updated;
  }

  /** Ends the old series the day before `occ` and starts a new task + rule from it. */
  private async splitSeries(repos: Repos, now: string, today: DateKey, task: Task, rule: RecurringRule, occ: Occurrence, input: ItemInput): Promise<[string, string]> {
    const cutoff = occ.date;
    await repos.rules.update({ ...rule, endDate: addDaysKey(cutoff, -1), updatedAt: now });
    const futureOld = await repos.occurrences.list({ task_id: task.id, occurrence_date: { gte: cutoff }, status: 'pending' });
    for (const o of futureOld) {
      await repos.occurrences.patch(o.id, { status: 'cancelled', updatedAt: now });
    }
    await recordHistory(repos, now, task.id, occ.id, 'deleted', { fromDate: cutoff, payload: { reason: 'series_split' } });

    const newRule: RecurringRule = {
      id: newId(),
      ...(input.recurrence ?? { frequency: rule.frequency, interval: rule.interval, byWeekday: rule.byWeekday, byMonthday: rule.byMonthday, endDate: rule.endDate }),
      startDate: input.date,
      timezone: deviceTimeZone(),
      generatedUntil: null,
      createdAt: now,
      updatedAt: now,
    };
    await repos.rules.insert(newRule);
    const folder = await resolveFolderForWrite(repos, input.folderId ?? null, task.folderId);
    const resolved = resolvePriority(input, folder);
    const newTask: Task = {
      ...task,
      id: newId(),
      title: input.title,
      notes: input.notes,
      categoryId: input.categoryId,
      folderId: folder?.id ?? null,
      priority: resolved.priority,
      priorityExplicit: resolved.priorityExplicit,
      allDay: input.allDay,
      defaultStartTime: input.startTime,
      defaultEndTime: input.endTime,
      deadlineAt: input.deadlineAt,
      reminderOffsetMinutes: input.reminderOffsetMinutes,
      deadlineReminderOffsetMinutes: input.deadlineReminderOffsetMinutes,
      recurringRuleId: newRule.id,
      seriesId: task.seriesId ?? task.id,
      createdAt: now,
      updatedAt: now,
    };
    await repos.tasks.insert(newTask);
    await recordHistory(repos, now, newTask.id, null, 'created', { toDate: input.date, payload: { splitFrom: task.id } });
    await generateInstances(repos, newTask, newRule, input.date, this.generationEnd(today, input.date), now);
    const first = (await repos.occurrences.list({ task_id: newTask.id, status: 'pending' }))[0];
    if (!first) throw new ValidationError('This repeat rule produces no dates. Check the end date and weekdays.');
    return [newTask.id, first.id];
  }

  private async dropFuturePending(repos: Repos, taskId: string, today: DateKey) {
    // Generated, untouched future instances are regenerable, so removing them loses nothing.
    // User-deleted single instances are exceptions and survive, so they stay deleted.
    await repos.occurrences.deleteWhere({
      task_id: taskId,
      status: 'pending',
      occurrence_date: { gte: today },
      is_exception: 0,
      is_carried_forward: 0,
      source: 'recurrence',
    });
    await repos.occurrences.deleteWhere({
      task_id: taskId,
      status: 'cancelled',
      occurrence_date: { gte: today },
      source: 'recurrence',
      is_exception: 0,
    });
  }

  private async assertDayFree(repos: Repos, taskId: string, date: DateKey, selfId: string) {
    const clash = await repos.occurrences.findActiveOnDate(taskId, date);
    if (clash && clash.id !== selfId) {
      throw new ValidationError('This item already has an occurrence on that date.');
    }
  }

  async complete(occurrenceId: string): Promise<void> {
    const taskId = await this.db.transaction(async (tx) => {
      const { repos, now } = this.ctx(createRepos(tx));
      const { occ, task } = await this.load(repos, occurrenceId);
      if (occ.status === 'completed') return task.id;
      if (occ.status !== 'pending') throw new ValidationError('Only pending items can be completed.');
      await repos.occurrences.patch(occ.id, { status: 'completed', completedAt: now, updatedAt: now });
      await recordHistory(repos, now, task.id, occ.id, 'completed', { fromDate: occ.date });
      return task.id;
    });
    await this.onChanged([taskId]);
  }

  async reopen(occurrenceId: string): Promise<void> {
    const taskId = await this.db.transaction(async (tx) => {
      const { repos, now, today } = this.ctx(createRepos(tx));
      const { occ, task } = await this.load(repos, occurrenceId);
      if (occ.status === 'pending') return task.id;
      if (occ.status !== 'completed' && occ.status !== 'missed') throw new ValidationError('This item cannot be reopened.');
      await this.assertDayFree(repos, task.id, occ.date, occ.id);
      await repos.occurrences.patch(occ.id, { status: 'pending', completedAt: null, updatedAt: now });
      await recordHistory(repos, now, task.id, occ.id, 'reopened', { fromDate: occ.date });
      const settings = await repos.settings.getAll();
      if (settings.autoCarryForward && occ.date < today) {
        await carryOccurrence(repos, { ...occ, status: 'pending' }, task, today, now);
      }
      return task.id;
    });
    await this.onChanged([taskId]);
  }

  async toggleComplete(occurrenceId: string): Promise<void> {
    const occ = await createRepos(this.db).occurrences.get(occurrenceId);
    if (!occ) throw new NotFoundError('This item no longer exists.');
    if (occ.status === 'completed') await this.reopen(occurrenceId);
    else await this.complete(occurrenceId);
  }

  /** Reschedules one occurrence (manual date change; respected by carry-forward). */
  async changeDate(occurrenceId: string, date: DateKey): Promise<void> {
    if (!isDateKey(date)) throw new ValidationError('A valid date is required.');
    const taskId = await this.db.transaction(async (tx) => {
      const { repos, now } = this.ctx(createRepos(tx));
      const { occ, task, rule } = await this.load(repos, occurrenceId);
      if (occ.date === date) return task.id;
      if (occ.status !== 'pending') throw new ValidationError('Only pending items can be rescheduled.');
      await this.assertDayFree(repos, task.id, date, occ.id);
      await repos.occurrences.patch(occ.id, { date, isException: rule ? true : occ.isException, updatedAt: now });
      await recordHistory(repos, now, task.id, occ.id, 'date_changed', { fromDate: occ.date, toDate: date });
      return task.id;
    });
    await this.onChanged([taskId]);
  }

  /**
   * Deletes an item. Completed occurrences and history are always kept; the
   * definition is soft-deleted so it stops generating and carrying forward.
   */
  async delete(occurrenceId: string, scope: EditScope): Promise<void> {
    const taskId = await this.db.transaction(async (tx) => {
      const { repos, now } = this.ctx(createRepos(tx));
      const { occ, task, rule } = await this.load(repos, occurrenceId);
      if (rule && scope === 'occurrence') {
        await repos.occurrences.patch(occ.id, { status: 'cancelled', isException: true, updatedAt: now });
        await recordHistory(repos, now, task.id, occ.id, 'deleted', { fromDate: occ.date, payload: { scope } });
        return task.id;
      }
      if (rule && scope === 'future' && occ.date > rule.startDate) {
        await repos.rules.update({ ...rule, endDate: addDaysKey(occ.date, -1), updatedAt: now });
        await repos.occurrences.patchWhere(
          { task_id: task.id, status: 'pending', occurrence_date: { gte: occ.date } },
          { status: 'cancelled', updatedAt: now },
        );
        await recordHistory(repos, now, task.id, occ.id, 'deleted', { fromDate: occ.date, payload: { scope } });
        return task.id;
      }
      await repos.occurrences.patchWhere({ task_id: task.id, status: 'pending' }, { status: 'cancelled', updatedAt: now });
      await repos.tasks.patch(task.id, { deletedAt: now, updatedAt: now });
      await recordHistory(repos, now, task.id, occ.id, 'deleted', { fromDate: occ.date, payload: { scope: rule ? 'series' : 'item' } });
      return task.id;
    });
    await this.onChanged([taskId]);
  }

  /** Manual carry-forward of specific overdue occurrences, regardless of the auto setting. */
  async moveToToday(occurrenceIds: string[]): Promise<number> {
    const touched: string[] = [];
    const moved = await this.db.transaction(async (tx) => {
      const { repos, now, today } = this.ctx(createRepos(tx));
      let count = 0;
      for (const id of occurrenceIds) {
        const occ = await repos.occurrences.get(id);
        if (!occ) continue;
        const task = await repos.tasks.get(occ.taskId);
        if (!task) continue;
        if (task.kind === 'event') {
          if (occ.status !== 'pending' || occ.date >= today) continue;
          await this.assertDayFree(repos, task.id, today, occ.id);
          await repos.occurrences.patch(occ.id, { date: today, updatedAt: now });
          await recordHistory(repos, now, task.id, occ.id, 'date_changed', { fromDate: occ.date, toDate: today });
          count++;
        } else if ((await carryOccurrence(repos, occ, task, today, now)) === 'moved') {
          count++;
        }
        touched.push(task.id);
      }
      return count;
    });
    await this.onChanged(touched);
    return moved;
  }
}
