import { fixedClock } from '../domain/dates';
import type { NotificationPort, PermissionState, ScheduledNotification } from '../domain/ports';
import { AppServices } from '../domain/services/container';
import type { ItemInput } from '../domain/services/taskService';
import type { Database } from '../db/types';

export class FakeNotifications implements NotificationPort {
  readonly platform = 'android' as const;
  state: PermissionState = 'granted';
  scheduled = new Map<string, ScheduledNotification>();
  private seq = 0;
  async permission() {
    return this.state;
  }
  async requestPermission() {
    this.state = 'granted';
    return this.state;
  }
  async exactAlarmPermission(): Promise<PermissionState> {
    return 'granted';
  }
  async requestExactAlarmPermission(): Promise<PermissionState> {
    return 'granted';
  }
  async schedule(n: ScheduledNotification) {
    const id = `n${++this.seq}`;
    this.scheduled.set(id, n);
    return id;
  }
  async cancel(id: string) {
    this.scheduled.delete(id);
  }
}

export async function makeApp(open: () => Promise<Database>, at = '2026-03-10T09:00:00') {
  const clock = fixedClock(at);
  const notifications = new FakeNotifications();
  const app = new AppServices(await open(), clock, notifications);
  await app.bootstrap();
  return { app, clock, notifications };
}

export function item(overrides: Partial<ItemInput> = {}): ItemInput {
  return {
    kind: 'task',
    title: 'Write report',
    notes: '',
    categoryId: null,
    priority: 'medium',
    date: '2026-03-10',
    allDay: false,
    startTime: null,
    endTime: null,
    deadlineAt: null,
    reminderOffsetMinutes: null,
    deadlineReminderOffsetMinutes: null,
    recurrence: null,
    ...overrides,
  };
}
