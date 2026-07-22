import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { Platform } from 'react-native';

import { useSession } from './session';
import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

async function registerForPushAsync(): Promise<string | null> {
  if (!Device.isDevice) return null; // 시뮬레이터에서는 토큰이 발급되지 않습니다.

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: '기본',
      importance: Notifications.AndroidImportance.DEFAULT,
      lightColor: '#a86b4d',
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    status = (await Notifications.requestPermissionsAsync()).status;
  }
  if (status !== 'granted') return null;

  const projectId =
    Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  if (!projectId) return null; // EAS 프로젝트 연결 전에는 건너뜁니다.

  const token = await Notifications.getExpoPushTokenAsync({ projectId });
  return token.data;
}

/** 로그인 상태가 되면 푸시 토큰을 등록합니다. */
export function useNotifications() {
  const { userId } = useSession();

  useEffect(() => {
    if (!userId) return;
    let alive = true;

    registerForPushAsync()
      .then(async (token) => {
        if (!alive || !token) return;
        await supabase
          .from('push_tokens')
          .upsert(
            { user_id: userId, token, platform: Platform.OS, updated_at: new Date().toISOString() },
            { onConflict: 'user_id,token' },
          );
      })
      .catch(() => {
        // 알림은 부가 기능이므로 실패해도 앱 사용을 막지 않습니다.
      });

    return () => {
      alive = false;
    };
  }, [userId]);
}

/**
 * 소그룹 멤버에게 푸시를 보냅니다. (Edge Function `notify` 가 실제 발송)
 * 실패해도 호출한 쪽 동작을 막지 않도록 조용히 삼킵니다.
 */
export async function notifyGroup(input: {
  groupId: string;
  title: string;
  body: string;
  excludeUserId?: string;
  toUserId?: string;
}): Promise<void> {
  try {
    await supabase.functions.invoke('notify', { body: input });
  } catch {
    // no-op
  }
}
