import { addDays, addMonths, differenceInCalendarDays, format, isValid, parse } from 'date-fns';

import type { DateKey, TimeOfDay } from './models';

/** Injectable time source so services and tests agree on "now". */
export interface Clock {
  now(): Date;
}

export const systemClock: Clock = { now: () => new Date() };

export function fixedClock(iso: string | Date): Clock & { set(d: string | Date): void } {
  let current = new Date(iso);
  return {
    now: () => new Date(current),
    set: (d) => {
      current = new Date(d);
    },
  };
}

export function deviceTimeZone(): string {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';
  } catch {
    return 'UTC';
  }
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function isDateKey(v: unknown): v is DateKey {
  return typeof v === 'string' && DATE_RE.test(v) && isValid(parse(v, 'yyyy-MM-dd', new Date(2000, 0, 1)));
}

export function isTimeOfDay(v: unknown): v is TimeOfDay {
  return typeof v === 'string' && TIME_RE.test(v);
}

/** Local civil date of an instant. */
export function toDateKey(d: Date): DateKey {
  return format(d, 'yyyy-MM-dd');
}

/** Local midnight of a civil date. */
export function fromDateKey(key: DateKey): Date {
  const [y, m, d] = key.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function todayKey(clock: Clock): DateKey {
  return toDateKey(clock.now());
}

export function addDaysKey(key: DateKey, n: number): DateKey {
  return toDateKey(addDays(fromDateKey(key), n));
}

/** Adds calendar months, clamping to the last day of shorter months. */
export function addMonthsKeySafe(key: DateKey, n: number): DateKey {
  return toDateKey(addMonths(fromDateKey(key), n));
}

export function diffDays(later: DateKey, earlier: DateKey): number {
  return differenceInCalendarDays(fromDateKey(later), fromDateKey(earlier));
}

/** Instant for a civil date + wall time in the device zone (DST-correct via the JS engine). */
export function combineDateTime(date: DateKey, time: TimeOfDay | null): Date {
  const [y, m, d] = date.split('-').map(Number);
  if (!time) return new Date(y, m - 1, d);
  const [hh, mm] = time.split(':').map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

export function nowIso(clock: Clock): string {
  return clock.now().toISOString();
}

/** ISO weekday Mon=1 … Sun=7. */
export function isoWeekday(key: DateKey): number {
  const js = fromDateKey(key).getDay();
  return js === 0 ? 7 : js;
}

export function dateRange(start: DateKey, end: DateKey): DateKey[] {
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) out.push(k);
  return out;
}

export function formatTime(time: TimeOfDay | null): string {
  if (!time) return '';
  const [h, m] = time.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${String(m).padStart(2, '0')} ${suffix}`;
}

/** Current local wall clock as `HH:mm` (minutes not snapped). Used to seed empty time pickers. */
export function nowTimeOfDay(clock: Clock = systemClock): TimeOfDay {
  const d = clock.now();
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function formatDateKey(key: DateKey, pattern = 'EEE, MMM d'): string {
  return format(fromDateKey(key), pattern);
}

export function minutesOf(time: TimeOfDay): number {
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}
