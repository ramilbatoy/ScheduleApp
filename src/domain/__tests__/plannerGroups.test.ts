import { addDaysKey } from '../dates';
import type { Agenda, DateKey, Folder } from '../models';
import { groupAgendaByDate } from '../monthTable';
import { groupDayByFolder, groupWeekByFolder, monthDayMarkers, weekDisplayDate } from '../plannerGroups';
import { filterAgendaItems, projectOverdueOntoToday } from '../services/agendaService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

const TODAY = '2026-03-10' as DateKey;
const WEEK_START = '2026-03-09' as DateKey;
const NOW = new Date('2026-03-10T09:00:00');

function folderInput(name: string, priority: 'low' | 'medium' | 'high' | 'urgent', targetDate: string | null) {
  return { name, description: '', color: '#6366F1', icon: 'folder-outline', priority, targetDate: targetDate as DateKey | null };
}

function titlesOn(groups: ReturnType<typeof groupWeekByFolder>, folderName: string, date: DateKey) {
  const group = groups.folders.find((g) => g.folder.name === folderName);
  return group?.days.find((d) => d.date === date)?.tasks.map((a) => a.task.title) ?? [];
}

describe.each(DRIVERS)('planner folder grouping (%s)', (_name, open) => {
  it('groups by folder without moving tasks onto the folder target date', async () => {
    const { app } = await makeApp(open, '2026-03-10T09:00:00');
    const launch = await app.folders.create(folderInput('Launch', 'low', '2026-03-20'));
    const home = await app.folders.create(folderInput('Home', 'urgent', '2026-03-01'));
    const empty = await app.folders.create(folderInput('Empty', 'medium', null));
    await app.tasks.create(item({ title: 'Old launch', folderId: launch.id, date: '2026-03-02', priority: 'low', priorityExplicit: true }));
    await app.tasks.create(item({ title: 'Mon launch', folderId: launch.id, date: '2026-03-09', priority: 'low', priorityExplicit: true }));
    const done = await app.tasks.create(item({ title: 'Tue done', folderId: launch.id, date: '2026-03-10', priority: 'medium', priorityExplicit: true }));
    await app.tasks.complete(done.id);
    await app.tasks.create(item({ title: 'Later launch', folderId: launch.id, date: '2026-03-24', priority: 'low', priorityExplicit: true }));
    await app.tasks.create(item({ title: 'Wed home', folderId: home.id, date: '2026-03-11', priority: 'low', priorityExplicit: false }));
    await app.tasks.create(item({ title: 'Loose', date: '2026-03-10', priority: 'low', priorityExplicit: true }));
    await app.tasks.create(item({ title: 'Standup', kind: 'event', folderId: launch.id, date: '2026-03-10', startTime: '09:00', endTime: '09:30', priority: 'medium', priorityExplicit: true }));

    const days = Array.from({ length: 7 }, (_, i) => addDaysKey(WEEK_START, i));
    const rangeItems = await app.agenda.range(WEEK_START, days[6]);
    const overdue = await app.agenda.pendingOverdueBeforeToday();
    const cards = await app.folders.cards();
    const overall = new Map(cards.map((c) => [c.id, c.progress]));
    const filtered = filterAgendaItems(rangeItems, { status: 'all', sort: 'date' }, TODAY, NOW);
    const overdueFiltered = filterAgendaItems(overdue, { status: 'all', sort: 'date' }, TODAY, NOW);
    const earlier = overdueFiltered.filter((a) => a.occurrence.date < WEEK_START);
    const byDate = groupWeekByFolder(days, [...filtered, ...earlier], { today: TODAY, now: NOW, sort: 'date', overall });

    expect(byDate.folders.map((g) => g.folder.name)).toEqual(['Launch', 'Home']);
    expect(titlesOn(byDate, 'Launch', '2026-03-09')).toEqual(['Mon launch']);
    expect(titlesOn(byDate, 'Launch', '2026-03-10')).toEqual(['Old launch', 'Tue done']);
    expect(titlesOn(byDate, 'Home', '2026-03-11')).toEqual(['Wed home']);
    expect(byDate.folders.flatMap((g) => g.days.map((d) => d.date))).not.toEqual(expect.arrayContaining(['2026-03-20', '2026-03-01']));
    const old = byDate.folders.flatMap((g) => g.days.flatMap((d) => d.tasks)).find((a) => a.task.title === 'Old launch')!;
    expect(old.occurrence.date).toBe('2026-03-02');
    expect(weekDisplayDate(old, days, TODAY)).toBe(TODAY);
    const wed = byDate.folders.flatMap((g) => g.days.flatMap((d) => d.tasks)).find((a) => a.task.title === 'Wed home')!;
    expect(wed.occurrence.date).toBe('2026-03-11');
    expect(wed.folder?.targetDate).toBe('2026-03-01');

    const launchGroup = byDate.folders[0];
    expect(launchGroup.range).toMatchObject({ scheduled: 3, completed: 1, pending: 2, overdue: 2 });
    expect(launchGroup.overall).toMatchObject({ total: 4, completed: 1, pending: 1, overdue: 2 });
    expect(launchGroup.overall!.total).not.toBe(launchGroup.range.scheduled);

    const tuesdayLoose = byDate.unassignedByDay.find((d) => d.date === TODAY)!;
    expect(tuesdayLoose.tasks.map((a) => a.task.title)).toEqual(['Loose', 'Standup']);
    const ids = [
      ...byDate.folders.flatMap((g) => g.days.flatMap((d) => d.tasks.map((a) => a.occurrence.id))),
      ...byDate.unassignedByDay.flatMap((d) => d.tasks.map((a) => a.occurrence.id)),
    ];
    expect(new Set(ids).size).toBe(ids.length);
    expect(byDate.folders.some((g) => g.folder.name === 'Empty')).toBe(false);

    const withEmpty = groupWeekByFolder(days, [...filtered, ...earlier], {
      today: TODAY,
      now: NOW,
      sort: 'date',
      overall,
      emptyFolders: cards.filter((c) => c.id === empty.id),
    });
    expect(withEmpty.folders.at(-1)?.folder.name).toBe('Empty');
    expect(withEmpty.folders.at(-1)?.range.scheduled).toBe(0);
    expect(withEmpty.folders.at(-1)?.overall).toMatchObject({ total: 0, completed: 0 });

    const byPriority = groupWeekByFolder(days, [...filtered, ...earlier], { today: TODAY, now: NOW, sort: 'priority', overall });
    expect(byPriority.folders.map((g) => g.folder.name)).toEqual(['Home', 'Launch']);
    expect(titlesOn(byPriority, 'Home', '2026-03-11')).toEqual(['Wed home']);

    const urgentOnly = filterAgendaItems([...rangeItems, ...overdue], { priorities: ['urgent'], status: 'all', sort: 'priority' }, TODAY, NOW);
    const urgentGroups = groupWeekByFolder(days, urgentOnly, { today: TODAY, now: NOW, sort: 'priority', overall });
    expect(urgentGroups.folders.map((g) => g.folder.name)).toEqual(['Home']);
    expect(urgentGroups.folders[0].days.flatMap((d) => d.tasks.map((a) => a.task.title))).toEqual(['Wed home']);
    expect(urgentGroups.unassignedByDay).toEqual([]);

    const todayItems = filterAgendaItems(await app.agenda.day(TODAY), { status: 'all', sort: 'date' }, TODAY, NOW);
    const todayGroups = groupDayByFolder(todayItems, { today: TODAY, now: NOW, overall });
    expect(todayGroups.folders.find((g) => g.folder.name === 'Launch')!.tasks.map((a) => a.task.title)).toEqual(['Old launch', 'Mon launch', 'Tue done']);
    expect(todayGroups.folders.find((g) => g.folder.name === 'Launch')!.tasks.map((a) => a.occurrence.date)).toEqual(['2026-03-02', '2026-03-09', '2026-03-10']);
    expect(todayGroups.unassigned.map((a) => a.task.title)).toEqual(['Loose', 'Standup']);
    expect(todayGroups.folders.some((g) => g.folder.name === 'Home')).toBe(false);

    const markers = projectOverdueOntoToday(groupAgendaByDate(filtered), overdueFiltered, TODAY);
    expect(monthDayMarkers(markers['2026-03-09']).folders.map((f) => f.name)).toEqual(['Launch']);
    expect(monthDayMarkers(markers['2026-03-09']).folders[0].count).toBe(1);
    expect(monthDayMarkers(markers['2026-03-11']).folders.map((f) => ({ name: f.name, count: f.count }))).toEqual([{ name: 'Home', count: 1 }]);
    expect(monthDayMarkers(markers[TODAY]).folders.map((f) => f.name)).toContain('Launch');
    expect(monthDayMarkers(markers[TODAY]).unassigned).toBe(2);
    expect(markers['2026-03-20']).toBeUndefined();
    expect(markers['2026-03-01']).toBeUndefined();
  });
});

describe('planner grouping guards', () => {
  function stub(id: string, date: string, folder: Folder | null): Agenda {
    return {
      task: {
        id: `t-${id}`,
        kind: 'task',
        title: id,
        notes: '',
        categoryId: null,
        folderId: folder?.id ?? 'missing',
        priority: 'low',
        priorityExplicit: true,
        allDay: true,
        defaultStartTime: null,
        defaultEndTime: null,
        deadlineAt: null,
        recurringRuleId: null,
        seriesId: null,
        reminderOffsetMinutes: null,
        deadlineReminderOffsetMinutes: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
        deletedAt: null,
      },
      occurrence: {
        id,
        taskId: `t-${id}`,
        date,
        startTime: null,
        endTime: null,
        status: 'pending',
        source: 'manual',
        titleOverride: null,
        notesOverride: null,
        isCarriedForward: false,
        carryForwardCount: 0,
        originalDate: null,
        recurrenceInstanceKey: null,
        isException: false,
        completedAt: null,
        createdAt: '2026-03-01T00:00:00.000Z',
        updatedAt: '2026-03-01T00:00:00.000Z',
      },
      category: null,
      rule: null,
      subtasks: [],
      folder,
    };
  }

  it('keeps a task individual when its folder record is missing and drops duplicate ids', () => {
    const folder: Folder = {
      id: 'f',
      name: 'Launch',
      description: '',
      color: '#111',
      icon: 'folder-outline',
      targetDate: '2026-03-20',
      priority: 'high',
      status: 'active',
      sortOrder: 0,
      createdAt: '',
      updatedAt: '',
      archivedAt: null,
    };
    const kept = stub('a', '2026-03-10', folder);
    const copy = stub('a', '2026-03-20', folder);
    const missing = stub('b', '2026-03-10', null);
    const grouped = groupDayByFolder([kept, copy, missing], { today: TODAY, now: NOW });
    expect(grouped.folders).toHaveLength(1);
    expect(grouped.folders[0].tasks.map((a) => a.occurrence.id)).toEqual(['a']);
    expect(grouped.folders[0].tasks[0].occurrence.date).toBe('2026-03-10');
    expect(grouped.unassigned.map((a) => a.occurrence.id)).toEqual(['b']);
    expect(monthDayMarkers([kept, copy, missing])).toEqual({
      folders: [{ folderId: 'f', name: 'Launch', color: '#111', icon: 'folder-outline', count: 1 }],
      unassigned: 1,
    });
  });
});
