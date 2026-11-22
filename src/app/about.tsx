import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { ScrollView } from 'react-native';

import { AppText, Card } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useSafeAndroidBack } from '@/ui/navigation';
import { spacing } from '@/ui/theme';

export default function AboutScreen() {
  const p = useTheme();
  useSafeAndroidBack();
  const info = useQuery(async (s) => ({ kind: s.db.kind, version: await s.db.schemaVersion() }), []);
  const version = Constants.expoConfig?.version ?? '1.0.0';
  return (
    <>
      <Stack.Screen options={{ title: 'About NeoOrganizer' }} />
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <AppText variant="display">About</AppText>
        <Card>
          <AppText variant="title">NeoOrganizer</AppText>
          <AppText muted>Version {version}</AppText>
          <AppText>
            An offline-first schedule. Tasks, events, folders, and reminders stay on this device. There is no account and no cloud sync.
          </AppText>
          <AppText variant="caption" muted>
            Storage: {info.data?.kind === 'sqlite' ? 'SQLite' : 'IndexedDB'} · schema v{info.data?.version ?? '…'}
          </AppText>
        </Card>
      </ScrollView>
    </>
  );
}
