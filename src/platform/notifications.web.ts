import type { NotificationPort, PermissionState } from '../domain/ports';

/** Browsers cannot hold timers beyond the open tab; longer delays are re-armed on next sync. */
const MAX_TIMER_MS = 24 * 60 * 60 * 1000;

function state(): PermissionState {
  if (typeof Notification === 'undefined') return 'unsupported';
  if (Notification.permission === 'granted') return 'granted';
  if (Notification.permission === 'denied') return 'denied';
  return 'undetermined';
}

export function subscribeToNotificationTaps(_cb: (occurrenceId: string) => void): () => void {
  return () => undefined;
}

/**
 * Web testing stand-in: shows browser notifications only while this tab is
 * open. Not equivalent to Android local notifications.
 */
export function createNotificationPort(): NotificationPort {
  const timers = new Map<string, ReturnType<typeof setTimeout>>();
  let seq = 0;
  return {
    platform: 'web',
    permission: async () => state(),
    async requestPermission() {
      if (typeof Notification === 'undefined') return 'unsupported';
      await Notification.requestPermission();
      return state();
    },
    exactAlarmPermission: async () => 'unsupported',
    requestExactAlarmPermission: async () => 'unsupported',
    async schedule(n) {
      if (state() !== 'granted') return null;
      const delay = n.at.getTime() - Date.now();
      if (delay < 0 || delay > MAX_TIMER_MS) return null;
      const id = `web-${++seq}`;
      timers.set(
        id,
        setTimeout(() => {
          timers.delete(id);
          try {
            new Notification(n.title, { body: n.body, tag: id });
          } catch {
            // Some browsers only allow notifications from a service worker.
          }
        }, delay),
      );
      return id;
    },
    async cancel(id) {
      const t = timers.get(id);
      if (t) clearTimeout(t);
      timers.delete(id);
    },
  };
}
