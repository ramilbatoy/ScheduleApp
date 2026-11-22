import { Mutex } from '../mutex';
import { assertKnownTable } from '../schema';
import { ConstraintError, type Database, type DbOps, type FindOptions, type Row, type SqlValue, type Where } from '../types';
import { LATEST_SCHEMA_VERSION, SQLITE_MIGRATIONS } from './migrations';
import { buildCount, buildDelete, buildInsert, buildSelect, buildUpdate } from './sqlBuilder';

/** Minimal surface over a single SQLite connection (expo-sqlite on device, node:sqlite in tests). */
export interface SqlExecutor {
  exec(sql: string): Promise<void>;
  run(sql: string, params: SqlValue[]): Promise<{ changes: number }>;
  all(sql: string, params: SqlValue[]): Promise<Row[]>;
  close(): Promise<void>;
}

function wrapError(e: unknown): never {
  const msg = e instanceof Error ? e.message : String(e);
  if (/UNIQUE constraint failed/i.test(msg)) throw new ConstraintError(msg);
  throw e;
}

class SqliteOps implements DbOps {
  constructor(protected readonly ex: SqlExecutor) {}

  async get(table: string, id: string): Promise<Row | null> {
    assertKnownTable(table);
    const rows = await this.ex.all(`SELECT * FROM "${table}" WHERE id = ? LIMIT 1`, [id]);
    return rows[0] ? { ...rows[0] } : null;
  }

  async find(table: string, options?: FindOptions): Promise<Row[]> {
    const q = buildSelect(table, options);
    const rows = await this.ex.all(q.sql, q.params);
    return rows.map((r) => ({ ...r }));
  }

  async count(table: string, where?: Where): Promise<number> {
    const q = buildCount(table, where);
    const rows = await this.ex.all(q.sql, q.params);
    return Number(rows[0]?.n ?? 0);
  }

  async insert(table: string, row: Row): Promise<void> {
    const q = buildInsert(table, row);
    await this.ex.run(q.sql, q.params).catch(wrapError);
  }

  async update(table: string, id: string, patch: Row): Promise<void> {
    await this.updateWhere(table, { id }, patch);
  }

  async updateWhere(table: string, where: Where, patch: Row): Promise<number> {
    if (Object.keys(patch).filter((k) => k !== 'id').length === 0) return 0;
    const q = buildUpdate(table, where, patch);
    const r = await this.ex.run(q.sql, q.params).catch(wrapError);
    return r.changes;
  }

  async delete(table: string, id: string): Promise<void> {
    await this.deleteWhere(table, { id });
  }

  async deleteWhere(table: string, where: Where): Promise<number> {
    const q = buildDelete(table, where);
    const r = await this.ex.run(q.sql, q.params);
    return r.changes;
  }
}

export class SqliteDatabase extends SqliteOps implements Database {
  readonly kind = 'sqlite' as const;
  private readonly mutex = new Mutex();

  private constructor(ex: SqlExecutor) {
    super(ex);
  }

  static async open(ex: SqlExecutor): Promise<SqliteDatabase> {
    await ex.exec('PRAGMA foreign_keys = ON');
    const db = new SqliteDatabase(ex);
    await db.migrate();
    return db;
  }

  async schemaVersion(): Promise<number> {
    const rows = await this.ex.all('PRAGMA user_version', []);
    return Number(rows[0]?.user_version ?? 0);
  }

  private async migrate(): Promise<void> {
    const current = await this.schemaVersion();
    if (current > LATEST_SCHEMA_VERSION) {
      throw new Error(
        `Database schema v${current} is newer than this app supports (v${LATEST_SCHEMA_VERSION}). Update the app.`,
      );
    }
    for (const m of SQLITE_MIGRATIONS) {
      if (m.version <= current) continue;
      await this.ex.exec('BEGIN IMMEDIATE');
      try {
        for (const stmt of m.statements) await this.ex.exec(stmt);
        await this.ex.exec(`PRAGMA user_version = ${m.version}`);
        await this.ex.exec('COMMIT');
      } catch (e) {
        await this.ex.exec('ROLLBACK').catch(() => undefined);
        throw new Error(`Migration ${m.name} failed: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      await this.ex.exec('BEGIN IMMEDIATE');
      try {
        const result = await fn(new SqliteOps(this.ex));
        await this.ex.exec('COMMIT');
        return result;
      } catch (e) {
        await this.ex.exec('ROLLBACK').catch(() => undefined);
        throw e;
      }
    });
  }

  override get(table: string, id: string) {
    return this.mutex.run(() => super.get(table, id));
  }
  override find(table: string, options?: FindOptions) {
    return this.mutex.run(() => super.find(table, options));
  }
  override count(table: string, where?: Where) {
    return this.mutex.run(() => super.count(table, where));
  }
  override insert(table: string, row: Row) {
    return this.mutex.run(() => super.insert(table, row));
  }
  override updateWhere(table: string, where: Where, patch: Row) {
    return this.mutex.run(() => super.updateWhere(table, where, patch));
  }
  override deleteWhere(table: string, where: Where) {
    return this.mutex.run(() => super.deleteWhere(table, where));
  }

  close(): Promise<void> {
    return this.mutex.run(() => this.ex.close());
  }
}
