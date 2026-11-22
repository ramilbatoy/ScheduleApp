import { openDB, type IDBPDatabase } from 'idb';

import type { MemoryPersistence, RowChange } from '../memory/memoryDriver';
import { TABLES } from '../schema';
import type { Row } from '../types';

/**
 * IndexedDB versions. Each upgrade step mirrors a SQLite migration so both
 * platforms move through the same schema sequence. Rows are stored whole in
 * one object store per table keyed by `id`.
 */
const IDB_UPGRADES: { version: number; apply: (db: IDBPDatabase) => void }[] = [
  {
    version: 1,
    apply: (db) => {
      for (const table of TABLES) {
        if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
      }
    },
  },
  {
    // Ensures stores added after v1 (e.g. task_subtasks) exist on upgrade.
    version: 2,
    apply: (db) => {
      for (const table of TABLES) {
        if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
      }
    },
  },
  {
    // folders object store. Task folder_id / priority_explicit live on the row documents.
    version: 3,
    apply: (db) => {
      for (const table of TABLES) {
        if (!db.objectStoreNames.contains(table)) db.createObjectStore(table, { keyPath: 'id' });
      }
    },
  },
];

export const IDB_VERSION = IDB_UPGRADES[IDB_UPGRADES.length - 1].version;

export class IndexedDbPersistence implements MemoryPersistence {
  private constructor(private readonly db: IDBPDatabase) {}

  static async open(name = 'schedule-app', factory?: IDBFactory): Promise<IndexedDbPersistence> {
    if (factory) (globalThis as { indexedDB?: IDBFactory }).indexedDB = factory;
    if (typeof indexedDB === 'undefined') {
      throw new Error('IndexedDB is not available in this browser; data cannot be stored.');
    }
    const db = await openDB(name, IDB_VERSION, {
      upgrade(database, oldVersion) {
        for (const step of IDB_UPGRADES) {
          if (step.version > oldVersion) step.apply(database);
        }
      },
      blocked() {
        console.warn('IndexedDB upgrade blocked by another open tab.');
      },
    });
    return new IndexedDbPersistence(db);
  }

  async load(): Promise<Record<string, Row[]>> {
    const out: Record<string, Row[]> = {};
    const tx = this.db.transaction(TABLES, 'readonly');
    for (const table of TABLES) out[table] = (await tx.objectStore(table).getAll()) as Row[];
    await tx.done;
    return out;
  }

  async commit(changes: RowChange[]): Promise<void> {
    const tables = [...new Set(changes.map((c) => c.table))];
    const tx = this.db.transaction(tables, 'readwrite');
    const ops = changes.map((c) =>
      c.row ? tx.objectStore(c.table).put(c.row) : tx.objectStore(c.table).delete(c.id),
    );
    await Promise.all([...ops, tx.done]);
  }

  async close(): Promise<void> {
    this.db.close();
  }
}
