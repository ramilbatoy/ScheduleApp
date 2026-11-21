import type { Database } from '../../db/types';
import { nowIso, type Clock } from '../dates';
import { newId } from '../ids';
import { ValidationError, type Category } from '../models';
import { createRepos } from '../repos/repositories';

export const DEFAULT_CATEGORIES: { name: string; color: string }[] = [
  { name: 'Personal', color: '#3B82F6' },
  { name: 'Work', color: '#F59E0B' },
  { name: 'Meetings', color: '#8B5CF6' },
  { name: 'Health', color: '#10B981' },
  { name: 'Family', color: '#EC4899' },
  { name: 'Finance', color: '#14B8A6' },
  { name: 'Projects', color: '#6366F1' },
  { name: 'Others', color: '#6B7280' },
];

export const CATEGORY_PALETTE = [
  '#3B82F6', '#F59E0B', '#8B5CF6', '#10B981', '#EC4899', '#14B8A6',
  '#6366F1', '#6B7280', '#EF4444', '#F97316', '#84CC16', '#06B6D4',
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

export class CategoryService {
  constructor(
    private readonly db: Database,
    private readonly clock: Clock,
  ) {}

  /** Seeds defaults once per install; a user who deletes them is not re-seeded. */
  async seedDefaults(): Promise<void> {
    await this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const settings = await repos.settings.getAll();
      const now = nowIso(this.clock);
      if (settings.categoriesSeeded) return;
      if ((await repos.categories.count()) === 0) {
        let order = 0;
        for (const c of DEFAULT_CATEGORIES) {
          await repos.categories.insert({
            id: newId(),
            name: c.name,
            color: c.color,
            isDefault: true,
            sortOrder: order++,
            createdAt: now,
            updatedAt: now,
          });
        }
      }
      await repos.settings.set('categoriesSeeded', true, now);
    });
  }

  list(): Promise<Category[]> {
    return createRepos(this.db).categories.list();
  }

  private validate(name: string, color: string, existing: Category[], selfId?: string) {
    const trimmed = name.trim();
    if (!trimmed) throw new ValidationError('Category name is required.');
    if (trimmed.length > 40) throw new ValidationError('Category name must be 40 characters or fewer.');
    if (!HEX.test(color)) throw new ValidationError('Color must be a hex value like #3B82F6.');
    if (existing.some((c) => c.id !== selfId && c.name.toLowerCase() === trimmed.toLowerCase())) {
      throw new ValidationError(`A category named "${trimmed}" already exists.`);
    }
    return trimmed;
  }

  async create(name: string, color: string): Promise<Category> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const existing = await repos.categories.list();
      const now = nowIso(this.clock);
      const category: Category = {
        id: newId(),
        name: this.validate(name, color, existing),
        color,
        isDefault: false,
        sortOrder: existing.reduce((m, c) => Math.max(m, c.sortOrder), -1) + 1,
        createdAt: now,
        updatedAt: now,
      };
      await repos.categories.insert(category);
      return category;
    });
  }

  async update(id: string, name: string, color: string): Promise<Category> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const existing = await repos.categories.list();
      const current = existing.find((c) => c.id === id);
      if (!current) throw new ValidationError('Category not found.');
      const next = { ...current, name: this.validate(name, color, existing, id), color, updatedAt: nowIso(this.clock) };
      await repos.categories.update(next);
      return next;
    });
  }

  /** Items in the category become uncategorized; they are never deleted. */
  async delete(id: string): Promise<number> {
    return this.db.transaction(async (tx) => {
      const repos = createRepos(tx);
      const affected = await repos.tasks.list({ category_id: id });
      const now = nowIso(this.clock);
      for (const t of affected) await repos.tasks.patch(t.id, { categoryId: null, updatedAt: now });
      await repos.categories.delete(id);
      return affected.length;
    });
  }
}
