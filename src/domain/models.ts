import { DEFAULT_BRANDING, type AppBranding } from './branding';
import { DEFAULT_NAVIGATION, type NavigationPrefs } from './navigationPrefs';

export type ItemKind = 'task' | 'event';
export type Priority = 'low' | 'medium' | 'high' | 'urgent';
/** `missed`: a past recurring instance superseded by a newer instance of the same series. */
export type OccurrenceStatus = 'pending' | 'completed' | 'cancelled' | 'missed';
export type OccurrenceSource = 'manual' | 'recurrence' | 'carry_forward';
export type Frequency = 'daily' | 'weekly' | 'monthly' | 'yearly';
export type ThemePreference = 'system' | 'light' | 'dark';

/** Persisted palette id — keep in sync with `src/theme/themeTypes.ThemePresetId`. */
export type ThemePresetId =
  | 'ocean-blue'
  | 'midnight-navy'
  | 'emerald-green'
  | 'forest-green'
  | 'purple'
  | 'sunset-orange'
  | 'rose-pink'
  | 'minimal-gray'
  | 'classic-light'
  | 'dark-mode';

/** Partial semantic color overrides stored as hex strings. */
export type ThemeCustomColors = Partial<
  Record<
    | 'primary'
    | 'secondary'
    | 'accent'
    | 'background'
    | 'surface'
    | 'surfaceVariant'
    | 'text'
    | 'textSecondary'
    | 'border'
    | 'outline'
    | 'success'
    | 'warning'
    | 'error'
    | 'info'
    | 'completed'
    | 'pending'
    | 'overdue'
    | 'disabled',
    string
  >
>;

export interface ThemeLastUsed {
  theme: ThemePreference;
  themePreset: ThemePresetId;
  themeCustomColors: ThemeCustomColors | null;
}
export type ReminderKind = 'deadline' | 'start' | 'custom';
export type HistoryEventType =
  | 'created'
  | 'completed'
  | 'reopened'
  | 'carried_forward'
  | 'deleted'
  | 'date_changed'
  | 'missed'
  | 'restored';

export const PRIORITIES: Priority[] = ['low', 'medium', 'high', 'urgent'];
export const PRIORITY_RANK: Record<Priority, number> = { urgent: 4, high: 3, medium: 2, low: 1 };

/** Civil calendar date `YYYY-MM-DD` in the device's local zone. */
export type DateKey = string;
/** Local wall-clock time `HH:mm`. */
export type TimeOfDay = string;

export interface Category {
  id: string;
  name: string;
  color: string;
  isDefault: boolean;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
}

export interface RecurringRule {
  id: string;
  frequency: Frequency;
  interval: number;
  /** ISO weekdays, Mon=1 … Sun=7. Used by weekly rules. */
  byWeekday: number[] | null;
  /** Day of month for monthly rules (clamped to month length). */
  byMonthday: number | null;
  startDate: DateKey;
  endDate: DateKey | null;
  timezone: string;
  /** Last civil date for which instances have been generated. */
  generatedUntil: DateKey | null;
  createdAt: string;
  updatedAt: string;
}

export type FolderStatus = 'active' | 'archived' | 'completed';

export interface Folder {
  id: string;
  name: string;
  description: string;
  color: string;
  icon: string;
  /** Project deadline (civil date). Never an occurrence date. */
  targetDate: DateKey | null;
  priority: Priority;
  status: FolderStatus;
  sortOrder: number;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface Task {
  id: string;
  kind: ItemKind;
  title: string;
  notes: string;
  categoryId: string | null;
  /** Optional project. At most one. Categories stay independent. */
  folderId: string | null;
  priority: Priority;
  /**
   * False when the task inherits its folder's priority.
   * Explicit priority is never rewritten by folder updates.
   * Missing on hand-built fixtures means explicit.
   */
  priorityExplicit: boolean;
  allDay: boolean;
  defaultStartTime: TimeOfDay | null;
  defaultEndTime: TimeOfDay | null;
  /** Absolute ISO-8601 instant; independent of the assigned date. */
  deadlineAt: string | null;
  recurringRuleId: string | null;
  seriesId: string | null;
  reminderOffsetMinutes: number | null;
  deadlineReminderOffsetMinutes: number | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface Occurrence {
  id: string;
  taskId: string;
  date: DateKey;
  startTime: TimeOfDay | null;
  endTime: TimeOfDay | null;
  status: OccurrenceStatus;
  completedAt: string | null;
  isCarriedForward: boolean;
  carryForwardCount: number;
  source: OccurrenceSource;
  recurrenceInstanceKey: string | null;
  originalDate: DateKey | null;
  isException: boolean;
  titleOverride: string | null;
  notesOverride: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface Reminder {
  id: string;
  taskId: string;
  occurrenceId: string | null;
  triggerAt: string;
  kind: ReminderKind;
  offsetMinutes: number | null;
  notificationId: string | null;
  enabled: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface HistoryEntry {
  id: string;
  taskId: string;
  occurrenceId: string | null;
  eventType: HistoryEventType;
  fromDate: DateKey | null;
  toDate: DateKey | null;
  payload: Record<string, unknown> | null;
  createdAt: string;
}

/**
 * Nested checklist item under a single occurrence (not a separate agenda row).
 * Completion is independent of the parent occurrence. Carry-forward moves the
 * occurrence in place, so subtasks ride along without a separate rollover.
 */
export interface Subtask {
  id: string;
  occurrenceId: string;
  parentSubtaskId: string | null;
  title: string;
  notes: string;
  sortOrder: number;
  completed: boolean;
  completedAt: string | null;
  /** Optional due instant (ISO UTC). Independent of the parent task deadline. */
  deadlineAt: string | null;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
}

export interface SubtaskNode extends Subtask {
  depth: number;
  children: SubtaskNode[];
}

export interface AppSettings {
  autoCarryForward: boolean;
  /** Appearance mode: system / light / dark. */
  theme: ThemePreference;
  /** Named palette preset. */
  themePreset: ThemePresetId;
  /** User color overrides (HEX). Null when using the preset as-is. */
  themeCustomColors: ThemeCustomColors | null;
  /** Snapshot for Theme Settings → Restore Last Used. */
  themeLastUsed: ThemeLastUsed | null;
  defaultReminderOffsetMinutes: number | null;
  lastCarryForwardRunDate: DateKey | null;
  notificationsEnabled: boolean;
  lastBackupAt: string | null;
  categoriesSeeded: boolean;
  /** Hamburger drawer: on/off, visible shortcuts, and their order. */
  navigation: NavigationPrefs;
  /** Header wordmark or a logo stored as bytes in app_settings. */
  branding: AppBranding;
  /** Tasks list only. Empty folders always remain on the Folders page. */
  showEmptyFoldersOnTasks: boolean;
  /** Today / Week folder cards start collapsed when true. Manual expand still works. */
  collapseFoldersByDefault: boolean;
}

export const DEFAULT_SETTINGS: AppSettings = {
  autoCarryForward: true,
  theme: 'system',
  themePreset: 'classic-light',
  themeCustomColors: null,
  themeLastUsed: null,
  defaultReminderOffsetMinutes: 15,
  lastCarryForwardRunDate: null,
  notificationsEnabled: true,
  lastBackupAt: null,
  categoriesSeeded: false,
  navigation: DEFAULT_NAVIGATION,
  branding: DEFAULT_BRANDING,
  showEmptyFoldersOnTasks: false,
  collapseFoldersByDefault: true,
};

/** An occurrence joined with its parent definition — what most screens render. */
export interface Agenda {
  occurrence: Occurrence;
  task: Task;
  rule: RecurringRule | null;
  category: Category | null;
  /** Nested checklist for this occurrence (empty for events). */
  subtasks: SubtaskNode[];
  /** Project this task belongs to, when the agenda query loaded it. */
  folder?: Folder | null;
  /**
   * Completion / carry / reschedule history for the parent task, when the
   * agenda query loaded it. Detail screens always have this. Used to place
   * "overdue since" on a real earlier lapse instead of only the current date.
   */
  history?: HistoryEntry[];
}

export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class NotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NotFoundError';
  }
}
