import type { Folder } from '../models';
import type { AppServices } from '../services/container';
import { folderFocusId, groupFolderTasks, selectEmptyFoldersForTasks, type TaskListEntry } from '../taskListFolders';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

const daily = { frequency: 'daily' as const, interval: 1, byWeekday: null, byMonthday: null, endDate: '2026-03-12' };

function folderInput(name: string, priority: 'low' | 'medium' | 'high' | 'urgent' = 'high') {
  return { name, description: '', color: '#6366F1', icon: 'folder-outline' as const, priority, targetDate: '2026-03-20' as const };
}

function groups(rows: TaskListEntry[]) {
  return rows.filter((row): row is Extract<TaskListEntry, { kind: 'folder' }> => row.kind === 'folder');
}

describe.each(DRIVERS)('folder-first tasks list (%s)', (_name, open) => {
  let app: AppServices;
  beforeEach(async () => {
    ({ app } = await makeApp(open, '2026-03-10T09:00:00'));
  });

  it('groups matching folder tasks, keeps unassigned rows, and updates both folders on move', async () => {
    const launch = await app.folders.create(folderInput('Launch'));
    const home = await app.folders.create(folderInput('Home', 'low'));
    await app.folders.create(folderInput('Empty', 'medium'));
    const high = await app.tasks.create(item({ title: 'Ship it', folderId: launch.id, priority: 'high', priorityExplicit: true }));
    const done = await app.tasks.create(item({ title: 'Notes done', folderId: launch.id, priority: 'low', priorityExplicit: true }));
    await app.tasks.complete(done.id);
    const loose = await app.tasks.create(item({ title: 'Loose task', priority: 'low', priorityExplicit: true }));
    await app.tasks.create(item({ title: 'Standup', kind: 'event', folderId: launch.id, date: '2026-03-11', startTime: '09:00', endTime: '09:30' }));

    const rows = groupFolderTasks(await app.agenda.list({ status: 'all' }));
    const launchGroup = groups(rows).find((row) => row.group.folder.id === launch.id)!;
    expect(launchGroup.group).toMatchObject({ total: 2, completed: 1, pending: 1, percent: 50 });
    expect(launchGroup.group.tasks.map((a) => a.task.title).sort()).toEqual(['Notes done', 'Ship it']);
    expect(groups(rows).some((row) => row.group.folder.name === 'Empty')).toBe(false);
    expect(groups(rows).some((row) => row.group.folder.id === home.id)).toBe(false);
    expect(rows.filter((row) => row.kind === 'item').map((row) => row.agenda.task.title).sort()).toEqual(['Loose task', 'Standup']);

    const highOnly = groupFolderTasks(await app.agenda.list({ status: 'all', priorities: ['high'] }));
    expect(groups(highOnly)).toHaveLength(1);
    expect(groups(highOnly)[0].group).toMatchObject({ total: 1, completed: 0, pending: 1, percent: 0 });
    expect(groups(highOnly)[0].group.tasks[0].task.id).toBe(high.taskId);

    const found = groupFolderTasks(await app.agenda.list({ status: 'all', text: 'notes done' }), { search: 'notes done' });
    const hit = groups(found)[0].group;
    expect(hit.folder.id).toBe(launch.id);
    expect(hit.matches).toHaveLength(1);
    expect(folderFocusId(hit)).toBe(done.id);
    expect(found.some((row) => row.kind === 'item' && row.agenda.task.title === 'Notes done')).toBe(false);

    const byName = groupFolderTasks(await app.agenda.list({ status: 'all', text: 'launch' }), { search: 'launch' });
    expect(folderFocusId(groups(byName)[0].group)).toBeNull();

    await app.folders.assignTask(high.taskId, home.id);
    const moved = groupFolderTasks(await app.agenda.list({ status: 'all' }));
    const launchAfter = groups(moved).find((row) => row.group.folder.id === launch.id)!;
    const homeAfter = groups(moved).find((row) => row.group.folder.id === home.id)!;
    expect(launchAfter.group.tasks.map((a) => a.task.title)).toEqual(['Notes done']);
    expect(homeAfter.group.tasks.map((a) => a.task.title)).toEqual(['Ship it']);
    expect(homeAfter.group.tasks[0].occurrence.date).toBe('2026-03-10');
    expect(homeAfter.group.tasks[0].task.priority).toBe('high');
    expect(homeAfter.group.folder.targetDate).toBe('2026-03-20');

    const today = await app.agenda.day('2026-03-10');
    expect(today.some((a) => a.task.id === loose.taskId)).toBe(true);
    expect(today.some((a) => a.task.id === high.taskId && a.task.folderId === home.id)).toBe(true);

    const habit = await app.tasks.create(item({ title: 'Daily habit', folderId: launch.id, recurrence: daily, priorityExplicit: false, priority: 'low' }));
    const habitRow = (await app.agenda.list({ status: 'pending', text: 'Daily habit' })).find((a) => a.task.id === habit.taskId)!;
    expect(habitRow.task.folderId).toBe(launch.id);
    expect(habitRow.occurrence.date).toBe('2026-03-10');
    expect(habitRow.folder?.targetDate).toBe('2026-03-20');
  });
});

describe('empty folders on the tasks list', () => {
  const today = '2026-03-10';
  const empty = (partial: Partial<Folder> & { taskCount?: number } = {}) => ({
    id: 'e',
    name: 'Empty',
    description: '',
    color: '#111111',
    icon: 'folder-outline',
    targetDate: null as string | null,
    priority: 'medium' as const,
    status: 'active' as const,
    sortOrder: 0,
    createdAt: '',
    updatedAt: '',
    archivedAt: null,
    taskCount: 0,
    ...partial,
  });

  const base = {
    enabled: true,
    hasPriority: false,
    hasCategory: false,
    includeOnThisKind: true,
    today,
    status: 'pending' as const,
  };

  it('shows active empty folders on the default pending list and hides them when the setting is off', () => {
    const folders = [empty(), empty({ id: 'used', name: 'Used', taskCount: 2 }), empty({ id: 'old', name: 'Old', status: 'archived' })];
    expect(selectEmptyFoldersForTasks(folders, base).map((f) => f.id)).toEqual(['e']);
    expect(selectEmptyFoldersForTasks(folders, { ...base, enabled: false })).toEqual([]);
    expect(selectEmptyFoldersForTasks(folders, { ...base, folderAssignment: 'unassigned' })).toEqual([]);
    expect(selectEmptyFoldersForTasks(folders, { ...base, status: 'completed' })).toEqual([]);
    expect(selectEmptyFoldersForTasks(folders, { ...base, hasPriority: true })).toEqual([]);
    expect(selectEmptyFoldersForTasks(folders, { ...base, search: 'emp' }).map((f) => f.id)).toEqual(['e']);
    expect(selectEmptyFoldersForTasks(folders, { ...base, search: 'nope' })).toEqual([]);
    expect(selectEmptyFoldersForTasks([empty({ targetDate: '2026-03-01' })], { ...base, folderTarget: 'overdue' })).toHaveLength(1);
    expect(selectEmptyFoldersForTasks(folders, { ...base, includeOnThisKind: false })).toEqual([]);
  });
});
