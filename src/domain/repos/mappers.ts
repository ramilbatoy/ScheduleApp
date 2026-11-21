import type { Row } from '../../db/types';
import type {
  Category,
  HistoryEntry,
  Occurrence,
  RecurringRule,
  Reminder,
  Task,
} from '../models';

const s = (v: unknown) => (v === null || v === undefined ? null : String(v));
const n = (v: unknown) => (v === null || v === undefined ? null : Number(v));
const b = (v: unknown) => Number(v) === 1;
const bi = (v: boolean) => (v ? 1 : 0);

function parseJson<T>(v: unknown): T | null {
  if (v === null || v === undefined || v === '') return null;
  try {
    return JSON.parse(String(v)) as T;
  } catch {
    return null;
  }
}

export const categoryMapper = {
  from: (r: Row): Category => ({
    id: String(r.id),
    name: String(r.name),
    color: String(r.color),
    isDefault: b(r.is_default),
    sortOrder: Number(r.sort_order),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }),
  to: (c: Category): Row => ({
    id: c.id,
    name: c.name,
    color: c.color,
    is_default: bi(c.isDefault),
    sort_order: c.sortOrder,
    created_at: c.createdAt,
    updated_at: c.updatedAt,
  }),
};

export const ruleMapper = {
  from: (r: Row): RecurringRule => ({
    id: String(r.id),
    frequency: r.frequency as RecurringRule['frequency'],
    interval: Number(r.interval),
    byWeekday: parseJson<number[]>(r.by_weekday),
    byMonthday: n(r.by_monthday),
    startDate: String(r.start_date),
    endDate: s(r.end_date),
    timezone: String(r.timezone),
    generatedUntil: s(r.generated_until),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }),
  to: (x: RecurringRule): Row => ({
    id: x.id,
    frequency: x.frequency,
    interval: x.interval,
    by_weekday: x.byWeekday ? JSON.stringify(x.byWeekday) : null,
    by_monthday: x.byMonthday,
    start_date: x.startDate,
    end_date: x.endDate,
    timezone: x.timezone,
    generated_until: x.generatedUntil,
    created_at: x.createdAt,
    updated_at: x.updatedAt,
  }),
};

export const taskMapper = {
  from: (r: Row): Task => ({
    id: String(r.id),
    kind: r.item_kind as Task['kind'],
    title: String(r.title),
    notes: String(r.notes ?? ''),
    categoryId: s(r.category_id),
    priority: r.priority as Task['priority'],
    allDay: b(r.all_day),
    defaultStartTime: s(r.default_start_time),
    defaultEndTime: s(r.default_end_time),
    deadlineAt: s(r.deadline_at),
    recurringRuleId: s(r.recurring_rule_id),
    seriesId: s(r.series_id),
    reminderOffsetMinutes: n(r.reminder_offset_minutes),
    deadlineReminderOffsetMinutes: n(r.deadline_reminder_offset_minutes),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
    deletedAt: s(r.deleted_at),
  }),
  to: (t: Task): Row => ({
    id: t.id,
    item_kind: t.kind,
    title: t.title,
    notes: t.notes,
    category_id: t.categoryId,
    priority: t.priority,
    all_day: bi(t.allDay),
    default_start_time: t.defaultStartTime,
    default_end_time: t.defaultEndTime,
    deadline_at: t.deadlineAt,
    recurring_rule_id: t.recurringRuleId,
    series_id: t.seriesId,
    reminder_offset_minutes: t.reminderOffsetMinutes,
    deadline_reminder_offset_minutes: t.deadlineReminderOffsetMinutes,
    created_at: t.createdAt,
    updated_at: t.updatedAt,
    deleted_at: t.deletedAt,
  }),
};

export const occurrenceMapper = {
  from: (r: Row): Occurrence => ({
    id: String(r.id),
    taskId: String(r.task_id),
    date: String(r.occurrence_date),
    startTime: s(r.start_time),
    endTime: s(r.end_time),
    status: r.status as Occurrence['status'],
    completedAt: s(r.completed_at),
    isCarriedForward: b(r.is_carried_forward),
    carryForwardCount: Number(r.carry_forward_count ?? 0),
    source: r.source as Occurrence['source'],
    recurrenceInstanceKey: s(r.recurrence_instance_key),
    originalDate: s(r.original_occurrence_date),
    isException: b(r.is_exception),
    titleOverride: s(r.title_override),
    notesOverride: s(r.notes_override),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }),
  to: (o: Occurrence): Row => ({
    id: o.id,
    task_id: o.taskId,
    occurrence_date: o.date,
    start_time: o.startTime,
    end_time: o.endTime,
    status: o.status,
    completed_at: o.completedAt,
    is_carried_forward: bi(o.isCarriedForward),
    carry_forward_count: o.carryForwardCount,
    source: o.source,
    recurrence_instance_key: o.recurrenceInstanceKey,
    original_occurrence_date: o.originalDate,
    is_exception: bi(o.isException),
    title_override: o.titleOverride,
    notes_override: o.notesOverride,
    created_at: o.createdAt,
    updated_at: o.updatedAt,
  }),
};

type Encoder = [column: string, encode?: (v: never) => Row[string]];

function makePatcher<T>(spec: { [K in keyof T]?: Encoder }) {
  return (p: Partial<T>): Row => {
    const out: Row = {};
    for (const [key, value] of Object.entries(p)) {
      const enc = spec[key as keyof T];
      if (!enc || value === undefined) continue;
      const [col, fn] = enc;
      out[col] = fn ? fn(value as never) : (value as Row[string]);
    }
    return out;
  };
}

/** Partial domain patch → partial row containing only the provided fields. */
export const occurrencePatch = makePatcher<Occurrence>({
  taskId: ['task_id'],
  date: ['occurrence_date'],
  startTime: ['start_time'],
  endTime: ['end_time'],
  status: ['status'],
  completedAt: ['completed_at'],
  isCarriedForward: ['is_carried_forward', bi],
  carryForwardCount: ['carry_forward_count'],
  source: ['source'],
  recurrenceInstanceKey: ['recurrence_instance_key'],
  originalDate: ['original_occurrence_date'],
  isException: ['is_exception', bi],
  titleOverride: ['title_override'],
  notesOverride: ['notes_override'],
  updatedAt: ['updated_at'],
});

export const taskPatch = makePatcher<Task>({
  kind: ['item_kind'],
  title: ['title'],
  notes: ['notes'],
  categoryId: ['category_id'],
  priority: ['priority'],
  allDay: ['all_day', bi],
  defaultStartTime: ['default_start_time'],
  defaultEndTime: ['default_end_time'],
  deadlineAt: ['deadline_at'],
  recurringRuleId: ['recurring_rule_id'],
  seriesId: ['series_id'],
  reminderOffsetMinutes: ['reminder_offset_minutes'],
  deadlineReminderOffsetMinutes: ['deadline_reminder_offset_minutes'],
  updatedAt: ['updated_at'],
  deletedAt: ['deleted_at'],
});

export const reminderMapper = {
  from: (r: Row): Reminder => ({
    id: String(r.id),
    taskId: String(r.task_id),
    occurrenceId: s(r.occurrence_id),
    triggerAt: String(r.trigger_at),
    kind: r.kind as Reminder['kind'],
    offsetMinutes: n(r.offset_minutes),
    notificationId: s(r.notification_id),
    enabled: b(r.enabled),
    createdAt: String(r.created_at),
    updatedAt: String(r.updated_at),
  }),
  to: (x: Reminder): Row => ({
    id: x.id,
    task_id: x.taskId,
    occurrence_id: x.occurrenceId,
    trigger_at: x.triggerAt,
    kind: x.kind,
    offset_minutes: x.offsetMinutes,
    notification_id: x.notificationId,
    enabled: bi(x.enabled),
    created_at: x.createdAt,
    updated_at: x.updatedAt,
  }),
};

export const historyMapper = {
  from: (r: Row): HistoryEntry => ({
    id: String(r.id),
    taskId: String(r.task_id),
    occurrenceId: s(r.occurrence_id),
    eventType: r.event_type as HistoryEntry['eventType'],
    fromDate: s(r.from_date),
    toDate: s(r.to_date),
    payload: parseJson<Record<string, unknown>>(r.payload_json),
    createdAt: String(r.created_at),
  }),
  to: (h: HistoryEntry): Row => ({
    id: h.id,
    task_id: h.taskId,
    occurrence_id: h.occurrenceId,
    event_type: h.eventType,
    from_date: h.fromDate,
    to_date: h.toDate,
    payload_json: h.payload ? JSON.stringify(h.payload) : null,
    created_at: h.createdAt,
  }),
};
