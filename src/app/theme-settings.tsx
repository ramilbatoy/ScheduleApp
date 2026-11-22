import { Stack } from 'expo-router';

import { ThemeSettingsScreen } from '@/ui/screens/ThemeSettings';
import { useSafeAndroidBack } from '@/ui/navigation';

/** Root-stack screen — same registration pattern as `categories`. */
export default function ThemeSettingsRoute() {
  useSafeAndroidBack();
  return (
    <>
      <Stack.Screen options={{ title: 'Theme' }} />
      <ThemeSettingsScreen />
    </>
  );
}
