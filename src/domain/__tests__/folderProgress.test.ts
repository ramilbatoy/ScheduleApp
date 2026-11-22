import { computeFolderProgress, effectivePriority, folderIsOverdue, folderTargetStatus, presentFolders, resolvePriority, type FolderCard } from '../folderProgress';
import type { Folder } from '../models';
import { sanitizeNavigation } from '../navigationPrefs';

const today = '2026-03-10';

function folder(partial: Partial<Folder> = {}): Folder {
  return {
    id: 'f1',
    name: 'Launch',
    description: '',
    color: '#6366F1',
    icon: 'folder-outline',
    targetDate: null,
    priority: 'high',
    status: 'active',
    sortOrder: 0,
    createdAt: '2026-03-01T00:00:00.000Z',
    updatedAt: '2026-03-01T00:00:00.000Z',
    archivedAt: null,
    ...partial,
  };
}

describe('folder progress rules', () => {
  it('counts a carried task once and ignores events in the percent', () => {
    const progress = computeFolderProgress(
      [
        { taskId: 't1', kind: 'task', recurring: false, status: 'pending', date: '2026-03-08' },
        { taskId: 't2', kind: 'task', recurring: false, status: 'completed', date: '2026-03-10' },
        { taskId: 'e1', kind: 'event', recurring: false, status: 'pending', date: '2026-03-10' },
        { taskId: 't3', kind: 'task', recurring: false, status: 'cancelled', date: '2026-03-10' },
      ],
      today,
    );
    expect(progress).toMatchObject({ total: 2, completed: 1, pending: 0, overdue: 1, events: 1, percent: 50 });
  });

  it('counts recurring history through today and skips future instances', () => {
    const progress = computeFolderProgress(
      [
        { taskId: 'r', kind: 'task', recurring: true, status: 'completed', date: '2026-03-08' },
        { taskId: 'r', kind: 'task', recurring: true, status: 'missed', date: '2026-03-09' },
        { taskId: 'r', kind: 'task', recurring: true, status: 'pending', date: '2026-03-10' },
        { taskId: 'r', kind: 'task', recurring: true, status: 'pending', date: '2026-03-11' },
        { taskId: 'r', kind: 'task', recurring: true, status: 'pending', date: '2026-03-12' },
      ],
      today,
    );
    expect(progress).toMatchObject({ total: 3, completed: 1, pending: 1, overdue: 1, percent: 33 });
  });

  it('marks a past target overdue only while work remains', () => {
    const base = folder({ targetDate: '2026-03-01' });
    const open: FolderCard = {
      ...base,
      progress: { total: 1, completed: 0, pending: 1, overdue: 0, events: 0, percent: 0 },
      target: folderTargetStatus(base.targetDate, today),
      taskCount: 1,
    };
    const done: FolderCard = { ...open, progress: { ...open.progress, completed: 1, pending: 0, percent: 100 } };
    expect(folderTargetStatus('2026-03-01', today)).toMatchObject({ remainingDays: -9, overdue: true, approaching: false });
    expect(folderTargetStatus('2026-03-12', today)).toMatchObject({ remainingDays: 2, overdue: false, approaching: true });
    expect(folderIsOverdue(open)).toBe(true);
    expect(folderIsOverdue(done)).toBe(false);
  });

  it('filters and sorts folder cards', () => {
    const cards: FolderCard[] = [
      { ...folder({ id: 'a', name: 'Alpha', priority: 'low', targetDate: '2026-04-01' }), progress: { total: 1, completed: 0, pending: 1, overdue: 0, events: 0, percent: 10 }, target: folderTargetStatus('2026-04-01', today), taskCount: 1 },
      { ...folder({ id: 'b', name: 'Beta', priority: 'urgent', status: 'archived', targetDate: '2026-03-01' }), progress: { total: 0, completed: 0, pending: 0, overdue: 0, events: 0, percent: 0 }, target: folderTargetStatus('2026-03-01', today), taskCount: 0 },
      { ...folder({ id: 'c', name: 'Gamma', status: 'completed' }), progress: { total: 2, completed: 2, pending: 0, overdue: 0, events: 0, percent: 100 }, target: folderTargetStatus(null, today), taskCount: 2 },
    ];
    expect(presentFolders(cards, { filter: 'archived' }).map((c) => c.id)).toEqual(['b']);
    expect(presentFolders(cards, { filter: 'completed' }).map((c) => c.id)).toEqual(['c']);
    expect(presentFolders(cards, { sort: 'priority' }).map((c) => c.id)[0]).toBe('b');
    expect(presentFolders(cards, { sort: 'progress' }).map((c) => c.id)[0]).toBe('c');
    expect(presentFolders(cards, { text: 'alp' }).map((c) => c.id)).toEqual(['a']);
  });

  it('lets an explicit priority win and otherwise inherits the folder', () => {
    const project = folder({ priority: 'urgent' });
    expect(effectivePriority({ priority: 'low', priorityExplicit: true }, project)).toBe('low');
    expect(effectivePriority({ priority: 'low', priorityExplicit: false }, project)).toBe('urgent');
    expect(effectivePriority({ priority: 'medium', priorityExplicit: false }, null)).toBe('medium');
    expect(resolvePriority({ priority: 'low', priorityExplicit: false }, project)).toEqual({ priority: 'urgent', priorityExplicit: false });
    expect(resolvePriority({ priority: 'low', priorityExplicit: true }, project)).toEqual({ priority: 'low', priorityExplicit: true });
  });
});

describe('navigation prefs', () => {
  it('drops unknown ids and keeps a hidden item hidden', () => {
    const prefs = sanitizeNavigation({ drawerEnabled: false, order: ['tasks', 'nope', 'tasks', 'projects'] });
    expect(prefs).toEqual({ drawerEnabled: false, order: ['tasks', 'projects'] });
    expect(sanitizeNavigation(null).drawerEnabled).toBe(true);
    expect(sanitizeNavigation(null).order).toContain('today');
    expect(sanitizeNavigation({ drawerEnabled: true, order: [] }).order).toEqual([]);
  });
});
