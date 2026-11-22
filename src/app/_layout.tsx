import { DarkTheme, DefaultTheme, Stack, ThemeProvider as NavThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ThemeProvider } from '@/theme';
import { AppProvider } from '@/ui/AppProvider';
import { DialogHost, ToastHost } from '@/ui/components/dialogs';
import { NavDrawer } from '@/ui/components/NavDrawer';
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
  const navTheme = useMemo(() => {
    const base = p.scheme === 'dark' ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: { ...base.colors, primary: p.primary, background: p.background, card: p.surface, text: p.text, border: p.border },
    };
  }, [p.scheme, p.primary, p.background, p.surface, p.text, p.border]);
  return (
    <NavThemeProvider value={navTheme}>
      <StatusBar style={p.scheme === 'dark' ? 'light' : 'dark'} />
      {/*
        Stack.Screen order must match Expo Router's sortRoutesWithInitial order
        so mount does not dispatch an unhandled ROUTE_NAMES_CHANGED:
        (tabs) → shorter static routes → longer static → dynamic last.
      */}
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: p.surface },
          headerTintColor: p.text,
          contentStyle: { backgroundColor: p.background },
          headerLeft: () => <HeaderBack />,
        }}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false, headerLeft: () => null }} />
        <Stack.Screen name="about" options={{ title: 'About' }} />
        <Stack.Screen name="projects" options={{ title: 'Projects' }} />
        <Stack.Screen name="item/edit" options={{ title: 'Edit', presentation: 'modal' }} />
        <Stack.Screen
          name="quick-add"
          options={{ headerShown: false, presentation: 'transparentModal', animation: 'fade', contentStyle: { backgroundColor: 'transparent' } }}
        />
        <Stack.Screen name="categories" options={{ title: 'Categories' }} />
        <Stack.Screen name="theme-settings" options={{ title: 'Theme' }} />
        <Stack.Screen name="folder/[id]" options={{ title: 'Folder' }} />
        <Stack.Screen name="item/[id]" options={{ title: 'Details' }} />
      </Stack>
      <NavDrawer />
      <DialogHost />
      <ToastHost />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  useEffect(() => {
    SplashScreen.hideAsync().catch(() => undefined);
  }, []);
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <AppProvider>
          <Navigation />
        </AppProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
