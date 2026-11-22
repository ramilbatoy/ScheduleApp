import { router } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';

import type { AppSettings, ThemePreference } from '@/domain/models';
import type { PermissionState } from '@/domain/ports';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { AppText, Card, Divider, ErrorState, ListRow, Screen, Segmented, SwitchRow } from '@/ui/components/primitives';
import { exportBackupFlow, latestSafetyCopyDate, restoreBackupFlow, undoRestoreFlow, type FlowResult } from '@/ui/backupActions';
import { errorMessage, useAction, useQuery, useToast } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

const PERMISSION_LABEL: Record<PermissionState, string> = {
  granted: 'Allowed',
  denied: 'Blocked — tap to retry',
  undetermined: 'Not asked — tap to allow',
  unsupported: 'Not supported here',
};

export default function SettingsScreen() {
  const settings = useSettings();
  const services = useServices();
  const setSettings = useAppStore((s) => s.setSettings);
  const toast = useToast((s) => s.show);
  const categories = useQuery((s) => s.categories.list(), []);
  const info = useQuery(async (s) => ({ kind: s.db.kind, version: await s.db.schemaVersion() }), []);
  const permission = useQuery((s) => s.reminders.permission(), []);
  const exact = useQuery((s) => s.reminders.exactAlarmPermission(), []);
  const safety = useQuery(() => latestSafetyCopyDate(), []);
  const invalidate = useAppStore((s) => s.invalidate);
  const [busy, setBusy] = useState(false);
  const run = useAction();

  async function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    try {
      setSettings(await services.settings.set(key, value));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
  }

  async function backupAction(flow: (s: typeof services) => Promise<FlowResult>) {
    if (busy) return;
    setBusy(true);
    try {
      const r = await flow(services);
      if (r) {
        setSettings(await services.settings.get());
        invalidate();
        toast(r.message, r.ok ? 'success' : 'error');
      }
    } catch (e) {
      toast(errorMessage(e), 'error');
    } finally {
      setBusy(false);
      safety.reload();
    }
  }

  async function requestPermission() {
    const state = await run((s) => s.reminders.requestPermission());
    if (state === 'denied') toast('Notifications are blocked. Enable them in system settings.', 'error');
    permission.reload();
  }

  return (
    <Screen title="Settings">
      <AppText variant="label" muted>
        APPEARANCE
      </AppText>
      <Card>
        <AppText>Theme</AppText>
        <Segmented<ThemePreference>
          testID="theme-segmented"
          value={settings.theme}
          onChange={(v) => update('theme', v)}
          options={[
            { value: 'system', label: 'System' },
            { value: 'light', label: 'Light' },
            { value: 'dark', label: 'Dark' },
          ]}
        />
      </Card>

      <AppText variant="label" muted>
        TASKS
      </AppText>
      <Card>
        <SwitchRow
          testID="toggle-carry-forward"
          label="Automatic carry-forward"
          description="Unfinished tasks move to the next day until completed or deleted. Events never carry over."
          value={settings.autoCarryForward}
          onChange={(v) => update('autoCarryForward', v)}
        />
        <Divider />
        <ListRow
          testID="carry-now"
          icon="return-down-forward"
          label="Carry overdue tasks to today now"
          onPress={() => run((s) => s.carryForward.run().then((r) => r.moved), undefined).then((n) => n !== undefined && toast(n ? `Moved ${n} task${n === 1 ? '' : 's'} to today` : 'Nothing to carry forward', 'success'))}
        />
      </Card>

      <AppText variant="label" muted>
        REMINDERS
      </AppText>
      <Card>
        <SwitchRow
          testID="toggle-notifications"
          label="Reminder notifications"
          description="Local notifications on this device. No internet needed."
          value={settings.notificationsEnabled}
          onChange={async (v) => {
            await update('notificationsEnabled', v);
            if (v && permission.data !== 'granted') await requestPermission();
            run((s) => s.reminders.syncAll());
          }}
        />
        <Divider />
        <ListRow
          icon="shield-checkmark-outline"
          label="Permission"
          value={PERMISSION_LABEL[permission.data ?? 'undetermined']}
          onPress={permission.data !== 'granted' && permission.data !== 'unsupported' ? requestPermission : undefined}
        />
        {exact.data && exact.data !== 'unsupported' ? (
          <>
            <Divider />
            <ListRow
              icon="alarm-outline"
              label="Precise timing (exact alarms)"
              value={exact.data === 'granted' ? 'Allowed' : 'Approximate'}
              onPress={exact.data !== 'granted' ? () => run((s) => s.reminders.requestExactAlarmPermission()).then(() => exact.reload()) : undefined}
            />
          </>
        ) : null}
        <AppText variant="caption" muted>
          {services.reminders.platform === 'web'
            ? 'In the browser, reminders only fire while this tab stays open. Install the Android app for real notifications.'
            : 'Android may delay reminders by a few minutes to save battery unless precise timing is allowed.'}
        </AppText>
      </Card>

      <AppText variant="label" muted>
        CATEGORIES
      </AppText>
      <Card>
        {categories.error ? <ErrorState message={categories.error} onRetry={categories.reload} /> : null}
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          {(categories.data ?? []).map((c) => (
            <View key={c.id} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.xs }}>
              <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: c.color }} />
              <AppText variant="caption" muted>
                {c.name}
              </AppText>
            </View>
          ))}
        </View>
        <Divider />
        <ListRow testID="manage-categories" icon="pricetags-outline" label="Manage categories" onPress={() => router.push('/categories')} />
      </Card>

      <AppText variant="label" muted>
        BACKUP & RESTORE
      </AppText>
      <Card>
        <AppText variant="caption" muted testID="last-backup">
          {settings.lastBackupAt ? `Last backup: ${new Date(settings.lastBackupAt).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })}` : 'No backup yet. Export one to keep a copy outside the app.'}
        </AppText>
        <ListRow testID="backup-export" icon="download-outline" label="Export backup" onPress={() => backupAction(exportBackupFlow)} />
        <Divider />
        <ListRow testID="backup-restore" icon="cloud-upload-outline" label="Restore from file" onPress={() => backupAction(restoreBackupFlow)} />
        {safety.data !== undefined && safety.data !== null ? (
          <>
            <Divider />
            <ListRow
              testID="backup-undo"
              icon="arrow-undo-outline"
              label="Undo last restore"
              value={safety.data ? new Date(safety.data).toLocaleDateString() : undefined}
              onPress={() => backupAction(undoRestoreFlow)}
            />
          </>
        ) : null}
        <AppText variant="caption" muted>
          Backups are plain JSON files that stay on your device. Restoring replaces all current data after you confirm.
        </AppText>
      </Card>

      <AppText variant="label" muted>
        ABOUT
      </AppText>
      <Card>
        <AppText muted>
          Storage: {info.data?.kind === 'sqlite' ? 'SQLite (on device)' : 'IndexedDB (browser)'} · schema v
          {info.data?.version ?? '…'}
        </AppText>
        <AppText variant="caption" muted>
          All data stays on this device. No account, no cloud.
        </AppText>
      </Card>
    </Screen>
  );
}
