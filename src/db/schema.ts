import type { Row } from './types';

export type ColumnType = 'text' | 'integer';

export interface ColumnDef {
  type: ColumnType;
  nullable?: boolean;
}

export interface UniqueDef {
  name: string;
  columns: string[];
  /** Partial-index predicate; must match the SQL `WHERE` in the SQLite migration. */
  when?: (row: Row) => boolean;
}

export interface TableDef {
  columns: Record<string, ColumnDef>;
  unique?: UniqueDef[];
}

const t = (nullable = false): ColumnDef => ({ type: 'text', nullable });
const i = (nullable = false): ColumnDef => ({ type: 'integer', nullable });

export const SCHEMA: Record<string, TableDef> = {
  categories: {
    columns: {
      id: t(),
      name: t(),
      color: t(),
      is_default: i(),
      sort_order: i(),
      created_at: t(),
      updated_at: t(),
    },
  },
  recurring_rules: {
    columns: {
      id: t(),
      frequency: t(),
      interval: i(),
      by_weekday: t(true),
      by_monthday: i(true),
      start_date: t(),
      end_date: t(true),
      timezone: t(),
      generated_until: t(true),
      created_at: t(),
      updated_at: t(),
    },
  },
  tasks: {
    columns: {
      id: t(),
      item_kind: t(),
      title: t(),
      notes: t(),
      category_id: t(true),
      priority: t(),
      all_day: i(),
      default_start_time: t(true),
      default_end_time: t(true),
      deadline_at: t(true),
      recurring_rule_id: t(true),
      series_id: t(true),
      reminder_offset_minutes: i(true),
      deadline_reminder_offset_minutes: i(true),
      created_at: t(),
      updated_at: t(),
      deleted_at: t(true),
    },
  },
  task_occurrences: {
    columns: {
      id: t(),
      task_id: t(),
      occurrence_date: t(),
      start_time: t(true),
      end_time: t(true),
      status: t(),
      completed_at: t(true),
      is_carried_forward: i(),
      carry_forward_count: i(),
      source: t(),
      recurrence_instance_key: t(true),
      original_occurrence_date: t(true),
      is_exception: i(),
      title_override: t(true),
      notes_override: t(true),
      created_at: t(),
      updated_at: t(),
    },
    unique: [
      {
        name: 'ux_occ_task_date_active',
        columns: ['task_id', 'occurrence_date'],
        when: (row) => row.status === 'pending' || row.status === 'completed',
      },
      {
        name: 'ux_occ_task_instance',
        columns: ['task_id', 'recurrence_instance_key'],
        when: (row) => row.recurrence_instance_key !== null,
      },
    ],
  },
  reminders: {
    columns: {
      id: t(),
      task_id: t(),
      occurrence_id: t(true),
      trigger_at: t(),
      kind: t(),
      offset_minutes: i(true),
      notification_id: t(true),
      enabled: i(),
      created_at: t(),
      updated_at: t(),
    },
  },
  completion_history: {
    columns: {
      id: t(),
      task_id: t(),
      occurrence_id: t(true),
      event_type: t(),
      from_date: t(true),
      to_date: t(true),
      payload_json: t(true),
      created_at: t(),
    },
  },
  task_subtasks: {
    columns: {
      id: t(),
      occurrence_id: t(),
      parent_subtask_id: t(true),
      title: t(),
      notes: t(),
      sort_order: i(),
      completed: i(),
      completed_at: t(true),
      created_at: t(),
      updated_at: t(),
      deleted_at: t(true),
    },
  },
  app_settings: {
    columns: {
      id: t(),
      value: t(),
      updated_at: t(),
    },
  },
};

export const TABLES = Object.keys(SCHEMA);

/** Restore order: parents before children so foreign keys resolve. */
export const TABLE_INSERT_ORDER = [
  'app_settings',
  'categories',
  'recurring_rules',
  'tasks',
  'task_occurrences',
  'task_subtasks',
  'reminders',
  'completion_history',
];

export function assertKnownTable(table: string): TableDef {
  const def = SCHEMA[table];
  if (!def) throw new Error(`Unknown table: ${table}`);
  return def;
}

export function assertKnownColumns(table: string, columns: string[]): void {
  const def = assertKnownTable(table);
  for (const c of columns) {
    if (!def.columns[c]) throw new Error(`Unknown column ${table}.${c}`);
  }
}
