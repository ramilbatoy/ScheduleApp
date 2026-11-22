import type { DbOps, Where } from '../../db/types';
import {
  DEFAULT_SETTINGS,
  type AppSettings,
  type Category,
  type DateKey,
  type HistoryEntry,
  type Occurrence,
  type OccurrenceStatus,
  type RecurringRule,
  type Reminder,
  type Task,
} from '../models';
import {
  categoryMapper,
  historyMapper,
  occurrenceMapper,
  occurrencePatch,
  reminderMapper,
  ruleMapper,
  taskMapper,
  taskPatch,
} from './mappers';

export class CategoryRepo {
  constructor(private readonly db: DbOps) {}
  async list(): Promise<Category[]> {
    const rows = await this.db.find('categories', {
      orderBy: [{ column: 'sort_order' }, { column: 'name' }],
    });
    return rows.map(categoryMapper.from);
  }
  async get(id: string) {
    const r = await this.db.get('categories', id);
    return r ? categoryMapper.from(r) : null;
  }
  insert(c: Category) {
    return this.db.insert('categories', categoryMapper.to(c));
  }
  update(c: Category) {
    return this.db.update('categories', c.id, categoryMapper.to(c));
  }
  delete(id: string) {
    return this.db.delete('categories', id);
  }
  count() {
    return this.db.count('categories');
  }
}

export class RuleRepo {
  constructor(private readonly db: DbOps) {}
  async get(id: string) {
    const r = await this.db.get('recurring_rules', id);
    return r ? ruleMapper.from(r) : null;
  }
  async list(): Promise<RecurringRule[]> {
    return (await this.db.find('recurring_rules')).map(ruleMapper.from);
  }
  insert(x: RecurringRule) {
    return this.db.insert('recurring_rules', ruleMapper.to(x));
  }
  update(x: RecurringRule) {
    return this.db.update('recurring_rules', x.id, ruleMapper.to(x));
  }
}

export class TaskRepo {
  constructor(private readonly db: DbOps) {}
  async get(id: string) {
    const r = await this.db.get('tasks', id);
    return r ? taskMapper.from(r) : null;
  }
  async list(where?: Where): Promise<Task[]> {
    return (await this.db.find('tasks', { where })).map(taskMapper.from);
  }
  listActive() {
    return this.list({ deleted_at: null });
  }
  async listByIds(ids: string[]): Promise<Task[]> {
    if (!ids.length) return [];
    return this.list({ id: { in: ids } });
  }
  insert(t: Task) {
    return this.db.insert('tasks', taskMapper.to(t));
  }
  patch(id: string, p: Partial<Task>) {
    return this.db.update('tasks', id, taskPatch(p));
  }
}

export class OccurrenceRepo {
  constructor(private readonly db: DbOps) {}
  async get(id: string) {
    const r = await this.db.get('task_occurrences', id);
    return r ? occurrenceMapper.from(r) : null;
  }
  async list(where?: Where): Promise<Occurrence[]> {
    const rows = await this.db.find('task_occurrences', {
      where,
      orderBy: [{ column: 'occurrence_date' }, { column: 'start_time' }, { column: 'created_at' }],
    });
    return rows.map(occurrenceMapper.from);
  }
  listInRange(start: DateKey, end: DateKey, statuses?: OccurrenceStatus[]) {
    return this.list({
      occurrence_date: { gte: start, lte: end },
      ...(statuses ? { status: { in: statuses } } : {}),
    });
  }
  listByTask(taskId: string) {
    return this.list({ task_id: taskId });
  }
  listPendingBefore(date: DateKey) {
    return this.list({ status: 'pending', occurrence_date: { lt: date } });
  }
  async findActiveOnDate(taskId: string, date: DateKey): Promise<Occurrence | null> {
    const r = await this.list({ task_id: taskId, occurrence_date: date, status: { in: ['pending', 'completed'] } });
    return r[0] ?? null;
  }
  async findByInstanceKey(taskId: string, key: string): Promise<Occurrence | null> {
    const r = await this.list({ task_id: taskId, recurrence_instance_key: key });
    return r[0] ?? null;
  }
  insert(o: Occurrence) {
    return this.db.insert('task_occurrences', occurrenceMapper.to(o));
  }
  patch(id: string, p: Partial<Occurrence>) {
    return this.db.update('task_occurrences', id, occurrencePatch(p));
  }
  patchWhere(where: Where, p: Partial<Occurrence>) {
    return this.db.updateWhere('task_occurrences', where, occurrencePatch(p));
  }
  deleteWhere(where: Where) {
    return this.db.deleteWhere('task_occurrences', where);
  }
}

export class ReminderRepo {
  constructor(private readonly db: DbOps) {}
  async list(where?: Where): Promise<Reminder[]> {
    return (await this.db.find('reminders', { where, orderBy: [{ column: 'trigger_at' }] })).map(reminderMapper.from);
  }
  insert(r: Reminder) {
    return this.db.insert('reminders', reminderMapper.to(r));
  }
  setNotificationId(id: string, notificationId: string | null, updatedAt: string) {
    return this.db.update('reminders', id, { notification_id: notificationId, updated_at: updatedAt });
  }
  deleteWhere(where: Where) {
    return this.db.deleteWhere('reminders', where);
  }
}

export class HistoryRepo {
  constructor(private readonly db: DbOps) {}
  insert(h: HistoryEntry) {
    return this.db.insert('completion_history', historyMapper.to(h));
  }
  async list(where?: Where): Promise<HistoryEntry[]> {
    const rows = await this.db.find('completion_history', { where, orderBy: [{ column: 'created_at' }] });
    return rows.map(historyMapper.from);
  }
  listByTask(taskId: string) {
    return this.list({ task_id: taskId });
  }
}

const SETTING_KEYS: Record<keyof AppSettings, string> = {
  autoCarryForward: 'auto_carry_forward_enabled',
  theme: 'theme',
  defaultReminderOffsetMinutes: 'default_reminder_offset_minutes',
  lastCarryForwardRunDate: 'last_carry_forward_run_date',
  notificationsEnabled: 'notifications_enabled',
  lastBackupAt: 'last_backup_at',
  categoriesSeeded: 'categories_seeded',
};

export class SettingsRepo {
  constructor(private readonly db: DbOps) {}

  async getAll(): Promise<AppSettings> {
    const rows = await this.db.find('app_settings');
    const byKey = new Map(rows.map((r) => [String(r.id), String(r.value)]));
    const out = { ...DEFAULT_SETTINGS } as Record<string, unknown>;
    for (const [field, key] of Object.entries(SETTING_KEYS)) {
      const raw = byKey.get(key);
      if (raw === undefined) continue;
      try {
        out[field] = JSON.parse(raw);
      } catch {
        // keep default for a corrupted value
      }
    }
    return out as unknown as AppSettings;
  }

  async set<K extends keyof AppSettings>(field: K, value: AppSettings[K], nowIso: string): Promise<void> {
    const id = SETTING_KEYS[field];
    const row = { id, value: JSON.stringify(value), updated_at: nowIso };
    const existing = await this.db.get('app_settings', id);
    if (existing) await this.db.update('app_settings', id, row);
    else await this.db.insert('app_settings', row);
  }
}

export interface Repos {
  categories: CategoryRepo;
  rules: RuleRepo;
  tasks: TaskRepo;
  occurrences: OccurrenceRepo;
  reminders: ReminderRepo;
  history: HistoryRepo;
  settings: SettingsRepo;
}

export function createRepos(db: DbOps): Repos {
  return {
    categories: new CategoryRepo(db),
    rules: new RuleRepo(db),
    tasks: new TaskRepo(db),
    occurrences: new OccurrenceRepo(db),
    reminders: new ReminderRepo(db),
    history: new HistoryRepo(db),
    settings: new SettingsRepo(db),
  };
}
