import { Mutex } from '../mutex';
import { SCHEMA, TABLES, assertKnownColumns, assertKnownTable } from '../schema';
import { LATEST_SCHEMA_VERSION } from '../sqlite/migrations';
import { ConstraintError, type Database, type DbOps, type DriverKind, type FindOptions, type Row, type Where } from '../types';
import { matchesWhere, sortRows } from './match';

export interface RowChange {
  table: string;
  id: string;
  /** `null` means the row was deleted. */
  row: Row | null;
}

/** Durable backing store for the in-memory driver (IndexedDB on web). */
export interface MemoryPersistence {
  load(): Promise<Record<string, Row[]>>;
  commit(changes: RowChange[]): Promise<void>;
  close(): Promise<void>;
}

type Tables = Map<string, Map<string, Row>>;

class MemoryOps implements DbOps {
  /** Original value of every row touched in this unit of work (undefined = did not exist). */
  readonly journal = new Map<string, { table: string; id: string; before: Row | undefined }>();

  constructor(private readonly tables: Tables) {}

  private store(table: string): Map<string, Row> {
    assertKnownTable(table);
    return this.tables.get(table)!;
  }

  private touch(table: string, id: string) {
    const key = `${table}\u0000${id}`;
    if (!this.journal.has(key)) {
      const existing = this.tables.get(table)!.get(id);
      this.journal.set(key, { table, id, before: existing ? { ...existing } : undefined });
    }
  }

  private normalize(table: string, row: Row): Row {
    const def = SCHEMA[table];
    assertKnownColumns(table, Object.keys(row));
    const out: Row = {};
    for (const [col, cdef] of Object.entries(def.columns)) {
      const v = row[col] === undefined ? null : row[col];
      if (v === null && !cdef.nullable) throw new ConstraintError(`NOT NULL constraint failed: ${table}.${col}`);
      out[col] = v;
    }
    return out;
  }

  private checkUnique(table: string, row: Row) {
    const def = SCHEMA[table];
    for (const u of def.unique ?? []) {
      if (u.when && !u.when(row)) continue;
      for (const other of this.tables.get(table)!.values()) {
        if (other.id === row.id) continue;
        if (u.when && !u.when(other)) continue;
        if (u.columns.every((c) => other[c] === row[c])) {
          throw new ConstraintError(`UNIQUE constraint failed: ${table}.${u.columns.join(', ')}`);
        }
      }
    }
  }

  async get(table: string, id: string): Promise<Row | null> {
    const r = this.store(table).get(id);
    return r ? { ...r } : null;
  }

  async find(table: string, options: FindOptions = {}): Promise<Row[]> {
    if (options.where) assertKnownColumns(table, Object.keys(options.where));
    const rows = [...this.store(table).values()].filter((r) => matchesWhere(r, options.where));
    const sorted = sortRows(rows, options.orderBy);
    const limited = options.limit !== undefined ? sorted.slice(0, options.limit) : sorted;
    return limited.map((r) => ({ ...r }));
  }

  async count(table: string, where?: Where): Promise<number> {
    return (await this.find(table, { where })).length;
  }

  async insert(table: string, row: Row): Promise<void> {
    const s = this.store(table);
    const normalized = this.normalize(table, row);
    const id = String(normalized.id);
    if (s.has(id)) throw new ConstraintError(`UNIQUE constraint failed: ${table}.id`);
    this.checkUnique(table, normalized);
    this.touch(table, id);
    s.set(id, normalized);
  }

  async update(table: string, id: string, patch: Row): Promise<void> {
    await this.updateWhere(table, { id }, patch);
  }

  async updateWhere(table: string, where: Where, patch: Row): Promise<number> {
    const s = this.store(table);
    assertKnownColumns(table, Object.keys(patch));
    const targets = [...s.values()].filter((r) => matchesWhere(r, where));
    for (const r of targets) {
      const next = this.normalize(table, { ...r, ...patch, id: r.id });
      this.checkUnique(table, next);
      this.touch(table, String(r.id));
      s.set(String(r.id), next);
    }
    return targets.length;
  }

  async delete(table: string, id: string): Promise<void> {
    await this.deleteWhere(table, { id });
  }

  async deleteWhere(table: string, where: Where): Promise<number> {
    const s = this.store(table);
    const targets = [...s.values()].filter((r) => matchesWhere(r, where));
    for (const r of targets) {
      this.touch(table, String(r.id));
      s.delete(String(r.id));
    }
    return targets.length;
  }

  rollback() {
    for (const { table, id, before } of [...this.journal.values()].reverse()) {
      const s = this.tables.get(table)!;
      if (before) s.set(id, before);
      else s.delete(id);
    }
    this.journal.clear();
  }

  changes(): RowChange[] {
    return [...this.journal.values()].map(({ table, id }) => {
      const r = this.tables.get(table)!.get(id);
      return { table, id, row: r ? { ...r } : null };
    });
  }
}

/**
 * Queries run against an in-memory copy of every table; each committed unit
 * of work is written atomically to the persistence layer before it resolves.
 * Used for web (IndexedDB persistence) and tests (no persistence).
 */
export class MemoryDatabase implements Database {
  private readonly mutex = new Mutex();

  private constructor(
    private readonly tables: Tables,
    private readonly persistence: MemoryPersistence | null,
    readonly kind: DriverKind,
  ) {}

  static async open(persistence: MemoryPersistence | null = null, kind: DriverKind = 'memory'): Promise<MemoryDatabase> {
    const tables: Tables = new Map(TABLES.map((name) => [name, new Map<string, Row>()]));
    if (persistence) {
      const data = await persistence.load();
      for (const [name, rows] of Object.entries(data)) {
        const store = tables.get(name);
        if (!store) continue;
        for (const r of rows) store.set(String(r.id), r);
      }
    }
    return new MemoryDatabase(tables, persistence, kind);
  }

  async schemaVersion(): Promise<number> {
    return LATEST_SCHEMA_VERSION;
  }

  transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T> {
    return this.mutex.run(async () => {
      const ops = new MemoryOps(this.tables);
      let result: T;
      try {
        result = await fn(ops);
      } catch (e) {
        ops.rollback();
        throw e;
      }
      const changes = ops.changes();
      if (changes.length && this.persistence) {
        try {
          await this.persistence.commit(changes);
        } catch (e) {
          ops.rollback();
          throw e;
        }
      }
      return result;
    });
  }

  get(table: string, id: string) {
    return this.transaction((tx) => tx.get(table, id));
  }
  find(table: string, options?: FindOptions) {
    return this.transaction((tx) => tx.find(table, options));
  }
  count(table: string, where?: Where) {
    return this.transaction((tx) => tx.count(table, where));
  }
  insert(table: string, row: Row) {
    return this.transaction((tx) => tx.insert(table, row));
  }
  update(table: string, id: string, patch: Row) {
    return this.transaction((tx) => tx.update(table, id, patch));
  }
  updateWhere(table: string, where: Where, patch: Row) {
    return this.transaction((tx) => tx.updateWhere(table, where, patch));
  }
  delete(table: string, id: string) {
    return this.transaction((tx) => tx.delete(table, id));
  }
  deleteWhere(table: string, where: Where) {
    return this.transaction((tx) => tx.deleteWhere(table, where));
  }

  async close(): Promise<void> {
    await this.mutex.run(async () => this.persistence?.close());
  }
}
