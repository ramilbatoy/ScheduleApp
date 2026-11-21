import { parseQuickAdd } from '../quickParse';

// 2026-03-10 is a Tuesday.
const today = '2026-03-10';
const p = (s: string) => parseQuickAdd(s, today);

describe('parseQuickAdd', () => {
  it('leaves plain titles untouched', () => {
    expect(p('Buy milk')).toMatchObject({ title: 'Buy milk', date: null, time: null, priority: null, categoryName: null });
  });

  it('parses relative days and times', () => {
    expect(p('Call mom tomorrow at 3pm')).toMatchObject({ title: 'Call mom', date: '2026-03-11', time: '15:00' });
    expect(p('Standup today 9:30')).toMatchObject({ title: 'Standup', date: today, time: '09:30' });
    expect(p('Pay bills in 3 days')).toMatchObject({ title: 'Pay bills', date: '2026-03-13' });
    expect(p('Review in 2 weeks')).toMatchObject({ date: '2026-03-24' });
    expect(p('Lunch noon')).toMatchObject({ title: 'Lunch', time: '12:00' });
    expect(p('Wake 12am')).toMatchObject({ time: '00:00' });
  });

  it('parses weekdays and "next" weekdays', () => {
    expect(p('Gym fri')).toMatchObject({ title: 'Gym', date: '2026-03-13' });
    expect(p('Gym next fri')).toMatchObject({ date: '2026-03-20' });
    expect(p('Report monday')).toMatchObject({ date: '2026-03-16' });
    expect(p('Report next monday')).toMatchObject({ date: '2026-03-16' });
    expect(p('Sync tue')).toMatchObject({ date: '2026-03-17' });
  });

  it('parses month-day forms, rolling into next year when past', () => {
    expect(p('Dentist mar 15')).toMatchObject({ title: 'Dentist', date: '2026-03-15' });
    expect(p('Party 2 jan')).toMatchObject({ title: 'Party', date: '2027-01-02' });
    expect(p('Taxes 4/15')).toMatchObject({ title: 'Taxes', date: '2026-04-15' });
    expect(p('Trip 2026-07-01')).toMatchObject({ title: 'Trip', date: '2026-07-01' });
    expect(p('Mayday may 40')).toMatchObject({ date: null });
  });

  it('parses priority and category tags', () => {
    expect(p('Fix leak !urgent #home')).toMatchObject({ title: 'Fix leak', priority: 'urgent', categoryName: 'home' });
    expect(p('Fix leak !!')).toMatchObject({ title: 'Fix leak', priority: 'high' });
  });

  it('does not eat numbers that are part of the title', () => {
    expect(p('Read 3 chapters')).toMatchObject({ title: 'Read 3 chapters', date: null, time: null });
  });
});
