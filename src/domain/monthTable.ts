import { fromDateKey, toDateKey } from './dates';
import type { Agenda, DateKey } from './models';
import { displayTitle } from './services/agendaService';

/** Group agenda items (main tasks/events) by occurrence date. */
export function groupAgendaByDate(items: Agenda[]): Record<DateKey, Agenda[]> {
  const out: Record<DateKey, Agenda[]> = {};
  for (const a of items) {
    const d = a.occurrence.date;
    (out[d] ??= []).push(a);
  }
  return out;
}

/**
 * Build a civil DateKey for year + 1-based month, clamping `day` to the month length.
 * Used by "Go to date" / month-year jump controls.
 */
export function anchorForMonthYear(year: number, month: number, day = 1): DateKey {
  if (!Number.isInteger(year) || year < 1 || year > 9999) throw new Error('Invalid year');
  if (!Number.isInteger(month) || month < 1 || month > 12) throw new Error('Invalid month');
  const lastDay = new Date(year, month, 0).getDate();
  const clamped = Math.min(Math.max(1, Math.trunc(day) || 1), lastDay);
  return toDateKey(new Date(year, month - 1, clamped));
}

/** Keep the same day-of-month when jumping, clamped into the target month. */
export function jumpAnchorToMonth(current: DateKey, year: number, month: number): DateKey {
  const day = Number(current.slice(8));
  return anchorForMonthYear(year, month, day);
}

export interface CellTaskPreview {
  shown: Agenda[];
  more: number;
  titles: string[];
}

/** First `limit` main items for a day cell; remainder counted as `more`. */
export function cellTaskPreview(items: Agenda[], limit = 3): CellTaskPreview {
  const safe = Math.max(0, Math.floor(limit));
  const shown = items.slice(0, safe);
  return {
    shown,
    more: Math.max(0, items.length - shown.length),
    titles: shown.map(displayTitle),
  };
}

export function monthPrefix(anchor: DateKey): string {
  return anchor.slice(0, 7);
}

export function isSameMonth(a: DateKey, b: DateKey): boolean {
  return monthPrefix(a) === monthPrefix(b);
}

export function parseYearMonth(anchor: DateKey): { year: number; month: number } {
  const d = fromDateKey(anchor);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}
