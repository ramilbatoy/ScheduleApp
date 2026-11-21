import { differenceInCalendarMonths, getDaysInMonth, startOfISOWeek } from 'date-fns';

import { addDaysKey, diffDays, fromDateKey, isoWeekday, toDateKey } from './dates';
import type { DateKey, Frequency, RecurringRule } from './models';

export type RecurrencePattern = Pick<RecurringRule, 'frequency' | 'interval' | 'byWeekday' | 'byMonthday' | 'startDate' | 'endDate'>;

/** UI presets that map onto the stored rule fields. */
export type RecurrencePreset = 'daily' | 'weekdays' | 'weekends' | 'weekly' | 'monthly' | 'yearly' | 'custom';

export const WEEKDAYS = [1, 2, 3, 4, 5];
export const WEEKEND = [6, 7];

function weekIndex(date: DateKey, start: DateKey): number {
  return Math.round(diffDays(toDateKey(startOfISOWeek(fromDateKey(date))), toDateKey(startOfISOWeek(fromDateKey(start)))) / 7);
}


/** Whether `date` is an instance of the rule (ignoring the start/end bounds). */
function matches(rule: RecurrencePattern, date: DateKey): boolean {
  const interval = Math.max(1, rule.interval);
  const d = fromDateKey(date);
  const s = fromDateKey(rule.startDate);
  switch (rule.frequency) {
    case 'daily':
      return diffDays(date, rule.startDate) % interval === 0;
    case 'weekly': {
      const days = rule.byWeekday?.length ? rule.byWeekday : [isoWeekday(rule.startDate)];
      return days.includes(isoWeekday(date)) && weekIndex(date, rule.startDate) % interval === 0;
    }
    case 'monthly': {
      const months = differenceInCalendarMonths(d, s);
      if (months % interval !== 0) return false;
      const target = rule.byMonthday ?? s.getDate();
      return d.getDate() === Math.min(target, getDaysInMonth(d));
    }
    case 'yearly': {
      const years = d.getFullYear() - s.getFullYear();
      if (years % interval !== 0 || d.getMonth() !== s.getMonth()) return false;
      return d.getDate() === Math.min(s.getDate(), getDaysInMonth(d));
    }
  }
}

/**
 * Civil dates in [from, to] on which the rule produces an instance.
 * Monthly/yearly dates past the end of a short month clamp to its last day.
 */
export function expandRule(rule: RecurrencePattern, from: DateKey, to: DateKey): DateKey[] {
  const start = from > rule.startDate ? from : rule.startDate;
  const end = rule.endDate && rule.endDate < to ? rule.endDate : to;
  const out: DateKey[] = [];
  for (let k = start; k <= end; k = addDaysKey(k, 1)) {
    if (matches(rule, k)) out.push(k);
  }
  return out;
}

export function presetFor(rule: Pick<RecurringRule, 'frequency' | 'interval' | 'byWeekday'>): RecurrencePreset {
  if (rule.interval > 1) return 'custom';
  if (rule.frequency === 'weekly' && rule.byWeekday) {
    const set = [...rule.byWeekday].sort().join(',');
    if (set === WEEKDAYS.join(',')) return 'weekdays';
    if (set === WEEKEND.join(',')) return 'weekends';
  }
  return rule.frequency;
}

const WEEKDAY_NAMES = ['', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const UNIT: Record<Frequency, [string, string]> = {
  daily: ['day', 'days'],
  weekly: ['week', 'weeks'],
  monthly: ['month', 'months'],
  yearly: ['year', 'years'],
};

export function describeRule(rule: RecurrencePattern): string {
  const preset = presetFor(rule);
  let base: string;
  if (preset === 'weekdays') base = 'Every weekday';
  else if (preset === 'weekends') base = 'Every weekend';
  else {
    const [one, many] = UNIT[rule.frequency];
    base = rule.interval > 1 ? `Every ${rule.interval} ${many}` : `Every ${one}`;
    if (rule.frequency === 'daily' && rule.interval === 1) base = 'Daily';
    if (rule.frequency === 'weekly' && rule.byWeekday?.length) {
      base += ` on ${[...rule.byWeekday].sort().map((d) => WEEKDAY_NAMES[d]).join(', ')}`;
    }
    if (rule.frequency === 'monthly') base += ` on day ${rule.byMonthday ?? fromDateKey(rule.startDate).getDate()}`;
  }
  return rule.endDate ? `${base}, until ${rule.endDate}` : base;
}
