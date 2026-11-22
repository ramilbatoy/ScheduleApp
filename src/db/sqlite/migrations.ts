/**
 * Ordered SQLite migrations. `version` is stored in `PRAGMA user_version`.
 * Each migration runs inside its own transaction. Never edit a shipped
 * migration; append a new one.
 */
export interface SqlMigration {
  version: number;
  name: string;
  statements: string[];
}

export const SQLITE_MIGRATIONS: SqlMigration[] = [
  {
    version: 1,
    name: '001_init',
    statements: [
      `CREATE TABLE categories (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        color TEXT NOT NULL,
        is_default INTEGER NOT NULL DEFAULT 0,
        sort_order INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE recurring_rules (
        id TEXT PRIMARY KEY NOT NULL,
        frequency TEXT NOT NULL CHECK (frequency IN ('daily','weekly','monthly','yearly')),
        interval INTEGER NOT NULL DEFAULT 1 CHECK (interval >= 1),
        by_weekday TEXT,
        by_monthday INTEGER,
        start_date TEXT NOT NULL,
        end_date TEXT,
        timezone TEXT NOT NULL,
        generated_until TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE tasks (
        id TEXT PRIMARY KEY NOT NULL,
        item_kind TEXT NOT NULL CHECK (item_kind IN ('task','event')),
        title TEXT NOT NULL,
        notes TEXT NOT NULL DEFAULT '',
        category_id TEXT REFERENCES categories(id) ON DELETE SET NULL,
        priority TEXT NOT NULL CHECK (priority IN ('low','medium','high','urgent')),
        all_day INTEGER NOT NULL DEFAULT 0,
        default_start_time TEXT,
        default_end_time TEXT,
        deadline_at TEXT,
        recurring_rule_id TEXT REFERENCES recurring_rules(id) ON DELETE SET NULL,
        series_id TEXT,
        reminder_offset_minutes INTEGER,
        deadline_reminder_offset_minutes INTEGER,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        deleted_at TEXT
      )`,
      `CREATE TABLE task_occurrences (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        occurrence_date TEXT NOT NULL,
        start_time TEXT,
        end_time TEXT,
        status TEXT NOT NULL CHECK (status IN ('pending','completed','cancelled','missed')),
        completed_at TEXT,
        is_carried_forward INTEGER NOT NULL DEFAULT 0,
        carry_forward_count INTEGER NOT NULL DEFAULT 0,
        source TEXT NOT NULL CHECK (source IN ('manual','recurrence','carry_forward')),
        recurrence_instance_key TEXT,
        original_occurrence_date TEXT,
        is_exception INTEGER NOT NULL DEFAULT 0,
        title_override TEXT,
        notes_override TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE UNIQUE INDEX ux_occ_task_date_active ON task_occurrences(task_id, occurrence_date)
        WHERE status IN ('pending','completed')`,
      `CREATE UNIQUE INDEX ux_occ_task_instance ON task_occurrences(task_id, recurrence_instance_key)
        WHERE recurrence_instance_key IS NOT NULL`,
      `CREATE TABLE reminders (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
        occurrence_id TEXT REFERENCES task_occurrences(id) ON DELETE CASCADE,
        trigger_at TEXT NOT NULL,
        kind TEXT NOT NULL CHECK (kind IN ('deadline','start','custom')),
        offset_minutes INTEGER,
        notification_id TEXT,
        enabled INTEGER NOT NULL DEFAULT 1,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE TABLE completion_history (
        id TEXT PRIMARY KEY NOT NULL,
        task_id TEXT NOT NULL,
        occurrence_id TEXT,
        event_type TEXT NOT NULL,
        from_date TEXT,
        to_date TEXT,
        payload_json TEXT,
        created_at TEXT NOT NULL
      )`,
      `CREATE TABLE app_settings (
        id TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL,
        updated_at TEXT NOT NULL
      )`,
      `CREATE INDEX ix_occ_date_status ON task_occurrences(occurrence_date, status)`,
      `CREATE INDEX ix_occ_task ON task_occurrences(task_id)`,
      `CREATE INDEX ix_tasks_category ON tasks(category_id)`,
      `CREATE INDEX ix_tasks_rule ON tasks(recurring_rule_id)`,
      `CREATE INDEX ix_tasks_deleted ON tasks(deleted_at)`,
      `CREATE INDEX ix_tasks_deadline ON tasks(deadline_at)`,
      `CREATE INDEX ix_reminders_trigger ON reminders(trigger_at)`,
      `CREATE INDEX ix_reminders_occ ON reminders(occurrence_id)`,
      `CREATE INDEX ix_reminders_task ON reminders(task_id)`,
      `CREATE INDEX ix_history_created ON completion_history(created_at)`,
      `CREATE INDEX ix_history_task ON completion_history(task_id)`,
    ],
  },
];

export const LATEST_SCHEMA_VERSION = SQLITE_MIGRATIONS[SQLITE_MIGRATIONS.length - 1].version;
