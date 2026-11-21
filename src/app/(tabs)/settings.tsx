import { View } from 'react-native';

import type { AppSettings, ThemePreference } from '@/domain/models';
import { useAppStore, useServices, useSettings } from '@/state/appStore';
import { AppText, Card, Divider, ErrorState, Screen, Segmented, SwitchRow } from '@/ui/components/primitives';
import { errorMessage, useQuery, useToast } from '@/ui/hooks';
import { spacing } from '@/ui/theme';

export default function SettingsScreen() {
  const settings = useSettings();
  const services = useServices();
  const setSettings = useAppStore((s) => s.setSettings);
  const toast = useToast((s) => s.show);
  const categories = useQuery((s) => s.categories.list(), []);
  const info = useQuery(async (s) => ({ kind: s.db.kind, version: await s.db.schemaVersion() }), []);

  async function update<K extends keyof AppSettings>(key: K, value: AppSettings[K]) {
    try {
      setSettings(await services.settings.set(key, value));
    } catch (e) {
      toast(errorMessage(e), 'error');
    }
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
      </Card>

      <AppText variant="label" muted>
        CATEGORIES
      </AppText>
      <Card>
        {categories.error ? <ErrorState message={categories.error} onRetry={categories.reload} /> : null}
        {(categories.data ?? []).map((c, idx) => (
          <View key={c.id}>
            {idx > 0 ? <Divider /> : null}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: 44 }}>
              <View style={{ width: 14, height: 14, borderRadius: 7, backgroundColor: c.color }} />
              <AppText>{c.name}</AppText>
            </View>
          </View>
        ))}
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
