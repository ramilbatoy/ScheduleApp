import 'fake-indexeddb/auto';

import { IndexedDbPersistence } from '../indexeddb/idbPersistence';
import { MemoryDatabase } from '../memory/memoryDriver';
import { LATEST_SCHEMA_VERSION } from '../sqlite/migrations';
import { SqliteDatabase } from '../sqlite/sqliteDriver';
import { ConstraintError, type Database, type Row } from '../types';
import { DRIVERS, nodeSqliteExecutor } from '../../test/databases';

const now = '2026-01-01T00:00:00.000Z';

function category(id: string, name: string, sort = 0): Row {
  return { id, name, color: '#000000', is_default: 0, sort_order: sort, created_at: now, updated_at: now };
}

function task(id: string): Row {
  return {
    id,
    item_kind: 'task',
    title: `Task ${id}`,
    notes: '',
    category_id: null,
    priority: 'medium',
    all_day: 0,
    default_start_time: null,
    default_end_time: null,
    deadline_at: null,
    recurring_rule_id: null,
    series_id: null,
    reminder_offset_minutes: null,
    deadline_reminder_offset_minutes: null,
    created_at: now,
    updated_at: now,
    deleted_at: null,
  };
}

function occ(id: string, taskId: string, date: string, status = 'pending', key: string | null = null): Row {
  return {
    id,
    task_id: taskId,
    occurrence_date: date,
    start_time: null,
    end_time: null,
    status,
    completed_at: null,
    is_carried_forward: 0,
    carry_forward_count: 0,
    source: 'manual',
    recurrence_instance_key: key,
    original_occurrence_date: null,
    is_exception: 0,
    title_override: null,
    notes_override: null,
    created_at: now,
    updated_at: now,
  };
}

describe.each(DRIVERS)('%s driver', (_name, open) => {
  let db: Database;
  beforeEach(async () => {
    db = await open();
  });
  afterEach(async () => {
    await db.close();
  });

  it('reports the latest schema version after migrating', async () => {
    expect(await db.schemaVersion()).toBe(LATEST_SCHEMA_VERSION);
  });

  it('inserts, reads, updates and deletes rows', async () => {
    await db.insert('categories', category('a', 'Alpha'));
    expect((await db.get('categories', 'a'))?.name).toBe('Alpha');
    await db.update('categories', 'a', { name: 'Renamed' });
    expect((await db.get('categories', 'a'))?.name).toBe('Renamed');
    await db.delete('categories', 'a');
    expect(await db.get('categories', 'a')).toBeNull();
  });

  it('supports where operators, ordering and limits', async () => {
    await db.insert('categories', category('a', 'Alpha', 2));
    await db.insert('categories', category('b', 'beta', 1));
    await db.insert('categories', category('c', 'Gamma_x', 3));
    const ordered = await db.find('categories', { orderBy: [{ column: 'sort_order', dir: 'desc' }] });
    expect(ordered.map((r) => r.id)).toEqual(['c', 'a', 'b']);
    expect((await db.find('categories', { where: { sort_order: { gte: 2 } } })).length).toBe(2);
    expect((await db.find('categories', { where: { id: { in: ['a', 'c'] } } })).length).toBe(2);
    expect((await db.find('categories', { where: { id: { in: [] } } })).length).toBe(0);
    expect((await db.find('categories', { where: { name: { contains: 'ETA' } } })).map((r) => r.id)).toEqual(['b']);
    expect((await db.find('categories', { where: { name: { contains: '_x' } } })).map((r) => r.id)).toEqual(['c']);
    expect((await db.find('categories', { limit: 1, orderBy: [{ column: 'name' }] })).length).toBe(1);
    expect(await db.count('categories', { id: { ne: 'a' } })).toBe(2);
  });

  it('rejects duplicate primary keys', async () => {
    await db.insert('categories', category('a', 'A'));
    await expect(db.insert('categories', category('a', 'B'))).rejects.toBeInstanceOf(ConstraintError);
  });

  it('enforces one active occurrence per task per day but allows cancelled duplicates', async () => {
    await db.insert('tasks', task('t'));
    await db.insert('task_occurrences', occ('o1', 't', '2026-01-02'));
    await expect(db.insert('task_occurrences', occ('o2', 't', '2026-01-02'))).rejects.toBeInstanceOf(ConstraintError);
    await db.insert('task_occurrences', occ('o3', 't', '2026-01-02', 'cancelled'));
    await expect(db.update('task_occurrences', 'o3', { status: 'completed' })).rejects.toBeInstanceOf(ConstraintError);
  });

  it('enforces unique recurrence instance keys', async () => {
    await db.insert('tasks', task('t'));
    await db.insert('task_occurrences', occ('o1', 't', '2026-01-02', 'pending', '2026-01-02'));
    await expect(
      db.insert('task_occurrences', occ('o2', 't', '2026-01-05', 'cancelled', '2026-01-02')),
    ).rejects.toBeInstanceOf(ConstraintError);
  });

  it('rolls back every write when a transaction throws', async () => {
    await expect(
      db.transaction(async (tx) => {
        await tx.insert('categories', category('a', 'A'));
        await tx.insert('categories', category('b', 'B'));
        throw new Error('boom');
      }),
    ).rejects.toThrow('boom');
    expect(await db.count('categories')).toBe(0);
  });

  it('serializes concurrent transactions', async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        db.transaction(async (tx) => {
          const n = await tx.count('categories');
          await tx.insert('categories', category(`c${i}`, `C${i}`, n));
          return n;
        }),
      ),
    );
    expect(results.sort()).toEqual([0, 1, 2, 3, 4]);
  });
});

describe('sqlite migrations', () => {
  it('re-opening an existing file does not re-run migrations', async () => {
    const ex = nodeSqliteExecutor();
    const db = await SqliteDatabase.open(ex);
    await db.insert('categories', category('a', 'A'));
    const again = await SqliteDatabase.open(ex);
    expect(await again.count('categories')).toBe(1);
  });

  it('refuses to open a database from a newer app version', async () => {
    const ex = nodeSqliteExecutor();
    await ex.exec(`PRAGMA user_version = ${LATEST_SCHEMA_VERSION + 1}`);
    await expect(SqliteDatabase.open(ex)).rejects.toThrow(/newer than this app supports/);
  });
});

describe('IndexedDB persistence (web)', () => {
  it('persists committed writes across reopen and drops rolled-back ones', async () => {
    const name = `test-${Math.random()}`;
    const db = await MemoryDatabase.open(await IndexedDbPersistence.open(name), 'indexeddb');
    await db.insert('categories', category('a', 'Kept'));
    await db
      .transaction(async (tx) => {
        await tx.insert('categories', category('b', 'Dropped'));
        throw new Error('abort');
      })
      .catch(() => undefined);
    await db.update('categories', 'a', { name: 'Kept v2' });
    await db.close();

    const reopened = await MemoryDatabase.open(await IndexedDbPersistence.open(name), 'indexeddb');
    const rows = await reopened.find('categories');
    expect(rows.map((r) => [r.id, r.name])).toEqual([['a', 'Kept v2']]);
    await reopened.delete('categories', 'a');
    await reopened.close();

    const third = await MemoryDatabase.open(await IndexedDbPersistence.open(name), 'indexeddb');
    expect(await third.count('categories')).toBe(0);
  });
});
