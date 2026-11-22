import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { FakeNotifications, item, makeApp } from '../../test/fixtures';
import { ValidationError } from '../models';
import { safetyCopyDate, safetyCopyName } from '../services/backupService';

type Clock = Awaited<ReturnType<typeof makeApp>>['clock'];
const daily = { frequency: 'daily' as const, interval: 1, byWeekday: null, byMonthday: null, endDate: null };

describe.each(DRIVERS)('backup and restore (%s)', (_name, open) => {
  let app: AppServices;
  let clock: Clock;
  let notifications: FakeNotifications;
  const safety: { name: string; json: string }[] = [];
  const saveSafety = async (name: string, json: string) => {
    safety.push({ name, json });
    return `backups/${name}`;
  };

  beforeEach(async () => {
    safety.length = 0;
    ({ app, clock, notifications } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  async function seed(target: AppServices) {
    const cats = await target.categories.list();
    const work = cats.find((c) => c.name === 'Work')!;
    const custom = await target.categories.create('Garden', '#84CC16');
    const report = await target.tasks.create(item({ title: 'Report', categoryId: work.id, priority: 'urgent', reminderOffsetMinutes: 30, startTime: '15:00' }));
    await target.tasks.create(item({ title: 'Water plants', categoryId: custom.id, recurrence: daily }));
    await target.tasks.create(item({ kind: 'event', title: 'Dentist', date: '2026-03-12', startTime: '10:00', endTime: '11:00' }));
    await target.tasks.complete(report.id);
    await target.settings.set('theme', 'dark');
    await target.settings.set('autoCarryForward', false);
    return { report };
  }

  it('round-trips every record, including history, recurrence and settings', async () => {
    await seed(app);
    const json = await app.backup.exportJson();
    const before = await app.backup.export();

    const { app: other } = await makeApp(open, '2026-03-10T09:00:00');
    const validated = other.backup.validate(json);
    expect(validated.summary).toMatchObject({ categories: 9, tasks: 2, events: 1, completed: 1 });
    await other.restoreBackup(validated, saveSafety);

    const after = await other.backup.export();
    for (const table of ['categories', 'recurring_rules', 'tasks', 'completion_history']) {
      expect(after.data[table]).toEqual(before.data[table]);
    }
    expect(after.data.task_occurrences.length).toBeGreaterThanOrEqual(before.data.task_occurrences.length);
    const settings = await other.settings.get();
    expect(settings).toMatchObject({ theme: 'dark', autoCarryForward: false, categoriesSeeded: true });
    const today = await other.agenda.day('2026-03-10');
    expect(today.map((a) => a.task.title).sort()).toEqual(['Report', 'Water plants']);
  });

  it('writes a safety copy of the current data before replacing it', async () => {
    await app.tasks.create(item({ title: 'Keep me safe' }));
    const incoming = await makeApp(open);
    await incoming.app.tasks.create(item({ title: 'From backup' }));
    await app.restoreBackup(app.backup.validate(await incoming.app.backup.exportJson()), saveSafety);

    expect(safety).toHaveLength(1);
    expect(safety[0].name).toMatch(/^dayplanner-before-restore-.*\.json$/);
    expect(safety[0].json).toContain('Keep me safe');
    expect((await app.agenda.list()).map((a) => a.task.title)).toEqual(['From backup']);
    // The safety copy is itself a valid backup that restores the old data.
    await app.restoreBackup(app.backup.validate(safety[0].json), saveSafety);
    expect((await app.agenda.list()).map((a) => a.task.title)).toEqual(['Keep me safe']);
  });

  it('aborts without changes when the safety copy cannot be written', async () => {
    await app.tasks.create(item({ title: 'Original' }));
    const incoming = await makeApp(open);
    const validated = app.backup.validate(await incoming.app.backup.exportJson());
    await expect(
      app.restoreBackup(validated, async () => {
        throw new Error('disk full');
      }),
    ).rejects.toThrow('disk full');
    expect((await app.agenda.list()).map((a) => a.task.title)).toEqual(['Original']);
  });

  it('cancels notifications for replaced data and schedules reminders for restored data', async () => {
    await app.tasks.create(item({ title: 'Old', startTime: '18:00', reminderOffsetMinutes: 10 }));
    expect([...notifications.scheduled.values()].map((n) => n.title)).toEqual(['Old']);
    const incoming = await makeApp(open);
    await incoming.app.tasks.create(item({ title: 'New', startTime: '19:00', reminderOffsetMinutes: 10 }));
    await app.restoreBackup(app.backup.validate(await incoming.app.backup.exportJson()), saveSafety);
    expect([...notifications.scheduled.values()].map((n) => n.title)).toEqual(['New']);
  });

  it('does not export reminders or device-specific settings', async () => {
    await app.tasks.create(item({ startTime: '18:00', reminderOffsetMinutes: 10 }));
    await app.backup.markBackedUp();
    const b = await app.backup.export();
    expect(b.data.reminders).toBeUndefined();
    const incoming = await makeApp(open);
    await incoming.app.settings.set('notificationsEnabled', false);
    const at = (await app.settings.get()).lastBackupAt;
    await app.restoreBackup(app.backup.validate(await incoming.app.backup.exportJson()), saveSafety);
    expect(await app.settings.get()).toMatchObject({ notificationsEnabled: true, lastBackupAt: at });
  });

  it('restored carry-forward state continues correctly on the next day', async () => {
    const occ = await app.tasks.create(item({ title: 'Unfinished' }));
    const json = await app.backup.exportJson();
    const { app: other, clock: otherClock } = await makeApp(open, '2026-03-10T09:00:00');
    otherClock.set('2026-03-12T08:00:00');
    await other.restoreBackup(other.backup.validate(json), saveSafety);
    const d = await other.tasks.getDetail(occ.id);
    expect(d.occurrence).toMatchObject({ date: '2026-03-12', carryForwardCount: 2, originalDate: '2026-03-10' });
    void clock;
  });

  describe('validation', () => {
    const valid = async () => JSON.parse(await app.backup.exportJson());
    const expectInvalid = (text: string, msg: RegExp) => {
      expect(() => app.backup.validate(text)).toThrow(ValidationError);
      expect(() => app.backup.validate(text)).toThrow(msg);
    };

    it('rejects non-JSON and foreign files', async () => {
      expectInvalid('not json', /not valid JSON/);
      expectInvalid('{"hello":1}', /not a DayPlanner backup/);
      expectInvalid('[]', /not a DayPlanner backup/);
    });

    it('rejects backups from a newer app version', async () => {
      const b = await valid();
      b.schemaVersion = 999;
      expectInvalid(JSON.stringify(b), /newer version/);
    });

    it('rejects missing tables, wrong types, bad enums and bad dates', async () => {
      await seed(app);
      const b = await valid();
      delete b.data.categories;
      b.data.tasks[0].priority = 'critical';
      b.data.tasks[1].all_day = 'yes';
      b.data.task_occurrences[0].occurrence_date = '2026-02-31';
      b.data.task_occurrences[1].start_time = '25:00';
      b.data.tasks[2].surprise = 1;
      let message = '';
      try {
        app.backup.validate(JSON.stringify(b));
      } catch (e) {
        message = (e as Error).message;
      }
      expect(message).toMatch(/Missing table "categories"/);
      expect(message).toMatch(/priority has unsupported value "critical"/);
      expect(message).toMatch(/all_day should be a whole number/);
      expect(message).toMatch(/occurrence_date is not a valid date/);
      expect(message).toMatch(/start_time is not a valid time/);
      expect(message).toMatch(/unknown field "surprise"/);
    });

    it('rejects broken references and duplicate active occurrences', async () => {
      await seed(app);
      const b = await valid();
      b.data.task_occurrences[0].task_id = 'ghost';
      const dupe = { ...b.data.task_occurrences[1], id: 'dupe-id', recurrence_instance_key: null };
      b.data.task_occurrences.push(dupe);
      expectInvalid(JSON.stringify(b), /belongs to a task that is not in the backup/);
      expectInvalid(JSON.stringify(b), /two active entries/);
    });

    it('uncategorizes tasks whose category is missing, with a warning', async () => {
      await seed(app);
      const b = await valid();
      const garden = b.data.categories.find((c: { name: string }) => c.name === 'Garden');
      b.data.categories = b.data.categories.filter((c: { id: string }) => c.id !== garden.id);
      const v = app.backup.validate(JSON.stringify(b));
      expect(v.warnings).toEqual([expect.stringMatching(/Water plants.*uncategorized/)]);
      await app.restoreBackup(v, saveSafety);
      const plants = (await app.agenda.list()).find((a) => a.task.title === 'Water plants')!;
      expect(plants.task.categoryId).toBeNull();
    });

    it('leaves existing data untouched when validation fails', async () => {
      await app.tasks.create(item({ title: 'Original' }));
      expect(() => app.backup.validate('{"app":"dayplanner"}')).toThrow(ValidationError);
      expect((await app.agenda.list()).map((a) => a.task.title)).toEqual(['Original']);
      expect(safety).toHaveLength(0);
    });
  });
});

describe('safety copy names', () => {
  it('encode and decode the restore instant', () => {
    const name = safetyCopyName('2026-03-10T14:05:09.123Z');
    expect(name).toBe('dayplanner-before-restore-2026-03-10T14-05-09-123Z.json');
    expect(safetyCopyDate(name)).toBe('2026-03-10T14:05:09.123Z');
    expect(safetyCopyDate('notes.json')).toBeNull();
  });
});
