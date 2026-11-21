import * as SQLite from 'expo-sqlite';

import { SqliteDatabase, type SqlExecutor } from './sqlite/sqliteDriver';
import type { Database, Row } from './types';

export const DATABASE_NAME = 'schedule.db';

/** Android/iOS: real SQLite file in the app sandbox. */
export async function openAppDatabase(): Promise<Database> {
  const native = await SQLite.openDatabaseAsync(DATABASE_NAME);
  const executor: SqlExecutor = {
    exec: (sql) => native.execAsync(sql),
    run: async (sql, params) => {
      const r = await native.runAsync(sql, params);
      return { changes: r.changes };
    },
    all: (sql, params) => native.getAllAsync<Row>(sql, params),
    close: () => native.closeAsync(),
  };
  return SqliteDatabase.open(executor);
}
