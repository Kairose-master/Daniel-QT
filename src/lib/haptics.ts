import * as Haptics from 'expo-haptics';

/**
 * 촉각 피드백. 모듈이 없는 빌드(구버전 개발 클라이언트)에서도 앱이 죽지 않도록
 * 전부 try/catch 로 감싸 조용히 무시합니다.
 */
export const haptic = {
  light() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    } catch {}
  },
  medium() {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    } catch {}
  },
  success() {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch {}
  },
  warning() {
    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
    } catch {}
  },
  select() {
    try {
      Haptics.selectionAsync();
    } catch {}
  },
};
