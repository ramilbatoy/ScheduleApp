import { SCHEMA, TABLE_INSERT_ORDER } from '../../db/schema';
import { LATEST_SCHEMA_VERSION } from '../../db/sqlite/migrations';
import type { Database, Row, SqlValue } from '../../db/types';
import { deviceTimeZone, isDateKey, isTimeOfDay, nowIso, type Clock } from '../dates';
import { ValidationError } from '../models';
import { createRepos } from '../repos/repositories';

export const BACKUP_APP_ID = 'dayplanner';
export const BACKUP_FORMAT_VERSION = 2;

/**
 * Tables carried in a backup. `reminders` is deliberately excluded: its rows
 * hold OS notification ids that only mean something on the device that
 * scheduled them, and the reminder service rebuilds them from the tasks.
 */
export const BACKUP_TABLES = TABLE_INSERT_ORDER.filter((t) => t !== 'reminders');

/** Settings that describe this device rather than the user's data; never overwritten by a restore. */
const DEVICE_SETTING_KEYS = new Set(['last_backup_at', 'notifications_enabled']);
const KNOWN_SETTING_KEYS = new Set([
  'auto_carry_forward_enabled',
  'theme',
  'theme_preset',
  'theme_custom_colors',
  'theme_last_used',
  'default_reminder_offset_minutes',
  'last_carry_forward_run_date',
  'notifications_enabled',
  'last_backup_at',
  'categories_seeded',
  'navigation',
  'branding',
  'show_empty_folders_on_tasks',
]);

export interface BackupFile {
  app: typeof BACKUP_APP_ID;
  formatVersion: number;
  schemaVersion: number;
  exportedAt: string;
  timeZone: string;
  data: Record<string, Row[]>;
}

export interface BackupSummary {
  exportedAt: string;
  timeZone: string;
  categories: number;
  tasks: number;
  events: number;
  folders: number;
  occurrences: number;
  completed: number;
  history: number;
}

export interface ValidatedBackup {
  backup: BackupFile;
  summary: BackupSummary;
  warnings: string[];
}

const ENUMS: Record<string, Record<string, readonly string[]>> = {
  recurring_rules: { frequency: ['daily', 'weekly', 'monthly', 'yearly'] },
  tasks: { item_kind: ['task', 'event'], priority: ['low', 'medium', 'high', 'urgent'] },
  folders: { priority: ['low', 'medium', 'high', 'urgent'], status: ['active', 'archived', 'completed'] },
  task_occurrences: {
    status: ['pending', 'completed', 'cancelled', 'missed'],
    source: ['manual', 'recurrence', 'carry_forward'],
  },
};
const DATE_COLUMNS: Record<string, string[]> = {
  folders: ['target_date'],
  recurring_rules: ['start_date', 'end_date', 'generated_until'],
  task_occurrences: ['occurrence_date', 'original_occurrence_date'],
  completion_history: ['from_date', 'to_date'],
};
const TIME_COLUMNS: Record<string, string[]> = {
  tasks: ['default_start_time', 'default_end_time'],
  task_occurrences: ['start_time', 'end_time'],
};
const INSTANT_COLUMNS: Record<string, string[]> = {
  categories: ['created_at', 'updated_at'],
  folders: ['created_at', 'updated_at', 'archived_at'],
  recurring_rules: ['created_at', 'updated_at'],
  tasks: ['created_at', 'updated_at', 'deleted_at', 'deadline_at'],
  task_occurrences: ['created_at', 'updated_at', 'completed_at'],
  task_subtasks: ['created_at', 'updated_at', 'completed_at', 'deleted_at'],
  completion_history: ['created_at'],
};

const MAX_REPORTED_ERRORS = 8;

export const SAFETY_COPY_PREFIX = 'dayplanner-before-restore-';

export function safetyCopyName(at: string): string {
  return `${SAFETY_COPY_PREFIX}${at.replace(/[:.]/g, '-')}.json`;
}

/** The instant encoded in a safety copy's file name, or null for other files. */
export function safetyCopyDate(name: string): string | null {
  const m = /before-restore-(\d{4}-\d{2}-\d{2})T(\d{2})-(\d{2})-(\d{2})-(\d{3})Z\.json$/.exec(name);
  return m ? `${m[1]}T${m[2]}:${m[3]}:${m[4]}.${m[5]}Z` : null;
}

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function summarize(backup: BackupFile): BackupSummary {
  const tasks = backup.data.tasks.filter((t) => t.deleted_at === null);
  return {
    exportedAt: backup.exportedAt,
    timeZone: backup.timeZone,
    categories: backup.data.categories.length,
    tasks: tasks.filter((t) => t.item_kind === 'task').length,
    events: tasks.filter((t) => t.item_kind === 'event').length,
    folders: backup.data.folders?.length ?? 0,
    occurrences: backup.data.task_occurrences.length,
    completed: backup.data.task_occurrences.filter((o) => o.status === 'completed').length,
    history: backup.data.completion_history.length,
  };
}

/**
 * Full-fidelity JSON export/import. Restores replace everything in one
 * transaction: a backup that fails validation, or a write that fails part
 * way, leaves the current data untouched.
 */
export class BackupService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  async export(): Promise<BackupFile> {
    const data: Record<string, Row[]> = {};
    for (const table of BACKUP_TABLES) {
      data[table] = await this.db.find(table, { orderBy: [{ column: 'id' }] });
    }
    return {
      app: BACKUP_APP_ID,
      formatVersion: BACKUP_FORMAT_VERSION,
      schemaVersion: LATEST_SCHEMA_VERSION,
      exportedAt: nowIso(this.clock),
      timeZone: deviceTimeZone(),
      data,
    };
  }

  async exportJson(): Promise<string> {
    return JSON.stringify(await this.export(), null, 2);
  }

  /** Records that the user saved a backup (shown in Settings). */
  async markBackedUp(): Promise<string> {
    const at = nowIso(this.clock);
    await this.db.transaction(async (tx) => createRepos(tx).settings.set('lastBackupAt', at, at));
    return at;
  }

  /** Parses and fully validates a backup without touching the database. */
  validate(text: string): ValidatedBackup {
    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      throw new ValidationError('This file is not valid JSON.');
    }
    if (!isObject(parsed) || parsed.app !== BACKUP_APP_ID) {
      throw new ValidationError('This file is not a DayPlanner backup.');
    }
    if (typeof parsed.formatVersion !== 'number' || typeof parsed.schemaVersion !== 'number') {
      throw new ValidationError('The backup is missing its version information.');
    }
    if (parsed.formatVersion > BACKUP_FORMAT_VERSION || parsed.schemaVersion > LATEST_SCHEMA_VERSION) {
      throw new ValidationError('This backup was made by a newer version of the app. Update the app, then restore it.');
    }
    if (typeof parsed.exportedAt !== 'string' || Number.isNaN(Date.parse(parsed.exportedAt))) {
      throw new ValidationError('The backup has no valid export date.');
    }
    if (!isObject(parsed.data)) throw new ValidationError('The backup contains no data section.');

    const errors: string[] = [];
    const warnings: string[] = [];
    const fail = (msg: string) => {
      if (errors.length < MAX_REPORTED_ERRORS) errors.push(msg);
    };
    const data: Record<string, Row[]> = {};

    /** Tables added after schema v1 — absent in older backups, treat as empty. */
    const optionalTables = new Set(['task_subtasks', 'folders']);
    for (const table of BACKUP_TABLES) {
      const rows = parsed.data[table];
      if (!Array.isArray(rows)) {
        if (rows === undefined && optionalTables.has(table)) {
          warnings.push(`Backup has no "${table}" table; treating as empty.`);
          data[table] = [];
          continue;
        }
        fail(`Missing table "${table}".`);
        data[table] = [];
        continue;
      }
      const def = SCHEMA[table];
      const ids = new Set<string>();
      const clean: Row[] = [];
      rows.forEach((raw, index) => {
        const where = `${table}[${index}]`;
        if (!isObject(raw)) return fail(`${where} is not an object.`);
        const row: Row = {};
        for (const key of Object.keys(raw)) {
          if (!def.columns[key]) fail(`${where} has unknown field "${key}".`);
        }
        for (const [col, spec] of Object.entries(def.columns)) {
          const v = raw[col];
          if (v === undefined || v === null) {
            if (v === undefined && spec.defaultValue !== undefined) {
              row[col] = spec.defaultValue;
              continue;
            }
            if (!spec.nullable) fail(`${where} is missing required field "${col}".`);
            row[col] = null;
            continue;
          }
          const ok = spec.type === 'integer' ? typeof v === 'number' && Number.isInteger(v) : typeof v === 'string';
          if (!ok) fail(`${where}.${col} should be ${spec.type === 'integer' ? 'a whole number' : 'text'}.`);
          row[col] = v as SqlValue;
        }
        const id = row.id;
        if (typeof id === 'string') {
          if (ids.has(id)) fail(`${where} repeats id ${id}.`);
          ids.add(id);
        }
        for (const [col, allowed] of Object.entries(ENUMS[table] ?? {})) {
          if (typeof row[col] === 'string' && !allowed.includes(row[col] as string)) {
            fail(`${where}.${col} has unsupported value "${String(row[col])}".`);
          }
        }
        for (const col of DATE_COLUMNS[table] ?? []) {
          if (row[col] !== null && !isDateKey(row[col])) fail(`${where}.${col} is not a valid date.`);
        }
        for (const col of TIME_COLUMNS[table] ?? []) {
          if (row[col] !== null && !isTimeOfDay(row[col])) fail(`${where}.${col} is not a valid time.`);
        }
        for (const col of INSTANT_COLUMNS[table] ?? []) {
          if (typeof row[col] === 'string' && Number.isNaN(Date.parse(row[col] as string))) {
            fail(`${where}.${col} is not a valid timestamp.`);
          }
        }
        clean.push(row);
      });
      data[table] = clean;
    }

    const settings: Row[] = [];
    for (const row of data.app_settings ?? []) {
      const key = String(row.id);
      if (!KNOWN_SETTING_KEYS.has(key)) {
        warnings.push(`Ignored unknown setting "${key}".`);
        continue;
      }
      try {
        JSON.parse(String(row.value));
      } catch {
        fail(`Setting "${key}" has an unreadable value.`);
      }
      settings.push(row);
    }
    data.app_settings = settings;

    const idsOf = (table: string) => new Set((data[table] ?? []).map((r) => String(r.id)));
    const activeFolderNames = new Set<string>();
    for (const f of data.folders ?? []) {
      if (f.status !== 'active') continue;
      const key = String(f.name).trim().toLowerCase();
      if (activeFolderNames.has(key)) fail(`Two active folders are named "${String(f.name)}".`);
      activeFolderNames.add(key);
    }
    const categoryIds = idsOf('categories');
    const folderIds = idsOf('folders');
    const ruleIds = idsOf('recurring_rules');
    const taskIds = idsOf('tasks');
    const occurrenceIds = idsOf('task_occurrences');
    for (const t of data.tasks ?? []) {
      if (t.category_id !== null && !categoryIds.has(String(t.category_id))) {
        warnings.push(`"${String(t.title)}" referenced a missing category and will be uncategorized.`);
        t.category_id = null;
      }
      if (t.folder_id !== null && !folderIds.has(String(t.folder_id))) {
        warnings.push(`"${String(t.title)}" referenced a missing folder and will be unassigned.`);
        t.folder_id = null;
        if (Number(t.priority_explicit) === 0) t.priority_explicit = 1;
      }
      if (t.recurring_rule_id !== null && !ruleIds.has(String(t.recurring_rule_id))) {
        fail(`Task "${String(t.title)}" references a repeat rule that is not in the backup.`);
      }
    }
    const activeKeys = new Set<string>();
    const instanceKeys = new Set<string>();
    for (const o of data.task_occurrences ?? []) {
      if (!taskIds.has(String(o.task_id))) fail(`Occurrence ${String(o.id)} belongs to a task that is not in the backup.`);
      if (o.status === 'pending' || o.status === 'completed') {
        const k = `${String(o.task_id)}|${String(o.occurrence_date)}`;
        if (activeKeys.has(k)) fail(`A task has two active entries on ${String(o.occurrence_date)}.`);
        activeKeys.add(k);
      }
      if (o.recurrence_instance_key !== null) {
        const k = `${String(o.task_id)}|${String(o.recurrence_instance_key)}`;
        if (instanceKeys.has(k)) fail(`A repeating task has a duplicated instance (${String(o.recurrence_instance_key)}).`);
        instanceKeys.add(k);
      }
    }
    const subtaskIds = idsOf('task_subtasks');
    for (const s of data.task_subtasks ?? []) {
      if (!occurrenceIds.has(String(s.occurrence_id))) {
        fail(`Subtask ${String(s.id)} belongs to an occurrence that is not in the backup.`);
      }
      if (s.parent_subtask_id !== null && !subtaskIds.has(String(s.parent_subtask_id))) {
        fail(`Subtask ${String(s.id)} references a missing parent subtask.`);
      }
    }

    if (errors.length) {
      throw new ValidationError(`The backup failed validation:\n• ${errors.join('\n• ')}`);
    }
    const backup: BackupFile = {
      app: BACKUP_APP_ID,
      formatVersion: parsed.formatVersion,
      schemaVersion: parsed.schemaVersion,
      exportedAt: parsed.exportedAt,
      timeZone: typeof parsed.timeZone === 'string' ? parsed.timeZone : 'unknown',
      data,
    };
    return { backup, summary: summarize(backup), warnings };
  }

  /** Current data in summary form, for the overwrite confirmation. */
  async currentSummary(): Promise<BackupSummary> {
    return summarize(await this.export());
  }

  /**
   * Replaces all data with the backup's. Returns the notification ids that
   * were scheduled for the replaced data so the caller can cancel them.
   */
  async restore(validated: ValidatedBackup): Promise<{ staleNotificationIds: string[] }> {
    const { data } = validated.backup;
    return this.db.transaction(async (tx) => {
      const stale = (await tx.find('reminders'))
        .map((r) => r.notification_id)
        .filter((id): id is string => typeof id === 'string');
      const deviceSettings = (await tx.find('app_settings')).filter((r) => DEVICE_SETTING_KEYS.has(String(r.id)));

      for (const table of [...TABLE_INSERT_ORDER].reverse()) await tx.deleteWhere(table, {});
      for (const table of BACKUP_TABLES) {
        for (const row of data[table]) {
          if (table === 'app_settings' && DEVICE_SETTING_KEYS.has(String(row.id))) continue;
          await tx.insert(table, row);
        }
      }
      for (const row of deviceSettings) await tx.insert('app_settings', row);

      // A restore defines the category set; never re-seed defaults on top of it.
      await createRepos(tx).settings.set('categoriesSeeded', true, nowIso(this.clock));
      return { staleNotificationIds: stale };
    });
  }
}
