export type SqlValue = string | number | null;
export type Row = Record<string, SqlValue>;

export type Condition =
  | SqlValue
  | {
      eq?: SqlValue;
      ne?: SqlValue;
      lt?: string | number;
      lte?: string | number;
      gt?: string | number;
      gte?: string | number;
      in?: SqlValue[];
      notIn?: SqlValue[];
      /** Case-insensitive substring match. */
      contains?: string;
    };

/** Every key is ANDed. A bare `null` means IS NULL. */
export type Where = Record<string, Condition>;

export interface OrderBy {
  column: string;
  dir?: 'asc' | 'desc';
}

export interface FindOptions {
  where?: Where;
  orderBy?: OrderBy[];
  limit?: number;
}

/**
 * Storage operations shared by every platform driver. Rows always carry a
 * text primary key named `id`.
 */
export interface DbOps {
  get(table: string, id: string): Promise<Row | null>;
  find(table: string, options?: FindOptions): Promise<Row[]>;
  count(table: string, where?: Where): Promise<number>;
  insert(table: string, row: Row): Promise<void>;
  update(table: string, id: string, patch: Row): Promise<void>;
  updateWhere(table: string, where: Where, patch: Row): Promise<number>;
  delete(table: string, id: string): Promise<void>;
  deleteWhere(table: string, where: Where): Promise<number>;
}

export type DriverKind = 'sqlite' | 'indexeddb' | 'memory';

export interface Database extends DbOps {
  readonly kind: DriverKind;
  /** Runs `fn` atomically. Use only the provided `tx` inside `fn`. */
  transaction<T>(fn: (tx: DbOps) => Promise<T>): Promise<T>;
  schemaVersion(): Promise<number>;
  close(): Promise<void>;
}

export class ConstraintError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ConstraintError';
  }
}
