import {
  GowunBatang_400Regular,
  GowunBatang_700Bold,
} from '@expo-google-fonts/gowun-batang';
import { GowunDodum_400Regular } from '@expo-google-fonts/gowun-dodum';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary as ScreenErrorBoundary } from '../src/components/ErrorBoundary';
import { Sans, Serif } from '../src/components/ui';
import { useNotifications } from '../src/lib/notifications';
import { SessionProvider } from '../src/lib/session';
import { isSupabaseConfigured } from '../src/lib/supabase';
import { colors } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    GowunBatang_400Regular,
    GowunBatang_700Bold,
    GowunDodum_400Regular,
  });

  useEffect(() => {
    if (fontsLoaded || fontError) SplashScreen.hideAsync().catch(() => {});
  }, [fontsLoaded, fontError]);

  if (!fontsLoaded && !fontError) return null;

  if (!isSupabaseConfigured) return <SetupNotice />;

  return (
    <SafeAreaProvider>
      <SessionProvider>
        <NotificationBridge />
        <StatusBar style="dark" />
        <ScreenErrorBoundary>
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: colors.paper },
              animation: 'fade',
            }}
          />
        </ScreenErrorBoundary>
      </SessionProvider>
    </SafeAreaProvider>
  );
}

function NotificationBridge() {
  useNotifications();
  return null;
}

/** .env 를 아직 안 채웠을 때 크래시 대신 보여주는 안내. */
function SetupNotice() {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: colors.paper,
        alignItems: 'center',
        justifyContent: 'center',
        padding: 32,
        gap: 14,
      }}
    >
      <Serif style={{ fontSize: 20 }}>연결 설정이 필요해요</Serif>
      <Sans style={{ fontSize: 13, lineHeight: 22, textAlign: 'center', color: colors.muted }}>
        프로젝트 루트의 <Sans style={{ color: colors.clay }}>.env</Sans> 파일에{'\n'}
        EXPO_PUBLIC_SUPABASE_URL 과{'\n'}
        EXPO_PUBLIC_SUPABASE_ANON_KEY 를 넣고{'\n'}
        앱을 다시 실행해주세요.
      </Sans>
      <Sans style={{ fontSize: 12, color: colors.muted5, textAlign: 'center' }}>
        자세한 순서는 README.md 를 참고하세요.
      </Sans>
    </View>
  );
}
