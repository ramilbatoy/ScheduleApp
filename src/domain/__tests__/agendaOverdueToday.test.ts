import {
  isOverdue,
  mergeAgendaUnique,
  projectOverdueOntoToday,
} from '../services/agendaService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

describe.each(DRIVERS)('agenda overdue on today (%s)', (_name, open) => {
  it('includes unfinished overdue tasks in day(today) without moving occurrence.date', async () => {
    const { app, clock } = await makeApp(open, '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ title: 'Left behind' }));
    clock.set('2026-03-12T08:00:00');
    await app.runMaintenance();

    const today = await app.agenda.day('2026-03-12');
    expect(today.map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect(today[0].occurrence.date).toBe('2026-03-10');
    expect(isOverdue(today[0], '2026-03-12', clock.now())).toBe(true);

    const originalDay = await app.agenda.day('2026-03-10');
    expect(originalDay.map((a) => a.occurrence.id)).toEqual([occ.id]);
  });

  it('does not duplicate when carry-forward already moved the task to today', async () => {
    const { app, clock } = await makeApp(open, '2026-03-10T09:00:00');
    const occ = await app.tasks.create(item({ title: 'Carry me' }));
    clock.set('2026-03-11T08:00:00');
    await app.runMaintenance();

    const today = await app.agenda.day('2026-03-11');
    expect(today).toHaveLength(1);
    expect(today[0].occurrence).toMatchObject({
      id: occ.id,
      date: '2026-03-11',
      isCarriedForward: true,
    });
  });

  it('drops completed tasks from the overdue-on-today surface', async () => {
    const { app, clock } = await makeApp(open, '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ title: 'Finish me' }));
    clock.set('2026-03-12T08:00:00');
    await app.runMaintenance();
    await app.tasks.complete(occ.id);

    expect(await app.agenda.day('2026-03-12')).toHaveLength(0);
    expect(await app.agenda.pendingOverdueBeforeToday()).toHaveLength(0);
    const past = await app.agenda.day('2026-03-10');
    expect(past).toHaveLength(1);
    expect(past[0].occurrence.status).toBe('completed');
  });

  it('never projects events onto today as overdue', async () => {
    const { app, clock } = await makeApp(open, '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    await app.tasks.create(item({ title: 'Past meetup', kind: 'event', startTime: '10:00' }));
    clock.set('2026-03-12T08:00:00');
    await app.runMaintenance();

    expect(await app.agenda.pendingOverdueBeforeToday()).toHaveLength(0);
    expect(await app.agenda.day('2026-03-12')).toHaveLength(0);
  });

  it('dashboard to-do list includes overdue pending while overdue metadata stays available', async () => {
    const { app, clock } = await makeApp(open, '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ title: 'Still open' }));
    clock.set('2026-03-12T08:00:00');
    await app.runMaintenance();

    const dash = await app.agenda.dashboard();
    expect(dash.overdue.map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect(dash.tasks.map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect(dash.total).toBe(1);
  });
});

describe('projectOverdueOntoToday helper', () => {
  it('copies overdue into today without removing the original day bucket', async () => {
    const { app, clock } = await makeApp(DRIVERS[0][1], '2026-03-10T09:00:00');
    await app.settings.set('autoCarryForward', false);
    const occ = await app.tasks.create(item({ title: 'Grid overdue' }));
    clock.set('2026-03-12T08:00:00');
    await app.runMaintenance();

    const overdue = await app.agenda.pendingOverdueBeforeToday();
    const byDate = projectOverdueOntoToday(
      { '2026-03-10': overdue, '2026-03-12': [] },
      overdue,
      '2026-03-12',
    );
    expect(byDate['2026-03-10']?.map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect(byDate['2026-03-12']?.map((a) => a.occurrence.id)).toEqual([occ.id]);
    expect(mergeAgendaUnique(overdue, overdue)).toHaveLength(1);
  });
});
