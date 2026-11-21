import { DatabaseSync } from 'node:sqlite';

import { MemoryDatabase } from '../db/memory/memoryDriver';
import { SqliteDatabase, type SqlExecutor } from '../db/sqlite/sqliteDriver';
import type { Database, Row } from '../db/types';

export function nodeSqliteExecutor(path = ':memory:'): SqlExecutor {
  const db = new DatabaseSync(path);
  return {
    exec: async (sql) => {
      db.exec(sql);
    },
    run: async (sql, params) => {
      const r = db.prepare(sql).run(...params);
      return { changes: Number(r.changes) };
    },
    all: async (sql, params) => db.prepare(sql).all(...params) as Row[],
    close: async () => db.close(),
  };
}

export const DRIVERS: [string, () => Promise<Database>][] = [
  ['sqlite', () => SqliteDatabase.open(nodeSqliteExecutor())],
  ['memory', () => MemoryDatabase.open()],
];
