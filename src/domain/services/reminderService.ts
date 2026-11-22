import type { Database } from '../../db/types';
import { addDaysKey, combineDateTime, formatTime, nowIso, todayKey, type Clock } from '../dates';
import { newId } from '../ids';
import type { Reminder, ReminderKind, Task } from '../models';
import type { NotificationPort, PermissionState } from '../ports';
import { createRepos, type Repos } from '../repos/repositories';

/** Start-time reminders are scheduled this far ahead and refreshed on every app open. */
export const REMINDER_HORIZON_DAYS = 14;
/** Android caps pending alarms per app (~500); stay well below it. */
export const MAX_SCHEDULED = 200;
/** All-day items with a start reminder are anchored to this local time. */
export const ALL_DAY_REMINDER_TIME = '09:00';

interface Desired {
  taskId: string;
  occurrenceId: string | null;
  kind: ReminderKind;
  offsetMinutes: number;
  at: Date;
  title: string;
  body: string;
}

const keyOf = (r: { occurrenceId: string | null; kind: string; triggerAt: string }) => `${r.occurrenceId ?? '-'}|${r.kind}|${r.triggerAt}`;

export function describeOffset(minutes: number): string {
  if (minutes === 0) return 'At time';
  if (minutes % 1440 === 0) return `${minutes / 1440} day${minutes === 1440 ? '' : 's'} before`;
  if (minutes % 60 === 0) return `${minutes / 60} hour${minutes === 60 ? '' : 's'} before`;
  return `${minutes} min before`;
}

/**
 * Keeps OS-scheduled local notifications in step with the database.
 * The `reminders` table is the source of truth; notification ids are a cache
 * of what the OS currently holds and are rebuilt on every sync.
 */
export class ReminderService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly port: NotificationPort,
  ) {}

  get platform() {
    return this.port.platform;
  }

  permission(): Promise<PermissionState> {
    return this.port.permission();
  }

  async requestPermission(): Promise<PermissionState> {
    const state = await this.port.requestPermission();
    if (state === 'granted') await this.syncAll();
    return state;
  }

  exactAlarmPermission() {
    return this.port.exactAlarmPermission();
  }

  requestExactAlarmPermission() {
    return this.port.requestExactAlarmPermission();
  }

  private async desiredFor(repos: Repos, task: Task): Promise<Desired[]> {
    if (task.deletedAt) return [];
    const now = this.clock.now();
    const today = todayKey(this.clock);
    const out: Desired[] = [];
    const pending = await repos.occurrences.list({ task_id: task.id, status: 'pending' });
    if (task.reminderOffsetMinutes !== null) {
      const horizon = addDaysKey(today, REMINDER_HORIZON_DAYS);
      for (const o of pending.filter((x) => x.date >= today && x.date <= horizon)) {
        const time = o.startTime ?? ALL_DAY_REMINDER_TIME;
        const at = new Date(combineDateTime(o.date, time).getTime() - task.reminderOffsetMinutes * 60000);
        if (at <= now) continue;
        out.push({
          taskId: task.id,
          occurrenceId: o.id,
          kind: 'start',
          offsetMinutes: task.reminderOffsetMinutes,
          at,
          title: o.titleOverride ?? task.title,
          body: o.startTime ? `${task.kind === 'event' ? 'Starts' : 'Scheduled'} at ${formatTime(o.startTime)}` : 'Scheduled for today',
        });
      }
    }
    if (task.deadlineAt && task.deadlineReminderOffsetMinutes !== null && pending.length > 0) {
      const deadline = new Date(task.deadlineAt);
      const at = new Date(deadline.getTime() - task.deadlineReminderOffsetMinutes * 60000);
      if (at > now) {
        out.push({
          taskId: task.id,
          occurrenceId: null,
          kind: 'deadline',
          offsetMinutes: task.deadlineReminderOffsetMinutes,
          at,
          title: `Deadline: ${task.title}`,
          body: `Due ${deadline.toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}`,
        });
      }
    }
    return out;
  }

  /** Reconciles reminders for the given tasks (or every task when omitted). */
  async sync(taskIds?: string[]): Promise<{ scheduled: number; total: number }> {
    const repos = createRepos(this.db);
    const settings = await repos.settings.getAll();
    const canSchedule = settings.notificationsEnabled && (await this.port.permission()) === 'granted';
    const tasks = taskIds ? await repos.tasks.listByIds(taskIds) : await repos.tasks.list();
    const scopeIds = taskIds ?? tasks.map((t) => t.id);

    let desired: Desired[] = [];
    for (const t of tasks) desired.push(...(await this.desiredFor(repos, t)));
    desired.sort((a, b) => a.at.getTime() - b.at.getTime());
    if (!taskIds) desired = desired.slice(0, MAX_SCHEDULED);

    const existing = scopeIds.length ? await repos.reminders.list({ task_id: { in: scopeIds } }) : [];
    const desiredByKey = new Map(desired.map((d) => [keyOf({ occurrenceId: d.occurrenceId, kind: d.kind, triggerAt: d.at.toISOString() }), d]));
    const now = nowIso(this.clock);

    const toDelete: Reminder[] = [];
    const keep = new Map<string, Reminder>();
    for (const r of existing) {
      const k = keyOf(r);
      if (desiredByKey.has(k) && !keep.has(k)) keep.set(k, r);
      else toDelete.push(r);
    }
    for (const r of toDelete) if (r.notificationId) await this.port.cancel(r.notificationId).catch(() => undefined);
    if (!canSchedule) {
      for (const r of keep.values()) if (r.notificationId) await this.port.cancel(r.notificationId).catch(() => undefined);
    }

    const inserts: Reminder[] = [];
    const idUpdates: [string, string | null][] = [];
    let scheduled = 0;
    for (const [k, d] of desiredByKey) {
      const existingRow = keep.get(k);
      let notificationId = existingRow?.notificationId ?? null;
      if (!canSchedule) notificationId = null;
      else if (!notificationId) {
        notificationId = await this.port
          .schedule({ at: d.at, title: d.title, body: d.body, data: { taskId: d.taskId, occurrenceId: d.occurrenceId ?? '' } })
          .catch(() => null);
      }
      if (notificationId) scheduled++;
      if (existingRow) {
        if (existingRow.notificationId !== notificationId) idUpdates.push([existingRow.id, notificationId]);
      } else {
        inserts.push({
          id: newId(),
          taskId: d.taskId,
          occurrenceId: d.occurrenceId,
          triggerAt: d.at.toISOString(),
          kind: d.kind,
          offsetMinutes: d.offsetMinutes,
          notificationId,
          enabled: true,
          createdAt: now,
          updatedAt: now,
        });
      }
    }

    await this.db.transaction(async (tx) => {
      const r = createRepos(tx);
      if (toDelete.length) await r.reminders.deleteWhere({ id: { in: toDelete.map((x) => x.id) } });
      for (const row of inserts) await r.reminders.insert(row);
      for (const [id, nid] of idUpdates) await r.reminders.setNotificationId(id, nid, now);
    });
    return { scheduled, total: desiredByKey.size };
  }

  syncAll() {
    return this.sync();
  }

  async upcoming(limit = 20): Promise<Reminder[]> {
    const rows = await createRepos(this.db).reminders.list({ trigger_at: { gte: nowIso(this.clock) } });
    return rows.slice(0, limit);
  }

  async forTask(taskId: string): Promise<Reminder[]> {
    return createRepos(this.db).reminders.list({ task_id: taskId, trigger_at: { gte: nowIso(this.clock) } });
  }
}
