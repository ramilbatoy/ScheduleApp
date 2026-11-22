import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

type Clock = Awaited<ReturnType<typeof makeApp>>['clock'];

describe.each(DRIVERS)('carry-forward (%s)', (_name, open) => {
  let app: AppServices;
  let clock: Clock;
  beforeEach(async () => {
    ({ app, clock } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  async function nextDay(date: string) {
    clock.set(`${date}T08:00:00`);
    return app.runMaintenance();
  }

  it('moves an unfinished task to the next day, preserving creation date, deadline and history', async () => {
    const occ = await app.tasks.create(item({ deadlineAt: '2026-03-20T10:00:00.000Z' }));
    const before = await app.tasks.getDetail(occ.id);
    const r = await nextDay('2026-03-11');
    expect(r.carry).toMatchObject({ ran: true, moved: 1 });
    const d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ date: '2026-03-11', isCarriedForward: true, carryForwardCount: 1, originalDate: '2026-03-10', status: 'pending' });
    expect(d.task.createdAt).toBe(before.task.createdAt);
    expect(d.task.deadlineAt).toBe('2026-03-20T10:00:00.000Z');
    expect(d.history.filter((h) => h.eventType === 'carried_forward')).toEqual([
      expect.objectContaining({ fromDate: '2026-03-10', toDate: '2026-03-11' }),
    ]);
  });

  it('keeps moving daily until completed, counting every day', async () => {
    const occ = await app.tasks.create(item());
    await nextDay('2026-03-11');
    await nextDay('2026-03-12');
    expect((await app.tasks.getDetail(occ.id)).occurrence.carryForwardCount).toBe(2);
    await app.tasks.complete(occ.id);
    await nextDay('2026-03-13');
    const d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ date: '2026-03-12', status: 'completed', carryForwardCount: 2 });
  });

  it('catches up multiple missed days in one run and counts each day', async () => {
    const occ = await app.tasks.create(item());
    await nextDay('2026-03-14');
    expect((await app.tasks.getDetail(occ.id)).occurrence).toMatchObject({ date: '2026-03-14', carryForwardCount: 4 });
  });

  it('is idempotent: repeated and concurrent runs never duplicate or double-count', async () => {
    const occ = await app.tasks.create(item());
    clock.set('2026-03-11T08:00:00');
    await Promise.all([app.carryForward.runAuto(), app.carryForward.runAuto(), app.runMaintenance()]);
    await app.carryForward.run();
    const d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence.carryForwardCount).toBe(1);
    expect(d.history.filter((h) => h.eventType === 'carried_forward')).toHaveLength(1);
    expect(await app.agenda.day('2026-03-11')).toHaveLength(1);
    expect(await app.agenda.list()).toHaveLength(1);
  });

  it('never moves completed, deleted or event items', async () => {
    const done = await app.tasks.create(item({ title: 'done' }));
    const gone = await app.tasks.create(item({ title: 'gone' }));
    const meeting = await app.tasks.create(item({ title: 'meeting', kind: 'event', startTime: '10:00' }));
    await app.tasks.complete(done.id);
    await app.tasks.delete(gone.id, 'series');
    await nextDay('2026-03-11');
    expect(await app.agenda.day('2026-03-11')).toHaveLength(0);
    expect((await app.agenda.day('2026-03-10')).map((a) => a.task.title).sort()).toEqual(['done', 'meeting']);
  });

  it('respects a manual date change to the future', async () => {
    const occ = await app.tasks.create(item());
    await app.tasks.changeDate(occ.id, '2026-03-15');
    await nextDay('2026-03-11');
    const d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ date: '2026-03-15', isCarriedForward: false, carryForwardCount: 0 });
  });

  it('does nothing automatically when disabled, but manual carry still works', async () => {
    const occ = await app.tasks.create(item());
    await app.settings.set('autoCarryForward', false);
    const r = await nextDay('2026-03-12');
    expect(r.carry.ran).toBe(false);
    const dash = await app.agenda.dashboard();
    expect(dash.overdue.map((a) => a.occurrence.id)).toEqual([occ.id]);
    // Still visible on today's agenda (display projection) while date stays in the past.
    expect((await app.agenda.day('2026-03-12')).map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect((await app.tasks.getDetail(occ.id)).occurrence.date).toBe('2026-03-10');
    expect(await app.tasks.moveToToday([occ.id])).toBe(1);
    expect((await app.tasks.getDetail(occ.id)).occurrence).toMatchObject({ date: '2026-03-12', carryForwardCount: 2 });
  });

  it('reopening a past completed task carries it to today when auto carry is on', async () => {
    const occ = await app.tasks.create(item());
    await app.tasks.complete(occ.id);
    await nextDay('2026-03-11');
    await app.tasks.reopen(occ.id);
    expect((await app.tasks.getDetail(occ.id)).occurrence).toMatchObject({ date: '2026-03-11', status: 'pending', isCarriedForward: true });
  });

  it('recurring tasks: newest unfinished instance survives, older ones become missed — no duplicates', async () => {
    const first = await app.tasks.create(
      item({ title: 'Stretch', recurrence: { frequency: 'daily', interval: 1, byWeekday: null, byMonthday: null, endDate: null } }),
    );
    await nextDay('2026-03-12');
    const today = await app.agenda.day('2026-03-12');
    expect(today).toHaveLength(1);
    expect(today[0].occurrence.recurrenceInstanceKey).toBe('2026-03-12');
    const d = await app.tasks.getDetail(first.id);
    expect(d.occurrence.status).toBe('missed');
  });

  it('recurring weekly task carries until the next instance arrives', async () => {
    // 2026-03-09 is a Monday.
    const occ = await app.tasks.create(
      item({ date: '2026-03-09', recurrence: { frequency: 'weekly', interval: 1, byWeekday: [1], byMonthday: null, endDate: null } }),
    );
    await nextDay('2026-03-11');
    let d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ date: '2026-03-11', isCarriedForward: true, carryForwardCount: 2, recurrenceInstanceKey: '2026-03-09' });
    await nextDay('2026-03-16');
    d = await app.tasks.getDetail(occ.id);
    expect(d.occurrence.status).toBe('missed');
    expect((await app.agenda.day('2026-03-16')).map((a) => a.occurrence.recurrenceInstanceKey)).toEqual(['2026-03-16']);
  });
});
