import { DarkTheme, DefaultTheme, Stack, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { AppProvider } from '@/ui/AppProvider';
import { DialogHost, ToastHost } from '@/ui/components/dialogs';
import { IconButton } from '@/ui/components/primitives';
import { useTheme } from '@/ui/hooks';
import { goBackOrDashboard } from '@/ui/navigation';

SplashScreen.preventAutoHideAsync().catch(() => undefined);

function HeaderBack() {
  const p = useTheme();
  return <IconButton icon="chevron-back" label="Back" color={p.text} onPress={goBackOrDashboard} testID="header-back" />;
}

function Navigation() {
  const p = useTheme();
  const base = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
  const navTheme = {
    ...base,
    colors: { ...base.colors, primary: p.primary, background: p.background, card: p.surface, text: p.text, border: p.border },
  };
  return (
    <ThemeProvider value={navTheme}>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.surface },
          headerTintColor: p.text,
          contentStyle: { backgroundColor: p.background },
          headerLeft: () => <HeaderBack />,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerLeft: () => null }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Details' }} />
        <Stack.Screen name="item/edit" options={{ title: 'Edit', presentation: 'modal' }} />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen
          name="quick-add"
          options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
      </Stack>
      <DialogHost />
      <ToastHost />
    </ThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <AppProvider>
        <Navigation />
      </AppProvider>
    </SafeAreaProvider>
  );
}
