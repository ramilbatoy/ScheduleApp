import { filterAgendaItems, matchesAgendaFilter, sortAgendaItems } from '../services/agendaService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

describe.each(DRIVERS)('agenda filter helpers (%s)', (_name, open) => {
  it('filters by text, priority, status and sorts by urgency', async () => {
    const { app } = await makeApp(open);
    const cats = await app.categories.list();
    await app.tasks.create(item({ title: 'Alpha urgent', priority: 'urgent', categoryId: cats[0].id, notes: 'ship it' }));
    await app.tasks.create(item({ title: 'Beta low', priority: 'low', date: '2026-03-12' }));
    const mid = await app.tasks.create(item({ title: 'Gamma high', priority: 'high', deadlineAt: '2026-03-15T12:00:00.000Z' }));
    await app.tasks.complete(mid.id);

    const all = await app.agenda.range('2026-03-10', '2026-03-12');
    const today = '2026-03-10';
    const now = new Date('2026-03-10T09:00:00');

    expect(filterAgendaItems(all, { text: 'ship' }, today, now).map((a) => a.task.title)).toEqual(['Alpha urgent']);
    expect(filterAgendaItems(all, { priorities: ['urgent', 'high'], status: 'all' }, today, now).map((a) => a.task.title).sort()).toEqual([
      'Alpha urgent',
      'Gamma high',
    ]);
    expect(filterAgendaItems(all, { status: 'pending' }, today, now).every((a) => a.occurrence.status === 'pending')).toBe(true);
    expect(filterAgendaItems(all, { status: 'completed' }, today, now).map((a) => a.task.title)).toEqual(['Gamma high']);

    const byPriority = sortAgendaItems(
      all.filter((a) => a.occurrence.status === 'pending'),
      'priority',
    );
    expect(byPriority.map((a) => a.task.priority)).toEqual(['urgent', 'low']);

    const byDeadline = sortAgendaItems(all.filter((a) => a.task.deadlineAt), 'deadline');
    expect(byDeadline[0]?.task.title).toBe('Gamma high');
  });

  it('matchesAgendaFilter respects category and upcoming', async () => {
    const { app } = await makeApp(open);
    const cats = await app.categories.list();
    await app.tasks.create(item({ title: 'Cat task', categoryId: cats[0].id }));
    await app.tasks.create(item({ title: 'Later', date: '2026-03-20' }));
    const items = await app.agenda.list({ status: 'all' });
    const today = '2026-03-10';
    const now = new Date('2026-03-10T09:00:00');
    const later = items.find((a) => a.task.title === 'Later')!;
    expect(matchesAgendaFilter(later, { status: 'upcoming' }, today, now)).toBe(true);
    expect(matchesAgendaFilter(later, { categoryIds: [cats[0].id] }, today, now)).toBe(false);
    const cat = items.find((a) => a.task.title === 'Cat task')!;
    expect(matchesAgendaFilter(cat, { categoryIds: [cats[0].id] }, today, now)).toBe(true);
  });
});

describe('filterAgendaItems pure edge cases', () => {
  it('searches nested subtask titles via integration fixture', async () => {
    const { app } = await makeApp(DRIVERS[0][1]);
    const occ = await app.tasks.create(item({ title: 'Parent', notes: 'body' }));
    await app.subtasks.add(occ.id, { title: 'Hidden leaf' });
    const day = await app.agenda.day('2026-03-10');
    const today = '2026-03-10';
    const now = new Date('2026-03-10T09:00:00');
    expect(filterAgendaItems(day, { text: 'leaf' }, today, now)).toHaveLength(1);
    expect(filterAgendaItems(day, { text: 'missing' }, today, now)).toHaveLength(0);
  });
});
