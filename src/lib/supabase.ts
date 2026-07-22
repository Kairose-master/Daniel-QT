import 'react-native-url-polyfill/auto';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import { AppState, Platform } from 'react-native';

import type { Database } from '../types';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

/** .env 가 아직 안 채워졌으면 앱이 크래시하는 대신 안내 화면을 띄웁니다. */
export const isSupabaseConfigured = Boolean(url && anonKey && url.startsWith('http'));

export const kakaoEnabled = process.env.EXPO_PUBLIC_ENABLE_KAKAO === 'true';

export const supabase = createClient<Database>(
  isSupabaseConfigured ? url : 'https://placeholder.supabase.co',
  isSupabaseConfigured ? anonKey : 'placeholder',
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      // 네이티브에는 URL 이 없으므로 세션 감지를 끕니다 (웹에서는 켬).
      detectSessionInUrl: Platform.OS === 'web',
    },
  },
);

// 앱이 포그라운드일 때만 토큰을 갱신합니다.
if (Platform.OS !== 'web') {
  AppState.addEventListener('change', (state) => {
    if (state === 'active') supabase.auth.startAutoRefresh();
    else supabase.auth.stopAutoRefresh();
  });
}
