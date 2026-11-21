import type { RecurrenceInput } from '../services/taskService';
import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

const daily: RecurrenceInput = { frequency: 'daily', interval: 1, byWeekday: null, byMonthday: null, endDate: null };

describe.each(DRIVERS)('recurring series (%s)', (_name, open) => {
  let app: AppServices;
  let clock: Awaited<ReturnType<typeof makeApp>>['clock'];
  beforeEach(async () => {
    ({ app, clock } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  const dates = async (from: string, to: string, title?: string) =>
    (await app.agenda.range(from, to)).filter((a) => !title || a.task.title === title).map((a) => a.occurrence.date);

  it('generates instances ahead without duplicates on repeated generation', async () => {
    await app.tasks.create(item({ kind: 'event', title: 'Gym', startTime: '07:00', recurrence: { ...daily, endDate: '2026-03-14' } }));
    await app.recurrence.ensureWindow();
    await app.runMaintenance();
    await app.recurrence.ensureThrough('2026-12-31');
    expect(await dates('2026-03-01', '2026-03-31')).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-14']);
  });

  it('lazily generates far-future ranges for calendar navigation', async () => {
    await app.tasks.create(item({ kind: 'event', title: 'Rent', recurrence: { frequency: 'monthly', interval: 1, byWeekday: null, byMonthday: null, endDate: null } }));
    expect(await dates('2026-11-01', '2026-11-30')).toEqual(['2026-11-10']);
    expect(await dates('2027-06-01', '2027-06-30')).toEqual(['2027-06-10']);
  });

  it('completing one instance leaves the others pending', async () => {
    const first = await app.tasks.create(item({ recurrence: daily }));
    await app.tasks.complete(first.id);
    const range = await app.agenda.range('2026-03-10', '2026-03-12');
    expect(range.map((a) => a.occurrence.status)).toEqual(['completed', 'pending', 'pending']);
  });

  it('edit this occurrence only: overrides title/time on one instance', async () => {
    await app.tasks.create(item({ kind: 'event', title: 'Standup', startTime: '09:00', recurrence: daily }));
    const target = (await app.agenda.day('2026-03-12'))[0];
    const values = await app.tasks.formValues(target.occurrence.id, 'occurrence');
    await app.tasks.update(target.occurrence.id, { ...values, title: 'Standup (moved)', startTime: '11:00' }, 'occurrence');
    const range = await app.agenda.range('2026-03-11', '2026-03-13');
    expect(range.map((a) => [a.occurrence.titleOverride ?? a.task.title, a.occurrence.startTime])).toEqual([
      ['Standup', '09:00'],
      ['Standup (moved)', '11:00'],
      ['Standup', '09:00'],
    ]);
  });

  it('edit entire series: future instances regenerate, completed history and exceptions are kept', async () => {
    const first = await app.tasks.create(item({ kind: 'event', title: 'Standup', startTime: '09:00', recurrence: daily }));
    await app.tasks.complete(first.id);
    const exception = (await app.agenda.day('2026-03-13'))[0];
    await app.tasks.update(exception.occurrence.id, { ...(await app.tasks.formValues(exception.occurrence.id, 'occurrence')), startTime: '12:00' }, 'occurrence');
    clock.set('2026-03-11T08:00:00');
    const tomorrow = (await app.agenda.day('2026-03-11'))[0];
    const values = await app.tasks.formValues(tomorrow.occurrence.id, 'series');
    expect(values.date).toBe('2026-03-10');
    await app.tasks.update(tomorrow.occurrence.id, { ...values, title: 'Daily sync', startTime: '10:00' }, 'series');
    const range = await app.agenda.range('2026-03-10', '2026-03-14');
    expect(range.map((a) => [a.occurrence.date, a.task.title, a.occurrence.startTime, a.occurrence.status])).toEqual([
      ['2026-03-10', 'Daily sync', '09:00', 'completed'],
      ['2026-03-11', 'Daily sync', '10:00', 'pending'],
      ['2026-03-12', 'Daily sync', '10:00', 'pending'],
      ['2026-03-13', 'Daily sync', '12:00', 'pending'],
      ['2026-03-14', 'Daily sync', '10:00', 'pending'],
    ]);
  });

  it('changing the rule to weekdays only removes weekend instances going forward', async () => {
    const first = await app.tasks.create(item({ kind: 'event', title: 'Walk', recurrence: daily }));
    const values = await app.tasks.formValues(first.id, 'series');
    await app.tasks.update(first.id, { ...values, recurrence: { ...daily, frequency: 'weekly', byWeekday: [1, 2, 3, 4, 5] } }, 'series');
    // 2026-03-14/15 is a weekend.
    expect(await dates('2026-03-10', '2026-03-16')).toEqual(['2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13', '2026-03-16']);
  });

  it('edit this and future splits the series', async () => {
    await app.tasks.create(item({ kind: 'event', title: 'Class', recurrence: daily }));
    const from = (await app.agenda.day('2026-03-13'))[0];
    const values = await app.tasks.formValues(from.occurrence.id, 'future');
    expect(values.date).toBe('2026-03-13');
    await app.tasks.update(from.occurrence.id, { ...values, title: 'Class (new room)' }, 'future');
    const range = await app.agenda.range('2026-03-10', '2026-03-15');
    expect(range.map((a) => `${a.occurrence.date}:${a.task.title}`)).toEqual([
      '2026-03-10:Class',
      '2026-03-11:Class',
      '2026-03-12:Class',
      '2026-03-13:Class (new room)',
      '2026-03-14:Class (new room)',
      '2026-03-15:Class (new room)',
    ]);
  });

  it('delete this occurrence only: it never comes back', async () => {
    await app.tasks.create(item({ kind: 'event', title: 'Yoga', recurrence: daily }));
    const victim = (await app.agenda.day('2026-03-12'))[0];
    await app.tasks.delete(victim.occurrence.id, 'occurrence');
    await app.recurrence.ensureThrough('2026-12-31');
    await app.runMaintenance();
    expect(await dates('2026-03-10', '2026-03-13')).toEqual(['2026-03-10', '2026-03-11', '2026-03-13']);
  });

  it('a deleted single instance survives a later series edit', async () => {
    const first = await app.tasks.create(item({ kind: 'event', title: 'Yoga', startTime: '07:00', recurrence: daily }));
    const victim = (await app.agenda.day('2026-03-12'))[0];
    await app.tasks.delete(victim.occurrence.id, 'occurrence');
    await app.tasks.update(first.id, { ...(await app.tasks.formValues(first.id, 'series')), startTime: '08:00' }, 'series');
    expect(await dates('2026-03-10', '2026-03-13')).toEqual(['2026-03-10', '2026-03-11', '2026-03-13']);
  });

  it('delete this and future ends the series; delete series keeps completed history', async () => {
    const first = await app.tasks.create(item({ kind: 'event', title: 'Run', recurrence: daily }));
    await app.tasks.complete(first.id);
    const cut = (await app.agenda.day('2026-03-13'))[0];
    await app.tasks.delete(cut.occurrence.id, 'future');
    await app.recurrence.ensureThrough('2026-12-31');
    expect(await dates('2026-03-10', '2026-04-30')).toEqual(['2026-03-10', '2026-03-11', '2026-03-12']);

    const mid = (await app.agenda.day('2026-03-11'))[0];
    await app.tasks.delete(mid.occurrence.id, 'series');
    expect(await dates('2026-03-10', '2026-04-30')).toEqual([]);
    const history = await app.db.find('task_occurrences', { where: { task_id: first.taskId, status: 'completed' } });
    expect(history).toHaveLength(1);
  });

  it('turning repeat off keeps one occurrence and history', async () => {
    const first = await app.tasks.create(item({ title: 'Review', recurrence: daily }));
    await app.tasks.complete(first.id);
    const next = (await app.agenda.day('2026-03-11'))[0];
    const values = await app.tasks.formValues(next.occurrence.id, 'series');
    await app.tasks.update(next.occurrence.id, { ...values, date: '2026-03-11', recurrence: null }, 'series');
    expect(await dates('2026-03-10', '2026-04-30')).toEqual(['2026-03-10', '2026-03-11']);
  });

  it('adding a repeat to a one-off task turns it into a series', async () => {
    const occ = await app.tasks.create(item({ title: 'Water plants', kind: 'event' }));
    const values = await app.tasks.formValues(occ.id, 'series');
    await app.tasks.update(occ.id, { ...values, recurrence: { ...daily, interval: 2, endDate: '2026-03-16' } }, 'series');
    expect(await dates('2026-03-01', '2026-03-31')).toEqual(['2026-03-10', '2026-03-12', '2026-03-14', '2026-03-16']);
  });
});
