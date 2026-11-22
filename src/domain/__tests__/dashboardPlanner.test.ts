import {
  currentWeekAnchor,
  mondayWeekRange,
  shiftMonthAnchor,
  shiftWeekAnchor,
  weekStartKey,
} from '@/ui/components/DashboardPlanner';

describe('dashboard planner ranges', () => {
  it('uses Monday–Sunday weeks (Notion weekly planner)', () => {
    // 2026-11-22 is a Sunday → week is Mon 16 – Sun 22
    expect(mondayWeekRange('2026-11-22')).toEqual(['2026-11-16', '2026-11-22']);
    // Monday stays the start
    expect(mondayWeekRange('2026-11-16')).toEqual(['2026-11-16', '2026-11-22']);
    // Wednesday in the middle
    expect(mondayWeekRange('2026-11-18')).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('weekStartKey respects Sunday vs Monday week starts', () => {
    // Sunday 2026-11-22
    expect(weekStartKey('2026-11-22', 1)).toBe('2026-11-16'); // Monday start
    expect(weekStartKey('2026-11-22', 0)).toBe('2026-11-22'); // Sunday start
    // Wednesday 2026-11-18
    expect(weekStartKey('2026-11-18', 1)).toBe('2026-11-16');
    expect(weekStartKey('2026-11-18', 0)).toBe('2026-11-15');
  });

  it('currentWeekAnchor pins Week view to the week containing today', () => {
    expect(currentWeekAnchor('2026-11-22')).toBe('2026-11-16');
    expect(currentWeekAnchor('2026-11-22', 0)).toBe('2026-11-22');
    expect(currentWeekAnchor('2026-11-18', 0)).toBe('2026-11-15');
  });

  it('shifts week and month anchors', () => {
    expect(shiftWeekAnchor('2026-11-18', 1)).toBe('2026-11-25');
    expect(shiftWeekAnchor('2026-11-18', -1)).toBe('2026-11-11');
    expect(shiftMonthAnchor('2026-11-18', 1)).toBe('2026-12-18');
    expect(shiftMonthAnchor('2026-01-31', 1)).toBe('2026-02-28');
  });
});
