import { Stack } from 'expo-router';
import Constants from 'expo-constants';
import { ScrollView } from 'react-native';

import { APP_HEADER_NAME } from '@/domain/branding';
import { AppText, Card } from '@/ui/components/primitives';
import { useQuery, useTheme } from '@/ui/hooks';
import { useSafeAndroidBack } from '@/ui/navigation';
import { spacing } from '@/ui/theme';

export default function AboutScreen() {
  const p = useTheme();
  useSafeAndroidBack();
  const info = useQuery(async (s) => ({ kind: s.db.kind, version: await s.db.schemaVersion() }), []);
  const version = Constants.expoConfig?.version ?? Constants.nativeAppVersion ?? '1.0.0';
  return (
    <>
      <Stack.Screen options={{ title: `About ${APP_HEADER_NAME}` }} />
      <ScrollView style={{ backgroundColor: p.background }} contentContainerStyle={{ padding: spacing.lg, gap: spacing.md }}>
        <AppText variant="display">About</AppText>
        <Card testID="about-card">
          <AppText variant="title">{APP_HEADER_NAME}</AppText>
          <AppText muted testID="about-version">
            Version {version}
          </AppText>
          <AppText>
            An offline-first schedule. Tasks, events, folders, and reminders stay on this device. There is no account and no cloud sync.
          </AppText>
          <AppText testID="about-creator">Created by: Ramil Batoy</AppText>
          <AppText variant="caption" muted>
            Storage: {info.data?.kind === 'sqlite' ? 'SQLite' : 'IndexedDB'} · schema v{info.data?.version ?? '…'}
          </AppText>
        </Card>
      </ScrollView>
    </>
  );
}
