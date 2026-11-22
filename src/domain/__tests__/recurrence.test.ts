import { describeRule, expandRule, presetFor, type RecurrencePattern } from '../recurrence';

const base: RecurrencePattern = { frequency: 'daily', interval: 1, byWeekday: null, byMonthday: null, startDate: '2026-03-02', endDate: null };

describe('expandRule', () => {
  it('daily, every N days, respects start and inclusive end', () => {
    expect(expandRule(base, '2026-03-01', '2026-03-05')).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05']);
    expect(expandRule({ ...base, interval: 3 }, '2026-03-01', '2026-03-12')).toEqual(['2026-03-02', '2026-03-05', '2026-03-08', '2026-03-11']);
    expect(expandRule({ ...base, endDate: '2026-03-03' }, '2026-03-01', '2026-03-31')).toEqual(['2026-03-02', '2026-03-03']);
  });

  it('weekdays and weekends presets (2026-03-02 is a Monday)', () => {
    const weekdays = { ...base, frequency: 'weekly' as const, byWeekday: [1, 2, 3, 4, 5] };
    expect(expandRule(weekdays, '2026-03-02', '2026-03-09')).toEqual(['2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', '2026-03-06', '2026-03-09']);
    const weekend = { ...base, frequency: 'weekly' as const, byWeekday: [6, 7] };
    expect(expandRule(weekend, '2026-03-02', '2026-03-15')).toEqual(['2026-03-07', '2026-03-08', '2026-03-14', '2026-03-15']);
    expect(presetFor(weekdays)).toBe('weekdays');
    expect(presetFor(weekend)).toBe('weekends');
  });

  it('weekly on selected days every 2 weeks', () => {
    const r = { ...base, frequency: 'weekly' as const, interval: 2, byWeekday: [2, 4] };
    expect(expandRule(r, '2026-03-01', '2026-03-31')).toEqual(['2026-03-03', '2026-03-05', '2026-03-17', '2026-03-19', '2026-03-31']);
  });

  it('weekly defaults to the start weekday', () => {
    expect(expandRule({ ...base, frequency: 'weekly' }, '2026-03-01', '2026-03-20')).toEqual(['2026-03-02', '2026-03-09', '2026-03-16']);
  });

  it('monthly clamps day 31 to short months', () => {
    const r = { ...base, frequency: 'monthly' as const, startDate: '2026-01-31' };
    expect(expandRule(r, '2026-01-01', '2026-05-31')).toEqual(['2026-01-31', '2026-02-28', '2026-03-31', '2026-04-30', '2026-05-31']);
  });

  it('yearly handles Feb 29 and intervals', () => {
    const r = { ...base, frequency: 'yearly' as const, startDate: '2028-02-29' };
    expect(expandRule(r, '2028-01-01', '2033-12-31')).toEqual(['2028-02-29', '2029-02-28', '2030-02-28', '2031-02-28', '2032-02-29', '2033-02-28']);
    expect(expandRule({ ...r, interval: 2 }, '2028-01-01', '2033-12-31')).toEqual(['2028-02-29', '2030-02-28', '2032-02-29']);
  });

  it('is stable across a DST transition (US spring-forward week)', () => {
    expect(expandRule({ ...base, startDate: '2026-03-07' }, '2026-03-07', '2026-03-10')).toEqual(['2026-03-07', '2026-03-08', '2026-03-09', '2026-03-10']);
  });

  it('describes rules for display', () => {
    expect(describeRule(base)).toBe('Daily');
    expect(describeRule({ ...base, frequency: 'weekly', byWeekday: [1, 2, 3, 4, 5] })).toBe('Every weekday');
    expect(describeRule({ ...base, interval: 2, frequency: 'weekly', byWeekday: [2, 4], endDate: '2026-06-01' })).toBe('Every 2 weeks on Tue, Thu, until 2026-06-01');
  });
});
