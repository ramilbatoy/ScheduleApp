import type { Database } from '../../db/types';
import { nowIso, type Clock } from '../dates';
import { newId } from '../ids';
import { NotFoundError, ValidationError, type Subtask, type SubtaskNode } from '../models';
import { createRepos, type Repos } from '../repos/repositories';

/** Soft cap so indent stays usable; deeper nesting is rejected. */
export const MAX_SUBTASK_DEPTH = 8;

export interface SubtaskInput {
  title: string;
  notes?: string;
  parentSubtaskId?: string | null;
}

export function buildSubtaskTree(flat: Subtask[]): SubtaskNode[] {
  const byParent = new Map<string | null, Subtask[]>();
  for (const s of flat) {
    const key = s.parentSubtaskId;
    const list = byParent.get(key) ?? [];
    list.push(s);
    byParent.set(key, list);
  }
  for (const list of byParent.values()) {
    list.sort((a, b) => a.sortOrder - b.sortOrder || a.createdAt.localeCompare(b.createdAt));
  }
  const walk = (parentId: string | null, depth: number): SubtaskNode[] =>
    (byParent.get(parentId) ?? []).map((s) => ({
      ...s,
      depth,
      children: walk(s.id, depth + 1),
    }));
  return walk(null, 0);
}

export function flattenSubtaskTree(nodes: SubtaskNode[]): SubtaskNode[] {
  const out: SubtaskNode[] = [];
  const walk = (list: SubtaskNode[]) => {
    for (const n of list) {
      out.push(n);
      walk(n.children);
    }
  };
  walk(nodes);
  return out;
}

export function countSubtasks(nodes: SubtaskNode[]): { total: number; completed: number } {
  let total = 0;
  let completed = 0;
  for (const n of flattenSubtaskTree(nodes)) {
    total++;
    if (n.completed) completed++;
  }
  return { total, completed };
}

function validateTitle(raw: string): string {
  const title = raw.trim();
  if (!title) throw new ValidationError('Subtask title is required.');
  if (title.length > 200) throw new ValidationError('Subtask title must be 200 characters or fewer.');
  return title;
}

export class SubtaskService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
    private readonly onChanged: () => Promise<void> = async () => undefined,
  ) {}

  async treeForOccurrence(occurrenceId: string): Promise<SubtaskNode[]> {
    const repos = createRepos(this.db);
    const flat = await repos.subtasks.listActiveForOccurrence(occurrenceId);
    return buildSubtaskTree(flat);
  }

  async treesForOccurrences(occurrenceIds: string[]): Promise<Map<string, SubtaskNode[]>> {
    const repos = createRepos(this.db);
    const flat = await repos.subtasks.listActiveForOccurrences(occurrenceIds);
    const byOcc = new Map<string, Subtask[]>();
    for (const s of flat) {
      const list = byOcc.get(s.occurrenceId) ?? [];
      list.push(s);
      byOcc.set(s.occurrenceId, list);
    }
    const out = new Map<string, SubtaskNode[]>();
    for (const id of occurrenceIds) out.set(id, buildSubtaskTree(byOcc.get(id) ?? []));
    return out;
  }

  async add(occurrenceId: string, input: SubtaskInput): Promise<Subtask> {
    const title = validateTitle(input.title);
    const notes = (input.notes ?? '').trim();
    const parentId = input.parentSubtaskId ?? null;
    const created = await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      await this.assertTaskOccurrence(repos, occurrenceId);
      let sortOrder = 0;
      if (parentId) {
        const parent = await repos.subtasks.get(parentId);
        if (!parent || parent.deletedAt || parent.occurrenceId !== occurrenceId) {
          throw new ValidationError('Parent subtask was not found on this task.');
        }
        const depth = await this.depthOf(repos, parent);
        if (depth + 1 >= MAX_SUBTASK_DEPTH) {
          throw new ValidationError(`Subtasks can nest at most ${MAX_SUBTASK_DEPTH} levels.`);
        }
        const siblings = await repos.subtasks.list({
          occurrence_id: occurrenceId,
          parent_subtask_id: parentId,
          deleted_at: null,
        });
        sortOrder = siblings.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
      } else {
        const roots = await repos.subtasks.list({
          occurrence_id: occurrenceId,
          parent_subtask_id: null,
          deleted_at: null,
        });
        sortOrder = roots.reduce((m, s) => Math.max(m, s.sortOrder), -1) + 1;
      }
      const row: Subtask = {
        id: newId(),
        occurrenceId,
        parentSubtaskId: parentId,
        title,
        notes,
        sortOrder,
        completed: false,
        completedAt: null,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };
      await repos.subtasks.insert(row);
      return row;
    });
    await this.onChanged();
    return created;
  }

  async update(id: string, patch: { title?: string; notes?: string }): Promise<Subtask> {
    const updated = await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const current = await this.requireActive(repos, id);
      const next: Partial<Subtask> = { updatedAt: now };
      if (patch.title !== undefined) next.title = validateTitle(patch.title);
      if (patch.notes !== undefined) next.notes = patch.notes.trim();
      await repos.subtasks.patch(id, next);
      return { ...current, ...next };
    });
    await this.onChanged();
    return updated;
  }

  async toggleComplete(id: string): Promise<Subtask> {
    const updated = await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const current = await this.requireActive(repos, id);
      const completed = !current.completed;
      const next: Partial<Subtask> = {
        completed,
        completedAt: completed ? now : null,
        updatedAt: now,
      };
      await repos.subtasks.patch(id, next);
      return { ...current, ...next };
    });
    await this.onChanged();
    return updated;
  }

  /** Soft-deletes the subtask and its descendants. */
  async remove(id: string): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const current = await this.requireActive(repos, id);
      const all = await repos.subtasks.listActiveForOccurrence(current.occurrenceId);
      const tree = buildSubtaskTree(all);
      const target = flattenSubtaskTree(tree).find((n) => n.id === id);
      if (!target) throw new NotFoundError('This subtask no longer exists.');
      const ids = [target.id, ...flattenSubtaskTree(target.children).map((c) => c.id)];
      for (const sid of ids) {
        await repos.subtasks.patch(sid, { deletedAt: now, updatedAt: now });
      }
    });
    await this.onChanged();
  }

  private async requireActive(repos: Repos, id: string): Promise<Subtask> {
    const s = await repos.subtasks.get(id);
    if (!s || s.deletedAt) throw new NotFoundError('This subtask no longer exists.');
    return s;
  }

  private async assertTaskOccurrence(repos: Repos, occurrenceId: string) {
    const occ = await repos.occurrences.get(occurrenceId);
    if (!occ || occ.status === 'cancelled') throw new NotFoundError('This item no longer exists.');
    const task = await repos.tasks.get(occ.taskId);
    if (!task || task.deletedAt) throw new NotFoundError('This item was deleted.');
    if (task.kind !== 'task') throw new ValidationError('Subtasks can only be added to tasks.');
  }

  private async depthOf(repos: Repos, node: Subtask): Promise<number> {
    let depth = 0;
    let cur: Subtask | null = node;
    const seen = new Set<string>();
    while (cur?.parentSubtaskId) {
      if (seen.has(cur.id)) throw new ValidationError('Subtask hierarchy is invalid.');
      seen.add(cur.id);
      depth++;
      cur = await repos.subtasks.get(cur.parentSubtaskId);
      if (!cur || cur.deletedAt) break;
    }
    return depth;
  }
}
