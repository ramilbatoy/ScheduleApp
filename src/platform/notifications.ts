import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

import type { NotificationPort, PermissionState } from '../domain/ports';

const CHANNEL_ID = 'reminders';

function toState(p: { granted: boolean; canAskAgain?: boolean; status?: string }): PermissionState {
  if (p.granted) return 'granted';
  if (p.status === 'undetermined' || p.canAskAgain) return 'undetermined';
  return 'denied';
}

let channelReady: Promise<void> | null = null;

function ensureChannel(): Promise<void> {
  if (Platform.OS !== 'android') return Promise.resolve();
  channelReady ??= Notifications.setNotificationChannelAsync(CHANNEL_ID, {
    name: 'Reminders',
    description: 'Task, event and deadline reminders',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#4F46E5',
  }).then(() => undefined);
  return channelReady;
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/** Calls `cb` with the occurrence id when the user taps one of our notifications (including cold start). */
export function subscribeToNotificationTaps(cb: (occurrenceId: string) => void): () => void {
  const handle = (r: Notifications.NotificationResponse | null) => {
    const id = r?.notification.request.content.data?.occurrenceId;
    if (typeof id === 'string' && id) cb(id);
  };
  Notifications.getLastNotificationResponseAsync().then(handle).catch(() => undefined);
  const sub = Notifications.addNotificationResponseReceivedListener(handle);
  return () => sub.remove();
}

/** Android local notifications via AlarmManager; delivery timing depends on exact-alarm permission. */
export function createNotificationPort(): NotificationPort {
  return {
    platform: Platform.OS === 'ios' ? 'ios' : 'android',
    async permission() {
      return toState(await Notifications.getPermissionsAsync());
    },
    async requestPermission() {
      await ensureChannel();
      return toState(await Notifications.requestPermissionsAsync());
    },
    async exactAlarmPermission() {
      if (Platform.OS !== 'android') return 'unsupported';
      try {
        return toState(await Notifications.getExactAlarmPermissionsAsync());
      } catch {
        return 'unsupported';
      }
    },
    async requestExactAlarmPermission() {
      if (Platform.OS !== 'android') return 'unsupported';
      try {
        return toState(await Notifications.requestExactAlarmPermissionsAsync());
      } catch {
        return 'unsupported';
      }
    },
    async schedule(n) {
      await ensureChannel();
      let delivery: Notifications.NotificationDelivery = 'bestEffort';
      if (Platform.OS === 'android') {
        try {
          const exact = await Notifications.getExactAlarmPermissionsAsync();
          if (exact.granted) delivery = 'alarmClock';
        } catch {
          delivery = 'bestEffort';
        }
      }
      return Notifications.scheduleNotificationAsync({
        content: { title: n.title, body: n.body, data: n.data, sound: true },
        trigger: {
          type: Notifications.SchedulableTriggerInputTypes.DATE,
          date: n.at,
          channelId: CHANNEL_ID,
          delivery,
        },
      });
    },
    async cancel(id) {
      await Notifications.cancelScheduledNotificationAsync(id);
    },
  };
}
