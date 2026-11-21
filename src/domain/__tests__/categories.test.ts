import { fixedClock } from '../dates';
import { ValidationError } from '../models';
import { DEFAULT_CATEGORIES } from '../services/categoryService';
import { AppServices } from '../services/container';
import { DRIVERS } from '../../test/databases';

describe.each(DRIVERS)('categories (%s)', (_name, open) => {
  let app: AppServices;
  beforeEach(async () => {
    app = new AppServices(await open(), fixedClock('2026-03-10T09:00:00'));
    await app.bootstrap();
  });

  it('seeds the eight default categories exactly once', async () => {
    await app.bootstrap();
    const list = await app.categories.list();
    expect(list.map((c) => c.name)).toEqual(DEFAULT_CATEGORIES.map((c) => c.name));
    expect(list.every((c) => c.isDefault)).toBe(true);
  });

  it('does not re-seed after the user deletes every category', async () => {
    for (const c of await app.categories.list()) await app.categories.delete(c.id);
    await app.bootstrap();
    expect(await app.categories.list()).toHaveLength(0);
  });

  it('creates, renames and validates custom categories', async () => {
    const c = await app.categories.create('  Errands ', '#EF4444');
    expect(c.name).toBe('Errands');
    await expect(app.categories.create('errands', '#EF4444')).rejects.toBeInstanceOf(ValidationError);
    await expect(app.categories.create('Bad', 'red')).rejects.toBeInstanceOf(ValidationError);
    await expect(app.categories.create('   ', '#EF4444')).rejects.toBeInstanceOf(ValidationError);
    const renamed = await app.categories.update(c.id, 'Chores', '#84CC16');
    expect(renamed).toMatchObject({ name: 'Chores', color: '#84CC16' });
  });

  it('persists settings', async () => {
    expect((await app.settings.get()).autoCarryForward).toBe(true);
    await app.settings.set('autoCarryForward', false);
    await app.settings.set('theme', 'dark');
    const s = await app.settings.get();
    expect(s.autoCarryForward).toBe(false);
    expect(s.theme).toBe('dark');
  });
});
