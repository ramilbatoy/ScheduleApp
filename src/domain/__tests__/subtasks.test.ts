import { NotFoundError, ValidationError } from '../models';
import type { AppServices } from '../services/container';
import { countSubtasks, flattenSubtaskTree, MAX_SUBTASK_DEPTH } from '../services/subtaskService';
import { DRIVERS } from '../../test/databases';
import { item, makeApp } from '../../test/fixtures';

describe.each(DRIVERS)('nested subtasks (%s)', (_name, open) => {
  let app: AppServices;
  beforeEach(async () => {
    ({ app } = await makeApp(open));
  });

  it('creates nested layers, ticks independently, edits title/notes, and soft-deletes a subtree', async () => {
    const occ = await app.tasks.create(item({ title: 'Ship release' }));
    const a = await app.subtasks.add(occ.id, { title: 'Write notes', notes: 'draft outline' });
    const b = await app.subtasks.add(occ.id, { title: 'Code', parentSubtaskId: a.id });
    const c = await app.subtasks.add(occ.id, { title: 'Unit tests', parentSubtaskId: b.id });
    expect(c.parentSubtaskId).toBe(b.id);

    let tree = await app.subtasks.treeForOccurrence(occ.id);
    expect(flattenSubtaskTree(tree).map((n) => `${n.depth}:${n.title}`)).toEqual([
      '0:Write notes',
      '1:Code',
      '2:Unit tests',
    ]);
    expect(countSubtasks(tree)).toEqual({ total: 3, completed: 0 });

    await app.subtasks.toggleComplete(b.id);
    let detail = await app.tasks.getDetail(occ.id);
    expect(detail.occurrence.status).toBe('pending');
    const code = flattenSubtaskTree(detail.subtasks).find((n) => n.id === b.id)!;
    expect(code).toMatchObject({ completed: true, title: 'Code' });
    expect(code.completedAt).not.toBeNull();

    await app.subtasks.toggleComplete(b.id);
    expect(flattenSubtaskTree(await app.subtasks.treeForOccurrence(occ.id)).find((n) => n.id === b.id)).toMatchObject({
      completed: false,
      completedAt: null,
    });

    await app.subtasks.update(c.id, { title: 'Integration tests', notes: 'cover nest/tick' });
    detail = await app.tasks.getDetail(occ.id);
    expect(flattenSubtaskTree(detail.subtasks).find((n) => n.id === c.id)).toMatchObject({
      title: 'Integration tests',
      notes: 'cover nest/tick',
    });

    await app.subtasks.remove(a.id);
    tree = await app.subtasks.treeForOccurrence(occ.id);
    expect(tree).toEqual([]);
    await expect(app.subtasks.update(b.id, { title: 'gone' })).rejects.toBeInstanceOf(NotFoundError);
  });

  it('rejects empty titles, events, and over-deep nesting', async () => {
    const taskOcc = await app.tasks.create(item());
    await expect(app.subtasks.add(taskOcc.id, { title: '  ' })).rejects.toBeInstanceOf(ValidationError);

    const eventOcc = await app.tasks.create(item({ kind: 'event', title: 'Standup', startTime: '09:00', endTime: '09:30' }));
    await expect(app.subtasks.add(eventOcc.id, { title: 'Prep' })).rejects.toThrow(/tasks/i);

    let parentId: string | null = null;
    for (let i = 0; i < MAX_SUBTASK_DEPTH; i++) {
      const row = await app.subtasks.add(taskOcc.id, { title: `L${i}`, parentSubtaskId: parentId });
      parentId = row.id;
    }
    await expect(app.subtasks.add(taskOcc.id, { title: 'too deep', parentSubtaskId: parentId })).rejects.toThrow(/nest/i);
  });

  it('rides with carry-forward on the same occurrence and does not appear as a separate agenda row', async () => {
    const occ = await app.tasks.create(item({ title: 'Pack', date: '2026-03-09' }));
    const sub = await app.subtasks.add(occ.id, { title: 'Socks' });
    await app.subtasks.toggleComplete(sub.id);

    const moved = await app.carryForward.run();
    expect(moved.moved).toBe(1);

    const detail = await app.tasks.getDetail(occ.id);
    expect(detail.occurrence.date).toBe('2026-03-10');
    expect(detail.occurrence.isCarriedForward).toBe(true);
    expect(flattenSubtaskTree(detail.subtasks)).toHaveLength(1);
    expect(flattenSubtaskTree(detail.subtasks)[0]).toMatchObject({ id: sub.id, completed: true, title: 'Socks' });

    const day = await app.agenda.day('2026-03-10');
    expect(day).toHaveLength(1);
    expect(day[0].subtasks[0].title).toBe('Socks');
    expect(day.map((a) => a.task.title)).toEqual(['Pack']);
  });

  it('keeps subtasks on one recurring instance without copying them to the next', async () => {
    const first = await app.tasks.create(
      item({
        title: 'Daily standup prep',
        recurrence: { frequency: 'daily', interval: 1, byWeekday: null, byMonthday: null, endDate: null },
      }),
    );
    await app.subtasks.add(first.id, { title: 'Agenda bullets' });
    const day = await app.agenda.day('2026-03-10');
    expect(day[0].subtasks).toHaveLength(1);

    const next = (await app.agenda.day('2026-03-11'))[0];
    expect(next.task.title).toBe('Daily standup prep');
    expect(next.occurrence.id).not.toBe(first.id);
    expect(next.subtasks).toHaveLength(0);
  });
});
