export type PermissionState = 'granted' | 'denied' | 'undetermined' | 'unsupported';

export interface ScheduledNotification {
  at: Date;
  title: string;
  body: string;
  data: Record<string, string>;
}

/** Platform notification capability. Android: expo-notifications. Web: best-effort. Tests: fake. */
export interface NotificationPort {
  readonly platform: 'android' | 'ios' | 'web' | 'none';
  permission(): Promise<PermissionState>;
  requestPermission(): Promise<PermissionState>;
  /** Android 12+: whether alarms fire at the exact minute rather than within an OS-chosen window. */
  exactAlarmPermission(): Promise<PermissionState>;
  requestExactAlarmPermission(): Promise<PermissionState>;
  /** Returns the OS notification id, or null if it could not be scheduled. */
  schedule(n: ScheduledNotification): Promise<string | null>;
  cancel(notificationId: string): Promise<void>;
}

export const noopNotifications: NotificationPort = {
  platform: 'none',
  permission: async () => 'unsupported',
  requestPermission: async () => 'unsupported',
  exactAlarmPermission: async () => 'unsupported',
  requestExactAlarmPermission: async () => 'unsupported',
  schedule: async () => null,
  cancel: async () => undefined,
};
