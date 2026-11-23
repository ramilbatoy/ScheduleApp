import { addDaysKey } from '@/domain/dates';
import type { Agenda, Occurrence, Task } from '@/domain/models';
import { DATE_STRIP_RADIUS, dateStripWindow, dayProgressFromAgenda, shiftSelectedDate } from '@/ui/components/DateStrip';

describe('dateStripWindow', () => {
  it('returns a fixed civil-date window centered on the selected day', () => {
    const days = dateStripWindow('2026-03-15', 2);
    expect(days).toEqual(['2026-03-13', '2026-03-14', '2026-03-15', '2026-03-16', '2026-03-17']);
    expect(days[Math.floor(days.length / 2)]).toBe('2026-03-15');
  });

  it('uses the default radius without dumping an unbounded list', () => {
    const days = dateStripWindow('2026-11-23');
    expect(days).toHaveLength(DATE_STRIP_RADIUS * 2 + 1);
    expect(days[0]).toBe(addDaysKey('2026-11-23', -DATE_STRIP_RADIUS));
    expect(days[days.length - 1]).toBe(addDaysKey('2026-11-23', DATE_STRIP_RADIUS));
  });

  it('shifts by civil days (no UTC day-shift across local midnight)', () => {
    expect(shiftSelectedDate('2026-03-01', -1)).toBe('2026-02-28');
    expect(shiftSelectedDate('2026-12-31', 1)).toBe('2027-01-01');
  });
});

describe('dayProgressFromAgenda', () => {
  function stub(partial: Partial<Occurrence> & Pick<Occurrence, 'status'>): Agenda {
    const occurrence: Occurrence = {
      id: partial.id ?? 'o',
      taskId: 't',
      date: '2026-03-10',
      startTime: null,
      endTime: null,
      status: partial.status,
      completedAt: null,
      isCarriedForward: partial.isCarriedForward ?? false,
      carryForwardCount: 0,
      source: 'manual',
      recurrenceInstanceKey: null,
      originalDate: null,
      isException: false,
      titleOverride: null,
      notesOverride: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    };
    const task: Task = {
      id: 't',
      kind: 'task',
      title: 'x',
      notes: '',
      categoryId: null,
      folderId: null,
      priority: 'medium',
      priorityExplicit: true,
      allDay: true,
      defaultStartTime: null,
      defaultEndTime: null,
      deadlineAt: null,
      recurringRuleId: null,
      seriesId: null,
      reminderOffsetMinutes: null,
      deadlineReminderOffsetMinutes: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
      deletedAt: null,
    };
    return { occurrence, task, rule: null, category: null, subtasks: [], folder: null, history: [] };
  }

  it('counts completed, total, and pending carried for the selected day slice', () => {
    const items = [
      stub({ id: '1', status: 'completed' }),
      stub({ id: '2', status: 'pending' }),
      stub({ id: '3', status: 'pending', isCarriedForward: true }),
    ];
    expect(dayProgressFromAgenda(items)).toEqual({ completed: 1, total: 3, carried: 1 });
  });
});
