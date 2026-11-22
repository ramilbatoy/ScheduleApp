import { assertKnownColumns } from '../schema';
import type { Condition, FindOptions, Row, SqlValue, Where } from '../types';

export interface Sql {
  sql: string;
  params: SqlValue[];
}

const OPS: Record<string, string> = { eq: '=', ne: '!=', lt: '<', lte: '<=', gt: '>', gte: '>=' };

function isOperatorObject(c: Condition): c is Exclude<Condition, SqlValue> {
  return c !== null && typeof c === 'object';
}

export function buildWhere(table: string, where: Where | undefined): Sql {
  if (!where || Object.keys(where).length === 0) return { sql: '', params: [] };
  assertKnownColumns(table, Object.keys(where));
  const parts: string[] = [];
  const params: SqlValue[] = [];
  for (const [col, cond] of Object.entries(where)) {
    const q = `"${col}"`;
    if (!isOperatorObject(cond)) {
      if (cond === null) parts.push(`${q} IS NULL`);
      else {
        parts.push(`${q} = ?`);
        params.push(cond);
      }
      continue;
    }
    for (const [op, value] of Object.entries(cond)) {
      if (value === undefined) continue;
      if (op === 'in' || op === 'notIn') {
        const list = value as SqlValue[];
        if (list.length === 0) {
          parts.push(op === 'in' ? '0' : '1');
          continue;
        }
        parts.push(`${q} ${op === 'in' ? 'IN' : 'NOT IN'} (${list.map(() => '?').join(',')})`);
        params.push(...list);
      } else if (op === 'contains') {
        parts.push(`LOWER(${q}) LIKE ? ESCAPE '\\'`);
        const escaped = String(value).toLowerCase().replace(/[\\%_]/g, (m) => `\\${m}`);
        params.push(`%${escaped}%`);
      } else if ((op === 'eq' || op === 'ne') && value === null) {
        parts.push(`${q} IS ${op === 'eq' ? '' : 'NOT '}NULL`);
      } else {
        const sqlOp = OPS[op];
        if (!sqlOp) throw new Error(`Unsupported operator ${op}`);
        parts.push(`${q} ${sqlOp} ?`);
        params.push(value as SqlValue);
      }
    }
  }
  return { sql: parts.length ? ` WHERE ${parts.join(' AND ')}` : '', params };
}

export function buildSelect(table: string, options: FindOptions = {}): Sql {
  const w = buildWhere(table, options.where);
  let sql = `SELECT * FROM "${table}"${w.sql}`;
  if (options.orderBy?.length) {
    assertKnownColumns(table, options.orderBy.map((o) => o.column));
    sql += ` ORDER BY ${options.orderBy.map((o) => `"${o.column}" ${o.dir === 'desc' ? 'DESC' : 'ASC'}`).join(', ')}`;
  }
  const params = [...w.params];
  if (options.limit !== undefined) {
    sql += ' LIMIT ?';
    params.push(options.limit);
  }
  return { sql, params };
}

export function buildInsert(table: string, row: Row): Sql {
  const cols = Object.keys(row);
  assertKnownColumns(table, cols);
  return {
    sql: `INSERT INTO "${table}" (${cols.map((c) => `"${c}"`).join(', ')}) VALUES (${cols.map(() => '?').join(', ')})`,
    params: cols.map((c) => row[c]),
  };
}

export function buildUpdate(table: string, where: Where, patch: Row): Sql {
  const cols = Object.keys(patch).filter((c) => c !== 'id');
  assertKnownColumns(table, cols);
  const w = buildWhere(table, where);
  return {
    sql: `UPDATE "${table}" SET ${cols.map((c) => `"${c}" = ?`).join(', ')}${w.sql}`,
    params: [...cols.map((c) => patch[c]), ...w.params],
  };
}

export function buildDelete(table: string, where: Where): Sql {
  const w = buildWhere(table, where);
  return { sql: `DELETE FROM "${table}"${w.sql}`, params: w.params };
}

export function buildCount(table: string, where?: Where): Sql {
  const w = buildWhere(table, where);
  return { sql: `SELECT COUNT(*) AS n FROM "${table}"${w.sql}`, params: w.params };
}
