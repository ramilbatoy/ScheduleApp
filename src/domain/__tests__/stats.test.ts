import type { AppServices } from '../services/container';
import { periodRange } from '../services/statsService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

type Clock = Awaited<ReturnType<typeof makeApp>>['clock'];

describe('periodRange', () => {
  it('uses Sunday-start weeks and whole calendar months', () => {
    expect(periodRange('day', '2026-03-11')).toEqual({ start: '2026-03-11', end: '2026-03-11' });
    expect(periodRange('week', '2026-03-11')).toEqual({ start: '2026-03-08', end: '2026-03-14' });
    expect(periodRange('month', '2026-02-11')).toEqual({ start: '2026-02-01', end: '2026-02-28' });
  });
});

describe.each(DRIVERS)('statistics (%s)', (_name, open) => {
  let app: AppServices;
  let clock: Clock;
  beforeEach(async () => {
    ({ app, clock } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  it('reports an empty state without dividing by zero', async () => {
    const r = await app.stats.report('day');
    expect(r.period).toMatchObject({ total: 0, completed: 0, completionRate: null, carryMoves: 0 });
    expect(r.trend).toHaveLength(14);
    expect(r.streak).toBe(0);
    expect(r.bestDay).toBeNull();
  });

  it('computes completion rates per period for tasks only', async () => {
    const cats = await app.categories.list();
    const work = cats.find((c) => c.name === 'Work')!;
    const a = await app.tasks.create(item({ title: 'A', categoryId: work.id }));
    await app.tasks.create(item({ title: 'B', categoryId: work.id }));
    const c = await app.tasks.create(item({ title: 'C', date: '2026-03-12' }));
    await app.tasks.create(item({ title: 'D', date: '2026-03-25' }));
    const ev = await app.tasks.create(item({ kind: 'event', title: 'Meeting', startTime: '10:00' }));
    await app.tasks.complete(a.id);
    await app.tasks.complete(c.id);
    await app.tasks.complete(ev.id);
    const cancelled = await app.tasks.create(item({ title: 'Dropped' }));
    await app.tasks.delete(cancelled.id, 'series');

    const day = await app.stats.report('day');
    expect(day.period).toMatchObject({ total: 2, completed: 1, completionRate: 0.5, events: 1, eventsDone: 1 });
    const week = await app.stats.report('week');
    expect(week.period).toMatchObject({ start: '2026-03-08', end: '2026-03-14', total: 3, completed: 2 });
    const month = await app.stats.report('month');
    expect(month.period).toMatchObject({ total: 4, completed: 2, pending: 2 });
    expect(month.categories).toEqual([
      expect.objectContaining({ categoryId: null, name: 'Uncategorized', total: 3, completed: 2 }),
      expect.objectContaining({ name: 'Work', total: 2, completed: 1 }),
    ]);
  });

  it('counts carry-forward moves, days and the most-carried tasks', async () => {
    const t = await app.tasks.create(item({ title: 'Procrastinated' }));
    clock.set('2026-03-13T08:00:00');
    await app.runMaintenance();
    const r = await app.stats.report('week');
    expect(r.period).toMatchObject({ carryMoves: 1, carryDays: 3, total: 1, pending: 1 });
    expect(r.mostCarried).toEqual([expect.objectContaining({ occurrenceId: t.id, title: 'Procrastinated', carryForwardCount: 3 })]);
    expect(r.allTime.carryMoves).toBe(1);
  });

  it('flags pending tasks whose deadline passed as overdue', async () => {
    await app.tasks.create(item({ title: 'Late', deadlineAt: '2026-03-10T08:00:00' }));
    expect((await app.stats.report('day')).period.overdue).toBe(1);
  });

  it('tracks daily trend, streaks, best day and weekday productivity by completion time', async () => {
    for (const [day, n] of [['2026-03-08', 1], ['2026-03-09', 3], ['2026-03-10', 2]] as const) {
      clock.set(`${day}T09:00:00`);
      for (let i = 0; i < n; i++) {
        const o = await app.tasks.create(item({ title: `T${day}-${i}`, date: day }));
        await app.tasks.complete(o.id);
      }
    }
    await app.tasks.create(item({ title: 'open', date: '2026-03-10' }));
    const r = await app.stats.report('week');
    expect(r.streak).toBe(3);
    expect(r.bestDay).toEqual({ date: '2026-03-09', completed: 3 });
    expect(r.weekdays).toEqual([1, 3, 2, 0, 0, 0, 0]);
    const last = r.trend[r.trend.length - 1];
    expect(last).toEqual({ date: '2026-03-10', total: 3, completed: 2 });

    clock.set('2026-03-12T09:00:00');
    expect((await app.stats.report('week')).streak).toBe(0);
  });
});
