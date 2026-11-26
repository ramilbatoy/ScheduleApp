import type { Database } from '../../db/types';
import type { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';
import { createRepos } from '../repos/repositories';
import { agendaPriority } from '../services/agendaService';

type Clock = Awaited<ReturnType<typeof makeApp>>['clock'];
const daily = { frequency: 'daily' as const, interval: 1, byWeekday: null, byMonthday: null, endDate: '2026-03-12' };

function folderInput(name = 'Launch', priority: 'low' | 'medium' | 'high' | 'urgent' = 'high') {
  return { name, description: 'Ship it', color: '#6366F1', icon: 'folder-outline' as const, priority, targetDate: '2026-03-20' as const };
}

describe.each(DRIVERS)('folders (%s)', (_name, open) => {
  let app: AppServices;
  let clock: Clock;
  beforeEach(async () => {
    ({ app, clock } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  it('migrates older task rows without folder columns', async () => {
    const id = 'legacy-task';
    await app.db.insert('tasks', {
      id,
      item_kind: 'task',
      title: 'Legacy',
      notes: '',
      category_id: null,
      priority: 'low',
      all_day: 0,
      default_start_time: null,
      default_end_time: null,
      deadline_at: null,
      recurring_rule_id: null,
      series_id: null,
      reminder_offset_minutes: null,
      deadline_reminder_offset_minutes: null,
      created_at: '2026-01-01T00:00:00.000Z',
      updated_at: '2026-01-01T00:00:00.000Z',
      deleted_at: null,
    });
    const row = await app.db.get('tasks', id);
    expect(row).toMatchObject({ folder_id: null, priority_explicit: 1 });
  });

  it('creates, updates, archives, restores, reorders, and rejects duplicate active names', async () => {
    const launch = await app.folders.create(folderInput('Launch'));
    const home = await app.folders.create(folderInput('Home', 'low'));
    await expect(app.folders.create(folderInput(' launch '))).rejects.toThrow(/already exists/);
    const archived = await app.folders.archive(home.id);
    expect(archived).toMatchObject({ status: 'archived', archivedAt: expect.any(String) });
    await app.folders.create(folderInput('Home', 'medium'));
    await expect(app.folders.restore(home.id)).rejects.toThrow(/already exists/);
    const renamed = await app.folders.update(launch.id, { ...folderInput('Launch'), name: 'Launch v2', priority: 'urgent', targetDate: null });
    expect(renamed).toMatchObject({ name: 'Launch v2', priority: 'urgent', targetDate: null, status: 'active' });
    await app.folders.reorder([home.id, launch.id]);
    const manual = await app.folders.cards({ sort: 'manual' });
    expect(manual.map((f) => f.id).slice(0, 2)).toEqual([home.id, launch.id]);
    const restored = await app.folders.update(home.id, { ...folderInput('Home archived'), status: 'active' });
    expect(restored.status).toBe('active');
    expect(restored.archivedAt).toBeNull();
  });

  it('does not delete tasks when a folder is removed, and archived folders reject new tasks', async () => {
    const launch = await app.folders.create(folderInput());
    const other = await app.folders.create(folderInput('Other', 'low'));
    const stay = await app.tasks.create(item({ title: 'Stay', folderId: launch.id }));
    const moving = await app.tasks.create(item({ title: 'Move me', folderId: launch.id, priority: 'low', priorityExplicit: true }));
    await app.folders.delete(launch.id, { mode: 'move', folderId: other.id });
    await expect(app.folders.get(launch.id)).rejects.toThrow(/no longer exists/);
    expect((await app.tasks.getDetail(stay.id)).task.folderId).toBe(other.id);
    expect((await app.tasks.getDetail(moving.id)).task).toMatchObject({ folderId: other.id, priority: 'low', priorityExplicit: true, });
    expect((await app.tasks.getDetail(moving.id)).occurrence.date).toBe('2026-03-10');
    await app.folders.archive(other.id);
    await expect(app.tasks.create(item({ title: 'Nope', folderId: other.id }))).rejects.toThrow(/Archived/);
    const temp = await app.folders.create(folderInput('Temp', 'urgent'));
    const loose = await app.tasks.create(item({ title: 'Loose', folderId: temp.id, priorityExplicit: false, priority: 'medium' }));
    await app.folders.delete(temp.id, { mode: 'unassign' });
    const after = await app.tasks.getDetail(loose.id);
    expect(after.task).toMatchObject({ folderId: null, priorityExplicit: true, priority: 'urgent' });
    expect((await app.agenda.list()).map((a) => a.task.title).sort()).toEqual(['Loose', 'Move me', 'Stay']);
  });

  it('keeps explicit priority and inherits when the flag is off, without rewriting occurrence dates', async () => {
    const launch = await app.folders.create(folderInput('Launch', 'urgent'));
    const explicit = await app.tasks.create(item({ title: 'Explicit', priority: 'low', priorityExplicit: true, folderId: launch.id, date: '2026-03-10' }));
    const inherited = await app.tasks.create(item({ title: 'Inherited', priority: 'medium', priorityExplicit: false, folderId: launch.id }));
    expect((await app.tasks.getDetail(explicit.id)).task).toMatchObject({ priority: 'low', priorityExplicit: true });
    expect((await app.tasks.getDetail(inherited.id)).task.priorityExplicit).toBe(false);
    expect(agendaPriority(await app.tasks.getDetail(inherited.id))).toBe('urgent');

    await app.folders.update(launch.id, { ...folderInput('Launch', 'high'), targetDate: '2026-04-01' });
    const explicitAfter = await app.tasks.getDetail(explicit.id);
    const inheritedAfter = await app.tasks.getDetail(inherited.id);
    expect(explicitAfter.task.priority).toBe('low');
    expect(agendaPriority(explicitAfter)).toBe('low');
    expect(inheritedAfter.task.priority).toBe('urgent');
    expect(agendaPriority(inheritedAfter)).toBe('high');
    expect(explicitAfter.occurrence.date).toBe('2026-03-10');
    expect(inheritedAfter.occurrence.date).toBe('2026-03-10');
    expect(inheritedAfter.task.deadlineAt).toBeNull();
  });

  it('keeps the folder across carry-forward, recurrence, and subtasks, and still shows on global views', async () => {
    const launch = await app.folders.create(folderInput());
    const occ = await app.tasks.create(item({ title: 'Carry me', folderId: launch.id, priority: 'high' }));
    await app.subtasks.add(occ.id, { title: 'Step' });
    const series = await app.tasks.create(
      item({ title: 'Daily', folderId: launch.id, date: '2026-03-10', recurrence: daily, priorityExplicit: false, priority: 'low' }),
    );
    clock.set('2026-03-11T08:00:00');
    await app.runMaintenance();
    const carried = await app.tasks.getDetail(occ.id);
    expect(carried.task.folderId).toBe(launch.id);
    expect(carried.occurrence).toMatchObject({ date: '2026-03-11', isCarriedForward: true });
    expect(carried.subtasks.map((s) => s.title)).toEqual(['Step']);

    const seriesDetail = await app.tasks.getDetail(series.id);
    expect(seriesDetail.task.folderId).toBe(launch.id);
    expect(seriesDetail.rule?.startDate).toBe('2026-03-10');
    expect(agendaPriority(seriesDetail)).toBe('high');

    const day = await app.agenda.day('2026-03-11');
    expect(day.map((a) => a.task.title)).toEqual(expect.arrayContaining(['Carry me']));
    const week = await app.agenda.range('2026-03-09', '2026-03-15');
    expect(new Set(week.map((a) => a.occurrence.id)).size).toBe(week.length);
    expect(week.some((a) => a.task.title === 'Daily' && a.task.folderId === launch.id)).toBe(true);
    const listed = await app.agenda.list({ text: 'Launch' });
    expect(listed.map((a) => a.task.title).sort()).toEqual(['Carry me', 'Daily']);
    const byFolder = await app.agenda.list({ folderId: launch.id });
    expect(byFolder.every((a) => a.task.folderId === launch.id)).toBe(true);
    const unassigned = await app.agenda.list({ folderAssignment: 'unassigned' });
    expect(unassigned.some((a) => a.task.folderId === launch.id)).toBe(false);
    const urgent = await app.agenda.list({ priorities: ['high'], folderTarget: 'set' });
    expect(urgent.map((a) => a.task.title).sort()).toEqual(['Carry me', 'Daily']);
    const stats = await app.stats.report('day');
    expect(stats.period.total).toBeGreaterThan(0);
    const card = await app.folders.card(launch.id);
    expect(card.taskCount).toBe(2);
    expect(card.progress.total).toBeGreaterThan(0);
    expect(card.target.date).toBe('2026-03-20');
  });

  it('persists drawer prefs without touching notification settings', async () => {
    await app.settings.set('notificationsEnabled', false);
    const next = await app.settings.set('navigation', { drawerEnabled: false, order: ['projects', 'today'] });
    expect(next.navigation).toEqual({
      drawerEnabled: false,
      order: ['projects', 'today'],
      orderRevision: 3,
    });
    expect(next.notificationsEnabled).toBe(false);
    const again = await app.settings.get();
    expect(again.navigation.order).toEqual(['projects', 'today']);
    const reset = await app.settings.set('navigation', {
      drawerEnabled: true,
      order: ['today', 'calendar', 'tasks', 'projects', 'statistics', 'categories', 'theme', 'backup', 'settings', 'about'],
    });
    expect(reset.navigation.drawerEnabled).toBe(true);
    expect(reset.notificationsEnabled).toBe(false);
  });

  it('forces canonical drawer order once for pre-revision and revision-2 installs and persists it', async () => {
    await createRepos(app.db).settings.set(
      'navigation',
      { drawerEnabled: true, order: ['about', 'tasks', 'projects'] },
      '2026-11-26T00:00:00.000Z',
    );
    const first = await app.settings.get();
    expect(first.navigation.order).toEqual(['projects', 'statistics', 'settings', 'about']);
    expect(first.navigation.orderRevision).toBe(3);
    const raw = await app.db.get('app_settings', 'navigation');
    expect(JSON.parse(String(raw!.value)).order).toEqual(['projects', 'statistics', 'settings', 'about']);
    expect(JSON.parse(String(raw!.value)).orderRevision).toBe(3);

    // Users who reordered after #33's revision 2 must be re-forced once on revision 3.
    await createRepos(app.db).settings.set(
      'navigation',
      { drawerEnabled: true, order: ['about', 'settings', 'statistics'], orderRevision: 2 },
      '2026-11-26T01:00:00.000Z',
    );
    const fromRev2 = await app.settings.get();
    expect(fromRev2.navigation.order).toEqual(['projects', 'statistics', 'settings', 'about']);
    expect(fromRev2.navigation.orderRevision).toBe(3);

    await app.settings.set('navigation', { drawerEnabled: true, order: ['about', 'settings'] });
    const afterCustom = await app.settings.get();
    expect(afterCustom.navigation.order).toEqual(['about', 'settings']);
    expect(afterCustom.navigation.orderRevision).toBe(3);
  });
});

describe('folder schema is shared', () => {
  it('exposes the folders table on every driver', async () => {
    const opens = DRIVERS.map(([, open]) => open);
    for (const open of opens) {
      const db: Database = await open();
      expect(await db.schemaVersion()).toBeGreaterThanOrEqual(3);
      await db.insert('folders', {
        id: 'f',
        name: 'One',
        description: '',
        color: '#000000',
        icon: 'folder-outline',
        target_date: null,
        priority: 'low',
        status: 'active',
        sort_order: 0,
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
        archived_at: null,
      });
      expect((await db.get('folders', 'f'))?.name).toBe('One');
      await db.close();
    }
  });
});
