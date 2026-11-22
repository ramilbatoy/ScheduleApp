import type { Agenda, HistoryEntry, OccurrenceStatus } from '../models';
import {
  deadlineDateKey,
  formatOverdueDetail,
  formatOverdueLabels,
  matchesNearDueWindow,
  overdueTimeline,
  weeklyGoalItems,
} from '../services/agendaService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

function atLocal(y: number, m: number, d: number, hh = 8, mm = 0): string {
  return new Date(y, m - 1, d, hh, mm).toISOString();
}

function agenda(opts: {
  id?: string;
  date: string;
  originalDate?: string | null;
  status?: OccurrenceStatus;
  kind?: 'task' | 'event';
  deadlineAt?: string | null;
  carried?: boolean;
  carryCount?: number;
  priority?: Agenda['task']['priority'];
  history?: HistoryEntry[];
}): Agenda {
  const id = opts.id ?? 'o1';
  return {
    task: {
      id: 't1',
      kind: opts.kind ?? 'task',
      title: 'Task',
      notes: '',
      categoryId: null,
      folderId: null,
      priority: opts.priority ?? 'medium',
      priorityExplicit: true,
      allDay: true,
      defaultStartTime: null,
      defaultEndTime: null,
      deadlineAt: opts.deadlineAt ?? null,
      recurringRuleId: null,
      seriesId: null,
      reminderOffsetMinutes: null,
      deadlineReminderOffsetMinutes: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
      deletedAt: null,
    },
    occurrence: {
      id,
      taskId: 't1',
      date: opts.date,
      startTime: null,
      endTime: null,
      status: opts.status ?? 'pending',
      completedAt: null,
      isCarriedForward: opts.carried ?? false,
      carryForwardCount: opts.carryCount ?? 0,
      source: 'manual',
      recurrenceInstanceKey: null,
      originalDate: opts.originalDate === undefined ? opts.date : opts.originalDate,
      isException: false,
      titleOverride: null,
      notesOverride: null,
      createdAt: '2026-03-01T00:00:00.000Z',
      updatedAt: '2026-03-01T00:00:00.000Z',
    },
    category: null,
    rule: null,
    subtasks: [],
    history: opts.history,
  };
}

function history(partial: Partial<HistoryEntry> & Pick<HistoryEntry, 'eventType'>): HistoryEntry {
  return {
    id: partial.id ?? 'h1',
    taskId: 't1',
    occurrenceId: partial.occurrenceId === undefined ? 'o1' : partial.occurrenceId,
    eventType: partial.eventType,
    fromDate: partial.fromDate ?? null,
    toDate: partial.toDate ?? null,
    payload: partial.payload ?? null,
    createdAt: partial.createdAt ?? atLocal(2026, 3, 4, 9),
  };
}

const NOW = new Date(2026, 2, 5, 9, 0);
const TODAY = '2026-03-05';

describe('overdueTimeline', () => {
  it('uses the original date as the start and the next day as overdue-since', () => {
    const line = overdueTimeline(agenda({ date: '2026-03-01', originalDate: '2026-03-01' }), TODAY, NOW);
    expect(line).toMatchObject({
      startedOn: '2026-03-01',
      overdueSince: '2026-03-02',
      daysOverdue: 3,
      datePassed: true,
      deadlinePassed: false,
    });
    expect(formatOverdueLabels(line!, TODAY)).toEqual({
      started: 'Started Mar 1',
      overdue: 'Overdue since Mar 2 · 3 days',
    });
    expect(formatOverdueDetail(line!)).toEqual({
      started: 'Sunday, Mar 1, 2026',
      overdue: 'Overdue since Monday, Mar 2, 2026 · 3 days',
    });
  });

  it('falls back to the occurrence date when original_occurrence_date is missing', () => {
    const line = overdueTimeline(agenda({ date: '2026-03-04', originalDate: null }), TODAY, NOW);
    expect(line).toMatchObject({ startedOn: '2026-03-04', overdueSince: '2026-03-05', daysOverdue: 0 });
    expect(formatOverdueLabels(line!, TODAY).overdue).toBe('Overdue since Mar 5');
  });

  it('returns null unless the item is actually overdue', () => {
    expect(overdueTimeline(agenda({ date: TODAY }), TODAY, NOW)).toBeNull();
    expect(overdueTimeline(agenda({ date: '2026-03-01', status: 'completed' }), TODAY, NOW)).toBeNull();
    expect(overdueTimeline(agenda({ date: '2026-03-01', kind: 'event' }), TODAY, NOW)).toBeNull();
  });

  it('uses the deadline local date when that is the earlier lapse', () => {
    const line = overdueTimeline(
      agenda({ date: '2026-03-20', deadlineAt: atLocal(2026, 3, 1, 8) }),
      TODAY,
      NOW,
    );
    expect(deadlineDateKey(atLocal(2026, 3, 1, 8))).toBe('2026-03-01');
    expect(line).toMatchObject({
      startedOn: '2026-03-20',
      overdueSince: '2026-03-01',
      daysOverdue: 4,
      datePassed: false,
      deadlinePassed: true,
    });
    expect(formatOverdueLabels(line!, TODAY).overdue).toBe('Past deadline since Mar 1 · 4 days');
  });

  it('keeps the assigned-day lapse when it is earlier than the deadline', () => {
    const line = overdueTimeline(
      agenda({ date: '2026-03-01', deadlineAt: atLocal(2026, 3, 4, 8) }),
      TODAY,
      NOW,
    );
    expect(line).toMatchObject({ overdueSince: '2026-03-02', datePassed: true, deadlinePassed: true });
  });

  it('treats a carry that spans exactly back to the original date as that lapse', () => {
    const line = overdueTimeline(
      agenda({
        date: TODAY,
        originalDate: '2026-03-01',
        carried: true,
        carryCount: 4,
        deadlineAt: atLocal(2026, 3, 4, 8),
      }),
      TODAY,
      NOW,
    );
    expect(line).toMatchObject({ startedOn: '2026-03-01', overdueSince: '2026-03-02', datePassed: true });
  });

  it('does not invent an original lapse when carry count does not match that span', () => {
    const line = overdueTimeline(
      agenda({
        date: '2026-03-06',
        originalDate: '2026-03-01',
        carried: true,
        carryCount: 3,
        deadlineAt: atLocal(2026, 3, 5, 8),
      }),
      '2026-03-06',
      new Date(2026, 2, 6, 9, 0),
    );
    expect(line).toMatchObject({ startedOn: '2026-03-01', overdueSince: '2026-03-05', datePassed: false });
  });

  it('moves overdue-since earlier from carry and late reschedule history', () => {
    const carried = overdueTimeline(
      agenda({
        date: TODAY,
        deadlineAt: atLocal(2026, 3, 4, 8),
        history: [history({ eventType: 'carried_forward', fromDate: '2026-03-01', toDate: TODAY })],
      }),
      TODAY,
      NOW,
    );
    expect(carried?.overdueSince).toBe('2026-03-02');

    const rescheduled = overdueTimeline(
      agenda({
        date: '2026-03-03',
        originalDate: '2026-03-01',
        history: [
          history({
            eventType: 'date_changed',
            fromDate: '2026-03-01',
            toDate: '2026-03-03',
            createdAt: atLocal(2026, 3, 4, 9),
          }),
        ],
      }),
      TODAY,
      NOW,
    );
    expect(rescheduled).toMatchObject({ startedOn: '2026-03-01', overdueSince: '2026-03-02' });
  });

  it('ignores a same-day reschedule and history for a different occurrence', () => {
    const sameDay = overdueTimeline(
      agenda({
        date: '2026-03-03',
        history: [
          history({
            eventType: 'date_changed',
            fromDate: '2026-03-01',
            toDate: '2026-03-03',
            createdAt: atLocal(2026, 3, 1, 15),
          }),
        ],
      }),
      TODAY,
      NOW,
    );
    expect(sameDay?.overdueSince).toBe('2026-03-04');

    const other = overdueTimeline(
      agenda({
        date: '2026-03-03',
        history: [history({ eventType: 'carried_forward', occurrenceId: 'other', fromDate: '2026-03-01', toDate: '2026-03-02' })],
      }),
      TODAY,
      NOW,
    );
    expect(other?.overdueSince).toBe('2026-03-04');
  });

  it('includes the year when the lapse is not in the current year', () => {
    const line = overdueTimeline(agenda({ date: '2025-12-01', originalDate: '2025-12-01' }), '2026-01-02', new Date(2026, 0, 2, 9, 0));
    expect(formatOverdueLabels(line!, '2026-01-02')).toEqual({
      started: 'Started Dec 1, 2025',
      overdue: 'Overdue since Dec 2, 2025 · 31 days',
    });
  });
});

describe('near-due window and weekly goals', () => {
  it('matches a deadline by local civil date, including just after local midnight', () => {
    const due = atLocal(2026, 3, 10, 0, 30);
    const a = agenda({ date: '2026-03-20', deadlineAt: due });
    expect(deadlineDateKey(due)).toBe('2026-03-10');
    expect(matchesNearDueWindow(a, 'today', '2026-03-10', '2026-03-09', '2026-03-15')).toBe(true);
    expect(matchesNearDueWindow(a, 'today', '2026-03-09', '2026-03-09', '2026-03-15')).toBe(false);
    expect(matchesNearDueWindow(a, 'week', '2026-03-12', '2026-03-09', '2026-03-15')).toBe(true);
    expect(matchesNearDueWindow(a, 'any', '2026-03-01', '2026-03-01', '2026-03-07')).toBe(true);
  });

  it('pulls pre-week overdue tasks into the current week goals only', () => {
    const late = agenda({ id: 'late', date: '2026-03-01', priority: 'urgent' });
    const weekTask = agenda({ id: 'week', date: '2026-03-11', priority: 'low' });
    const goals = weeklyGoalItems([weekTask], [late], '2026-03-09', '2026-03-15', '2026-03-12');
    expect(goals.map((a) => a.occurrence.id)).toEqual(['late', 'week']);

    const pastWeek = weeklyGoalItems([weekTask], [late], '2026-03-02', '2026-03-08', '2026-03-12');
    expect(pastWeek.map((a) => a.occurrence.id)).toEqual(['week']);
  });
});

describe.each(DRIVERS)('overdue dates persist (%s)', (_name, open) => {
  it('reports started and overdue-since from the stored occurrence', async () => {
    const { app, clock } = await makeApp(open, '2026-03-01T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ title: 'Left behind', date: '2026-03-01' }));
    clock.set('2026-03-05T08:00:00');
    await app.runMaintenance();

    const [row] = await app.agenda.day('2026-03-05');
    expect(row.occurrence).toMatchObject({ id: occ.id, date: '2026-03-01', originalDate: '2026-03-01' });
    expect(overdueTimeline(row, '2026-03-05', clock.now())).toMatchObject({
      startedOn: '2026-03-01',
      overdueSince: '2026-03-02',
      daysOverdue: 3,
    });
  });

  it('uses a late reschedule in history so overdue-since stays on the first lapse', async () => {
    const { app, clock } = await makeApp(open, '2026-03-01T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ date: '2026-03-01' }));
    clock.set('2026-03-04T09:00:00');
    await app.tasks.changeDate(occ.id, '2026-03-03');

    const detail = await app.tasks.getDetail(occ.id);
    expect(detail.history.map((h) => h.eventType)).toContain('date_changed');
    expect(overdueTimeline(detail, '2026-03-04', clock.now())).toMatchObject({
      startedOn: '2026-03-01',
      overdueSince: '2026-03-02',
    });
  });

  it('backfills a missing original date only when the occurrence was never carried', async () => {
    const { app } = await makeApp(open, '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ date: '2026-03-10' }));
    await app.db.update('task_occurrences', occ.id, { original_occurrence_date: null });
    await app.runMaintenance();
    expect((await app.tasks.getDetail(occ.id)).occurrence.originalDate).toBe('2026-03-10');

    await app.db.update('task_occurrences', occ.id, {
      original_occurrence_date: null,
      is_carried_forward: 1,
      carry_forward_count: 2,
    });
    await app.runMaintenance();
    expect((await app.tasks.getDetail(occ.id)).occurrence.originalDate).toBeNull();
  });
});
