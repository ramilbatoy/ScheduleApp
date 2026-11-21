import type { Condition, OrderBy, Row, SqlValue, Where } from '../types';

function cmp(a: SqlValue, b: SqlValue): number {
  if (a === b) return 0;
  if (a === null) return -1; // SQLite sorts NULL first ascending
  if (b === null) return 1;
  if (typeof a === 'number' && typeof b === 'number') return a - b;
  return String(a) < String(b) ? -1 : 1;
}

function matchCondition(value: SqlValue, cond: Condition): boolean {
  if (cond === null || typeof cond !== 'object') {
    return cond === null ? value === null : value === cond;
  }
  for (const [op, expected] of Object.entries(cond)) {
    if (expected === undefined) continue;
    switch (op) {
      case 'eq':
        if (value !== expected) return false;
        break;
      case 'ne':
        // SQL semantics: NULL != x is unknown (false), except IS NOT NULL.
        if (expected === null ? value === null : value === null || value === expected) return false;
        break;
      case 'lt':
        if (value === null || cmp(value, expected as SqlValue) >= 0) return false;
        break;
      case 'lte':
        if (value === null || cmp(value, expected as SqlValue) > 0) return false;
        break;
      case 'gt':
        if (value === null || cmp(value, expected as SqlValue) <= 0) return false;
        break;
      case 'gte':
        if (value === null || cmp(value, expected as SqlValue) < 0) return false;
        break;
      case 'in':
        if (value === null || !(expected as SqlValue[]).includes(value)) return false;
        break;
      case 'notIn':
        if (value === null || (expected as SqlValue[]).includes(value)) return false;
        break;
      case 'contains':
        if (value === null || !String(value).toLowerCase().includes(String(expected).toLowerCase())) return false;
        break;
      default:
        throw new Error(`Unsupported operator ${op}`);
    }
  }
  return true;
}

export function matchesWhere(row: Row, where: Where | undefined): boolean {
  if (!where) return true;
  for (const [col, cond] of Object.entries(where)) {
    if (!matchCondition(row[col] ?? null, cond)) return false;
  }
  return true;
}

export function sortRows(rows: Row[], orderBy: OrderBy[] | undefined): Row[] {
  if (!orderBy?.length) return rows;
  return [...rows].sort((a, b) => {
    for (const o of orderBy) {
      const c = cmp(a[o.column] ?? null, b[o.column] ?? null);
      if (c !== 0) return o.dir === 'desc' ? -c : c;
    }
    return 0;
  });
}
