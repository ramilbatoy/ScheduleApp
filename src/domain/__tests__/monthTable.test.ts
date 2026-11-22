import { anchorForMonthYear, cellTaskPreview, groupAgendaByDate, isSameMonth, jumpAnchorToMonth, parseYearMonth } from '@/domain/monthTable';
import type { Agenda } from '@/domain/models';

function stubAgenda(id: string, date: string, title: string): Agenda {
  return {
    task: {
      id: `t-${id}`,
      kind: 'task',
      title,
      notes: '',
      categoryId: null,
      folderId: null,
      priority: 'medium',
      priorityExplicit: true,
      allDay: false,
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
    },
    occurrence: {
      id,
      taskId: `t-${id}`,
      date,
      startTime: null,
      endTime: null,
      status: 'pending',
      source: 'manual',
      titleOverride: null,
      notesOverride: null,
      isCarriedForward: false,
      carryForwardCount: 0,
      originalDate: null,
      recurrenceInstanceKey: null,
      isException: false,
      completedAt: null,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    category: null,
    rule: null,
    subtasks: [],
  };
}

describe('monthTable helpers', () => {
  it('groups agenda items by occurrence date', () => {
    const a = stubAgenda('1', '2026-11-01', 'One');
    const b = stubAgenda('2', '2026-11-01', 'Two');
    const c = stubAgenda('3', '2026-11-02', 'Three');
    expect(groupAgendaByDate([a, b, c])).toEqual({
      '2026-11-01': [a, b],
      '2026-11-02': [c],
    });
  });

  it('builds month/year anchors and clamps day', () => {
    expect(anchorForMonthYear(2026, 11, 15)).toBe('2026-11-15');
    expect(anchorForMonthYear(2026, 2, 31)).toBe('2026-02-28');
    expect(anchorForMonthYear(2024, 2, 31)).toBe('2024-02-29');
    expect(jumpAnchorToMonth('2026-01-31', 2026, 2)).toBe('2026-02-28');
    expect(parseYearMonth('2026-11-22')).toEqual({ year: 2026, month: 11 });
    expect(isSameMonth('2026-11-01', '2026-11-30')).toBe(true);
    expect(isSameMonth('2026-11-01', '2026-12-01')).toBe(false);
  });

  it('previews main tasks for a cell', () => {
    const items = [stubAgenda('1', '2026-11-01', 'A'), stubAgenda('2', '2026-11-01', 'B'), stubAgenda('3', '2026-11-01', 'C'), stubAgenda('4', '2026-11-01', 'D')];
    expect(cellTaskPreview(items, 3)).toEqual({
      shown: items.slice(0, 3),
      more: 1,
      titles: ['A', 'B', 'C'],
    });
    expect(cellTaskPreview(items, 0)).toEqual({ shown: [], more: 4, titles: [] });
  });

  it('rejects invalid month/year', () => {
    expect(() => anchorForMonthYear(2026, 0)).toThrow(/month/i);
    expect(() => anchorForMonthYear(0, 1)).toThrow(/year/i);
  });
});
