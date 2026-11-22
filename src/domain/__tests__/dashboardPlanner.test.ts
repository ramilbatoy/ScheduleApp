import { mondayWeekRange, shiftMonthAnchor, shiftWeekAnchor } from '@/ui/components/DashboardPlanner';

describe('dashboard planner ranges', () => {
  it('uses Monday–Sunday weeks (Notion weekly planner)', () => {
    // 2026-11-22 is a Sunday → week is Mon 16 – Sun 22
    expect(mondayWeekRange('2026-11-22')).toEqual(['2026-11-16', '2026-11-22']);
    // Monday stays the start
    expect(mondayWeekRange('2026-11-16')).toEqual(['2026-11-16', '2026-11-22']);
    // Wednesday in the middle
    expect(mondayWeekRange('2026-11-18')).toEqual(['2026-11-16', '2026-11-22']);
  });

  it('shifts week and month anchors', () => {
    expect(shiftWeekAnchor('2026-11-18', 1)).toBe('2026-11-25');
    expect(shiftWeekAnchor('2026-11-18', -1)).toBe('2026-11-11');
    expect(shiftMonthAnchor('2026-11-18', 1)).toBe('2026-12-18');
    expect(shiftMonthAnchor('2026-01-31', 1)).toBe('2026-02-28');
  });
});
