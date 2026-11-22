import { NotFoundError, ValidationError } from '../models';
import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

describe.each(DRIVERS)('task & event CRUD (%s)', (_name, open) => {
  let app: AppServices;
  beforeEach(async () => {
    ({ app } = await makeApp(open));
  });

  it('creates a task with one pending occurrence and a history entry', async () => {
    const cats = await app.categories.list();
    const occ = await app.tasks.create(item({ title: '  Pay rent ', categoryId: cats[0].id, priority: 'urgent' }));
    const d = await app.tasks.getDetail(occ.id);
    expect(d.task).toMatchObject({ title: 'Pay rent', priority: 'urgent', kind: 'task', categoryId: cats[0].id });
    expect(d.occurrence).toMatchObject({ date: '2026-03-10', status: 'pending', source: 'manual', carryForwardCount: 0 });
    expect(d.history.map((h) => h.eventType)).toEqual(['created']);
    expect(await app.agenda.day('2026-03-10')).toHaveLength(1);
  });

  it('creates a timed event and an all-day event', async () => {
    const timed = await app.tasks.create(item({ kind: 'event', title: 'Standup', startTime: '09:30', endTime: '09:45' }));
    const allDay = await app.tasks.create(item({ kind: 'event', title: 'Holiday', allDay: true, startTime: '10:00' }));
    expect(timed).toMatchObject({ startTime: '09:30', endTime: '09:45' });
    expect(allDay).toMatchObject({ startTime: null, endTime: null });
    const day = await app.agenda.day('2026-03-10');
    expect(day.map((a) => a.task.title)).toEqual(['Holiday', 'Standup']);
  });

  it('validates input', async () => {
    await expect(app.tasks.create(item({ title: ' ' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(app.tasks.create(item({ date: '2026-02-30' }))).rejects.toBeInstanceOf(ValidationError);
    await expect(app.tasks.create(item({ startTime: '10:00', endTime: '09:00' }))).rejects.toThrow(/after the start/);
    await expect(app.tasks.create(item({ deadlineReminderOffsetMinutes: 30 }))).rejects.toThrow(/deadline/);
    await expect(app.tasks.create(item({ categoryId: 'missing' }))).rejects.toThrow(/category/);
    await expect(
      app.tasks.create(item({ recurrence: { frequency: 'weekly', interval: 1, byWeekday: [], byMonthday: null, endDate: null } })),
    ).rejects.toThrow(/weekday/);
  });

  it('edits fields and the date, recording the date change', async () => {
    const occ = await app.tasks.create(item());
    const values = await app.tasks.formValues(occ.id, 'occurrence');
    await app.tasks.update(occ.id, { ...values, title: 'Write final report', priority: 'high', date: '2026-03-12', notes: 'v2' }, 'occurrence');
    const d = await app.tasks.getDetail(occ.id);
    expect(d.task).toMatchObject({ title: 'Write final report', priority: 'high', notes: 'v2' });
    expect(d.occurrence.date).toBe('2026-03-12');
    expect(d.task.createdAt).toBe(new Date('2026-03-10T09:00:00').toISOString());
    expect(d.history.map((h) => h.eventType)).toEqual(['created', 'date_changed']);
  });

  it('completes and reopens, keeping completion timestamps and history', async () => {
    const occ = await app.tasks.create(item());
    await app.tasks.complete(occ.id);
    let d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence.status).toBe('completed');
    expect(d.occurrence.completedAt).not.toBeNull();
    await app.tasks.complete(occ.id); // idempotent
    await app.tasks.reopen(occ.id);
    d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ status: 'pending', completedAt: null });
    expect(d.history.map((h) => h.eventType)).toEqual(['created', 'completed', 'reopened']);
  });

  it('deletes softly: hidden from lists, history kept, detail reports deletion', async () => {
    const occ = await app.tasks.create(item());
    await app.tasks.delete(occ.id, 'series');
    expect(await app.agenda.day('2026-03-10')).toHaveLength(0);
    expect(await app.agenda.list()).toHaveLength(0);
    await expect(app.tasks.getDetail(occ.id)).rejects.toBeInstanceOf(NotFoundError);
  });

  it('keeps deadlines independent of the assigned date', async () => {
    const occ = await app.tasks.create(item({ deadlineAt: '2026-03-20T17:00:00.000Z' }));
    await app.tasks.changeDate(occ.id, '2026-03-15');
    const d = await app.tasks.getDetail(occ.id);
    expect(d.task.deadlineAt).toBe('2026-03-20T17:00:00.000Z');
    expect(d.occurrence.date).toBe('2026-03-15');
  });
});
