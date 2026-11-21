import { addDaysKey, addMonthsKeySafe, isDateKey, isoWeekday } from './dates';
import type { DateKey, Priority, TimeOfDay } from './models';

export interface QuickParse {
  title: string;
  date: DateKey | null;
  time: TimeOfDay | null;
  priority: Priority | null;
  categoryName: string | null;
  /** Fragments recognized and removed from the title, for UI chips. */
  matched: string[];
}

const WEEKDAY: Record<string, number> = {
  mon: 1, monday: 1, tue: 2, tues: 2, tuesday: 2, wed: 3, wednesday: 3, thu: 4, thur: 4, thurs: 4, thursday: 4,
  fri: 5, friday: 5, sat: 6, saturday: 6, sun: 7, sunday: 7,
};
const MONTH: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4, may: 5, jun: 6, june: 6, jul: 7, july: 7,
  aug: 8, august: 8, sep: 9, sept: 9, september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};
const PRIORITY_WORDS: Record<string, Priority> = { low: 'low', medium: 'medium', med: 'medium', high: 'high', urgent: 'urgent' };

function pad(n: number) {
  return String(n).padStart(2, '0');
}

/** Next date (strictly after today unless `allowToday`) matching an ISO weekday. */
function nextWeekday(today: DateKey, target: number, allowToday: boolean): DateKey {
  for (let i = allowToday ? 0 : 1; i <= 7; i++) {
    const d = addDaysKey(today, i);
    if (isoWeekday(d) === target) return d;
  }
  return today;
}

/** A month/day in the future (this year, or next year if already past). */
function upcomingMonthDay(today: DateKey, month: number, day: number): DateKey | null {
  const year = Number(today.slice(0, 4));
  for (const y of [year, year + 1]) {
    const key = `${y}-${pad(month)}-${pad(day)}`;
    if (isDateKey(key) && key >= today) return key;
  }
  return null;
}

/**
 * Lightweight English quick-add parser. Recognizes dates (today, tomorrow,
 * weekdays, "next fri", "in 3 days", "mar 15", "3/15", ISO), times ("3pm",
 * "at 9:30", "15:00"), priority ("!high", "!!!") and a category ("#work").
 * Everything unrecognized stays in the title.
 */
export function parseQuickAdd(input: string, today: DateKey): QuickParse {
  let text = ` ${input.trim()} `;
  const matched: string[] = [];
  let date: DateKey | null = null;
  let time: TimeOfDay | null = null;
  let priority: Priority | null = null;
  let categoryName: string | null = null;

  const take = (re: RegExp, fn: (m: RegExpMatchArray) => boolean) => {
    const m = text.match(re);
    if (m && fn(m)) {
      matched.push(m[0].trim());
      text = text.replace(m[0], ' ');
    }
  };

  take(/\s#([\p{L}\p{N}_-]+)(?=\s)/iu, (m) => ((categoryName = m[1]), true));
  take(/\s!(low|medium|med|high|urgent)(?=\s)/i, (m) => ((priority = PRIORITY_WORDS[m[1].toLowerCase()]), true));
  take(/\s(!{1,3})(?=\s)/, (m) => ((priority = m[1].length >= 3 ? 'urgent' : m[1].length === 2 ? 'high' : 'medium'), true));

  take(/\s(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)(?=\s)/i, (m) => {
    let h = Number(m[1]);
    const min = Number(m[2] ?? 0);
    if (h < 1 || h > 12 || min > 59) return false;
    if (m[3].toLowerCase() === 'pm' && h !== 12) h += 12;
    if (m[3].toLowerCase() === 'am' && h === 12) h = 0;
    time = `${pad(h)}:${pad(min)}`;
    return true;
  });
  if (!time) {
    take(/\s(?:at\s+)?([01]?\d|2[0-3]):([0-5]\d)(?=\s)/i, (m) => ((time = `${pad(Number(m[1]))}:${m[2]}`), true));
  }
  if (!time) {
    take(/\sat\s+(\d{1,2})(?=\s)/i, (m) => {
      const h = Number(m[1]);
      if (h > 23) return false;
      time = `${pad(h)}:00`;
      return true;
    });
  }
  if (!time) {
    take(/\s(noon|midnight)(?=\s)/i, (m) => ((time = m[1].toLowerCase() === 'noon' ? '12:00' : '00:00'), true));
  }

  take(/\s(\d{4}-\d{2}-\d{2})(?=\s)/, (m) => (isDateKey(m[1]) ? ((date = m[1]), true) : false));
  if (!date) take(/\s(today|tonight|tod)(?=\s)/i, () => ((date = today), true));
  if (!date) take(/\s(tomorrow|tmrw|tmr|tom)(?=\s)/i, () => ((date = addDaysKey(today, 1)), true));
  if (!date) {
    take(/\sin\s+(\d{1,3})\s+(day|days|week|weeks|month|months)(?=\s)/i, (m) => {
      const n = Number(m[1]);
      const unit = m[2].toLowerCase();
      date = unit.startsWith('day') ? addDaysKey(today, n) : unit.startsWith('week') ? addDaysKey(today, n * 7) : addMonthsKeySafe(today, n);
      return true;
    });
  }
  if (!date) {
    take(/\s(?:on\s+)?(next\s+)?(mon|monday|tue|tues|tuesday|wed|wednesday|thu|thur|thurs|thursday|fri|friday|sat|saturday|sun|sunday)(?=\s)/i, (m) => {
      const base = nextWeekday(today, WEEKDAY[m[2].toLowerCase()], false);
      const weekStart = (k: DateKey) => addDaysKey(k, 1 - isoWeekday(k));
      // "next fri" means the Friday of next week, even when this week's Friday is still ahead.
      date = m[1] && weekStart(base) === weekStart(today) ? addDaysKey(base, 7) : base;
      return true;
    });
  }
  if (!date) {
    take(/\s(?:on\s+)?([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?(?=\s)/i, (m) => {
      const mo = MONTH[m[1].toLowerCase()];
      if (!mo) return false;
      const d = upcomingMonthDay(today, mo, Number(m[2]));
      return d ? ((date = d), true) : false;
    });
  }
  if (!date) {
    take(/\s(?:on\s+)?(\d{1,2})(?:st|nd|rd|th)?\s+([a-z]{3,9})(?=\s)/i, (m) => {
      const mo = MONTH[m[2].toLowerCase()];
      if (!mo) return false;
      const d = upcomingMonthDay(today, mo, Number(m[1]));
      return d ? ((date = d), true) : false;
    });
  }
  if (!date) {
    take(/\s(?:on\s+)?(\d{1,2})\/(\d{1,2})(?=\s)/, (m) => {
      const d = upcomingMonthDay(today, Number(m[1]), Number(m[2]));
      return d ? ((date = d), true) : false;
    });
  }

  const title = text.replace(/\s+/g, ' ').trim().replace(/\s+(on|at|by)$/i, '');
  return { title, date, time, priority, categoryName, matched };
}
