import type { Database } from '../../db/types';
import { isDateKey, nowIso, todayKey, type Clock } from '../dates';
import {
  computeFolderProgress,
  folderTargetStatus,
  presentFolders,
  type FolderCard,
  type FolderListFilter,
  type FolderSortKey,
  type ProgressSource,
} from '../folderProgress';
import { newId } from '../ids';
import {
  NotFoundError,
  PRIORITIES,
  ValidationError,
  type DateKey,
  type Folder,
  type FolderStatus,
  type Priority,
  type Task,
} from '../models';
import { createRepos, type Repos } from '../repos/repositories';
import { CATEGORY_PALETTE } from './categoryService';

export const FOLDER_ICONS = [
  'folder-outline',
  'briefcase-outline',
  'home-outline',
  'heart-outline',
  'school-outline',
  'fitness-outline',
  'cash-outline',
  'airplane-outline',
  'star-outline',
  'flag-outline',
  'book-outline',
  'people-outline',
] as const;

export type FolderIconName = (typeof FOLDER_ICONS)[number];

const HEX = /^#[0-9A-Fa-f]{6}$/;

export interface FolderInput {
  name: string;
  description?: string;
  color: string;
  icon: string;
  targetDate?: DateKey | null;
  priority: Priority;
}

export type FolderDeletePlan = { mode: 'unassign' } | { mode: 'move'; folderId: string };

export { CATEGORY_PALETTE as FOLDER_COLORS };

/**
 * Rejects assignment into an archived folder unless the task is already there.
 * Returns null when the task should be unassigned.
 */
export async function resolveFolderForWrite(repos: Repos, folderId: string | null, currentFolderId: string | null): Promise<Folder | null> {
  if (!folderId) return null;
  const folder = await repos.folders.get(folderId);
  if (!folder) throw new ValidationError('That folder no longer exists.');
  if (folder.status === 'archived' && folderId !== currentFolderId) {
    throw new ValidationError('Archived folders cannot take new tasks. Restore the folder first.');
  }
  return folder;
}

export class FolderService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  list(): Promise<Folder[]> {
    return createRepos(this.db).folders.list();
  }

  async get(id: string): Promise<Folder> {
    const folder = await createRepos(this.db).folders.get(id);
    if (!folder) throw new NotFoundError('This folder no longer exists.');
    return folder;
  }

  async cards(opts: { filter?: FolderListFilter; sort?: FolderSortKey; text?: string } = {}): Promise<FolderCard[]> {
    const today = todayKey(this.clock);
    const repos = createRepos(this.db);
    const folders = await repos.folders.list();
    const tasks = await repos.tasks.list({ deleted_at: null });
    const occs = await repos.occurrences.list();
    const cards = folders.map((folder) => this.toCard(folder, tasks, occs, today));
    return presentFolders(cards, opts);
  }

  async card(id: string): Promise<FolderCard> {
    const today = todayKey(this.clock);
    const repos = createRepos(this.db);
    const folder = await repos.folders.get(id);
    if (!folder) throw new NotFoundError('This folder no longer exists.');
    const tasks = await repos.tasks.list({ folder_id: id, deleted_at: null });
    const occs = [];
    for (const task of tasks) occs.push(...(await repos.occurrences.list({ task_id: task.id })));
    return this.toCard(folder, tasks, occs, today);
  }

  private toCard(folder: Folder, tasks: Task[], occs: { taskId: string; status: ProgressSource['status']; date: DateKey }[], today: DateKey): FolderCard {
    const mine = tasks.filter((t) => t.folderId === folder.id && !t.deletedAt);
    const sources: ProgressSource[] = [];
    for (const task of mine) {
      for (const o of occs) {
        if (o.taskId !== task.id) continue;
        sources.push({ taskId: task.id, kind: task.kind, recurring: !!task.recurringRuleId, status: o.status, date: o.date });
      }
    }
    return {
      ...folder,
      progress: computeFolderProgress(sources, today),
      target: folderTargetStatus(folder.targetDate, today),
      taskCount: mine.length,
    };
  }

  async create(raw: FolderInput): Promise<Folder> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const now = nowIso(this.clock);
      const existing = await repos.folders.list();
      const fields = this.validate(raw, existing);
      const sortOrder = existing.reduce((m, f) => Math.max(m, f.sortOrder), -1) + 1;
      const folder: Folder = { id: newId(), ...fields, status: 'active', sortOrder, createdAt: now, updatedAt: now, archivedAt: null };
      await repos.folders.insert(folder);
      return folder;
    });
  }

  async update(id: string, raw: FolderInput & { status?: FolderStatus }): Promise<Folder> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const current = await repos.folders.get(id);
      if (!current) throw new NotFoundError('This folder no longer exists.');
      const status = raw.status ?? current.status;
      if (status !== 'active' && status !== 'archived' && status !== 'completed') throw new ValidationError('Unknown folder status.');
      const others = (await repos.folders.list()).filter((f) => f.id !== id);
      const fields = this.validate(raw, status === 'active' ? others : []);
      const now = nowIso(this.clock);
      const next: Folder = {
        ...current,
        ...fields,
        status,
        archivedAt: status === 'archived' ? (current.archivedAt ?? now) : null,
        updatedAt: now,
      };
      await repos.folders.update(next);
      return next;
    });
  }

  async archive(id: string): Promise<Folder> {
    const current = await this.get(id);
    return this.update(id, { ...inputOf(current), status: 'archived' });
  }

  async restore(id: string): Promise<Folder> {
    const current = await this.get(id);
    return this.update(id, { ...inputOf(current), status: 'active' });
  }

  async complete(id: string): Promise<Folder> {
    const current = await this.get(id);
    return this.update(id, { ...inputOf(current), status: 'completed' });
  }

  /**
   * Deletes the folder only. Tasks stay. `unassign` clears the link and, for
   * inherited tasks, freezes the folder priority as an explicit priority so
   * the task keeps the priority it was showing. `move` keeps the explicit flag.
   */
  async delete(id: string, plan: FolderDeletePlan): Promise<number> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const folder = await repos.folders.get(id);
      if (!folder) throw new NotFoundError('This folder no longer exists.');
      const now = nowIso(this.clock);
      const tasks = await repos.tasks.list({ folder_id: id });
      if (plan.mode === 'move') {
        if (plan.folderId === id) throw new ValidationError('Pick a different folder.');
        const target = await repos.folders.get(plan.folderId);
        if (!target) throw new ValidationError('That folder no longer exists.');
        if (target.status === 'archived') throw new ValidationError('Archived folders cannot take tasks. Restore it first.');
        for (const task of tasks) await repos.tasks.patch(task.id, { folderId: target.id, updatedAt: now });
      } else {
        for (const task of tasks) {
          const patch: Partial<Task> = { folderId: null, updatedAt: now };
          if (!task.priorityExplicit) {
            patch.priority = folder.priority;
            patch.priorityExplicit = true;
          }
          await repos.tasks.patch(task.id, patch);
        }
      }
      await repos.folders.delete(id);
      return tasks.length;
    });
  }

  async reorder(orderedIds: string[]): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const all = await repos.folders.list();
      const known = new Set(all.map((f) => f.id));
      const lead = orderedIds.filter((id, i) => known.has(id) && orderedIds.indexOf(id) === i);
      const rest = all.filter((f) => !lead.includes(f.id)).map((f) => f.id);
      const now = nowIso(this.clock);
      let i = 0;
      for (const id of [...lead, ...rest]) {
        await repos.folders.patch(id, { sortOrder: i++, updatedAt: now });
      }
    });
  }

  /** Move or clear one task's folder without touching its dates or recurrence. */
  async assignTask(taskId: string, folderId: string | null): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const task = await repos.tasks.get(taskId);
      if (!task || task.deletedAt) throw new NotFoundError('This item no longer exists.');
      const now = nowIso(this.clock);
      if (!folderId) {
        const patch: Partial<Task> = { folderId: null, updatedAt: now };
        if (!task.priorityExplicit && task.folderId) {
          const current = await repos.folders.get(task.folderId);
          if (current) {
            patch.priority = current.priority;
            patch.priorityExplicit = true;
          }
        }
        await repos.tasks.patch(taskId, patch);
        return;
      }
      await resolveFolderForWrite(repos, folderId, task.folderId);
      await repos.tasks.patch(taskId, { folderId, updatedAt: now });
    });
  }

  private validate(raw: FolderInput, activePeers: Folder[], selfId?: string): Omit<Folder, 'id' | 'status' | 'sortOrder' | 'createdAt' | 'updatedAt' | 'archivedAt'> {
    const name = raw.name.trim();
    if (!name) throw new ValidationError('Folder name is required.');
    if (name.length > 60) throw new ValidationError('Folder name must be 60 characters or fewer.');
    const description = (raw.description ?? '').trim();
    if (description.length > 500) throw new ValidationError('Description must be 500 characters or fewer.');
    if (!HEX.test(raw.color)) throw new ValidationError('Color must be a hex value like #6366F1.');
    if (!(FOLDER_ICONS as readonly string[]).includes(raw.icon)) throw new ValidationError('Choose a folder icon from the list.');
    if (!PRIORITIES.includes(raw.priority)) throw new ValidationError('Unknown priority.');
    const targetDate = raw.targetDate ?? null;
    if (targetDate && !isDateKey(targetDate)) throw new ValidationError('Target date is invalid.');
    this.assertActiveName(name, activePeers, selfId);
    return { name, description, color: raw.color, icon: raw.icon, targetDate, priority: raw.priority };
  }

  private assertActiveName(name: string, peers: Folder[], selfId?: string) {
    const key = name.toLowerCase();
    if (peers.some((f) => f.id !== selfId && f.status === 'active' && f.name.trim().toLowerCase() === key)) {
      throw new ValidationError(`An active folder named "${name}" already exists.`);
    }
  }
}

function inputOf(folder: Folder): FolderInput {
  return {
    name: folder.name,
    description: folder.description,
    color: folder.color,
    icon: folder.icon,
    targetDate: folder.targetDate,
    priority: folder.priority,
  };
}
