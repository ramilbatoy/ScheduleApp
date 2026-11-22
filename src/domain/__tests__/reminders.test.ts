import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { FakeNotifications, item, makeApp } from '../../test/fixtures';

describe.each(DRIVERS)('reminders (%s)', (_name, open) => {
  let app: AppServices;
  let notifications: FakeNotifications;
  let clock: Awaited<ReturnType<typeof makeApp>>['clock'];
  beforeEach(async () => {
    ({ app, notifications, clock } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  const triggers = () => [...notifications.scheduled.values()].map((n) => n.at.getTime()).sort();

  it('schedules a start reminder and a deadline reminder at the right instants', async () => {
    await app.tasks.create(item({ startTime: '14:00', reminderOffsetMinutes: 15, deadlineAt: new Date('2026-03-12T17:00:00').toISOString(), deadlineReminderOffsetMinutes: 60 }));
    expect(triggers()).toEqual([new Date('2026-03-10T13:45:00').getTime(), new Date('2026-03-12T16:00:00').getTime()]);
  });

  it('schedules timed task and event reminders from their offsets', async () => {
    await app.tasks.create(item({ kind: 'task', title: 'Call', startTime: '16:00', reminderOffsetMinutes: 10 }));
    await app.tasks.create(item({ kind: 'event', title: 'Standup', startTime: '10:00', reminderOffsetMinutes: 5 }));
    expect(triggers()).toEqual([new Date('2026-03-10T09:55:00').getTime(), new Date('2026-03-10T15:50:00').getTime()]);
    const upcoming = await app.reminders.upcoming();
    expect(upcoming).toHaveLength(2);
    expect(upcoming.every((r) => r.notificationId)).toBe(true);
  });

  it('cancels reminders when the item is completed or deleted', async () => {
    const occ = await app.tasks.create(item({ startTime: '14:00', reminderOffsetMinutes: 0 }));
    expect(notifications.scheduled.size).toBe(1);
    await app.tasks.complete(occ.id);
    expect(notifications.scheduled.size).toBe(0);
    await app.tasks.reopen(occ.id);
    expect(notifications.scheduled.size).toBe(1);
    await app.tasks.delete(occ.id, 'series');
    expect(notifications.scheduled.size).toBe(0);
  });

  it('reschedules when the time changes and skips past triggers', async () => {
    const occ = await app.tasks.create(item({ startTime: '08:00', reminderOffsetMinutes: 10 }));
    expect(notifications.scheduled.size).toBe(0);
    await app.tasks.update(occ.id, { ...(await app.tasks.formValues(occ.id, 'occurrence')), startTime: '18:00' }, 'occurrence');
    expect(triggers()).toEqual([new Date('2026-03-10T17:50:00').getTime()]);
  });

  it('schedules recurring reminders only inside the horizon and is stable across syncs', async () => {
    await app.tasks.create(item({ kind: 'event', startTime: '07:00', reminderOffsetMinutes: 30, recurrence: { frequency: 'daily', interval: 1, byWeekday: null, byMonthday: null, endDate: null } }));
    const first = triggers();
    expect(first.length).toBe(14); // today 06:30 has passed; next 14 days
    await app.reminders.syncAll();
    await app.reminders.syncAll();
    expect(triggers()).toEqual(first);
    clock.set('2026-03-11T09:00:00');
    await app.runMaintenance();
    expect(triggers().length).toBe(14);
  });

  it('keeps reminder rows but schedules nothing without permission, then schedules on grant', async () => {
    notifications.state = 'denied';
    await app.tasks.create(item({ startTime: '14:00', reminderOffsetMinutes: 5 }));
    expect(notifications.scheduled.size).toBe(0);
    expect(await app.reminders.upcoming()).toHaveLength(1);
    await app.reminders.requestPermission();
    expect(notifications.scheduled.size).toBe(1);
  });
});
