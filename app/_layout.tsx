import { DarkTheme as NavDarkTheme, DefaultTheme as NavDefaultTheme, ThemeProvider as NavThemeProvider } from '@react-navigation/native';
import { Stack, useRouter, usePathname } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React from 'react';
import 'react-native-reanimated';

import { useColorScheme } from '@/hooks/use-color-scheme';
import { initDB } from '../database';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { AuthProvider, useAuth } from '../context/AuthContext';
import { checkAndRunBackup } from '../utils/backup';

export const unstable_settings = {
  anchor: '(tabs)',
};

function RootLayoutContent() {
  const { isDarkMode } = useTheme();
  const { user, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  React.useEffect(() => {
    if (isLoading) return;

    const isPublicScreen = pathname === '/' || pathname === '/Login';

    if (user && isPublicScreen) {
      // If logged in, go to tabs
      router.replace('/(tabs)');
    } else if (!user && !isPublicScreen) {
      // If not logged in and trying to access private screens, go to login
      router.replace('/Login');
    }
  }, [user, isLoading, pathname]);

  if (isLoading) {
    return null; // Or a splash screen
  }

  return (
    <NavThemeProvider value={isDarkMode ? NavDarkTheme : NavDefaultTheme}>
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="index" />
        <Stack.Screen name="Login" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="modal" options={{ presentation: 'modal', title: 'Modal', headerShown: true }} />
      </Stack>
      <StatusBar style={isDarkMode ? 'light' : 'dark'} />
    </NavThemeProvider>
  );
}

export default function RootLayout() {
  // Initialize DB immediately
  React.useEffect(() => {
    initDB();
    checkAndRunBackup();
  }, []);

  return (
    <AuthProvider>
      <ThemeProvider>
        <RootLayoutContent />
      </ThemeProvider>
    </AuthProvider>
  );
}
