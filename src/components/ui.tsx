import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  TextProps,
  View,
  ViewProps,
} from 'react-native';

import { avatarColor, colors, fonts, initialOf, radius } from '../theme';

// ── 텍스트 ────────────────────────────────────────────────────

export function Serif({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ fontFamily: fonts.serif, color: colors.ink800 }, style]} />;
}

export function Sans({ style, ...rest }: TextProps) {
  return <Text {...rest} style={[{ fontFamily: fonts.sans, color: colors.ink600 }, style]} />;
}

/** 대문자 트래킹 라벨 (느낀점 / 기도제목 …) */
export function TagLabel({ children }: { children: React.ReactNode }) {
  return (
    <Sans style={{ fontSize: 11, letterSpacing: 2, color: colors.label }}>{children}</Sans>
  );
}

export function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Serif style={{ fontSize: 16, color: colors.ink700 }}>{children}</Serif>;
}

// ── 아바타 ────────────────────────────────────────────────────

export function Avatar({
  name,
  seed,
  size = 34,
  dim = false,
}: {
  name: string;
  seed: string;
  size?: number;
  dim?: boolean;
}) {
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: avatarColor(seed),
        alignItems: 'center',
        justifyContent: 'center',
        opacity: dim ? 0.5 : 1,
      }}
    >
      <Sans style={{ color: colors.white, fontSize: Math.round(size * 0.42) }}>
        {initialOf(name)}
      </Sans>
    </View>
  );
}

// ── 컨테이너 ──────────────────────────────────────────────────

export function Card({ style, ...rest }: ViewProps) {
  return (
    <View
      {...rest}
      style={[
        {
          backgroundColor: colors.card,
          borderWidth: 1,
          borderColor: colors.lineWarm,
          borderRadius: radius.lg,
          padding: 16,
        },
        style,
      ]}
    />
  );
}

// ── 버튼 ──────────────────────────────────────────────────────

type ButtonProps = {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'dashed' | 'kakao';
  style?: ViewProps['style'];
};

export function Button({
  label,
  onPress,
  loading = false,
  disabled = false,
  variant = 'primary',
  style,
}: ButtonProps) {
  const off = disabled || loading;
  const palette = {
    primary: { bg: colors.clay, fg: colors.white, border: colors.clay, dashed: false },
    outline: { bg: 'transparent', fg: colors.ink500, border: colors.lineStrong, dashed: false },
    dashed: { bg: '#fbf4e8', fg: '#9a7647', border: colors.lineDash, dashed: true },
    kakao: { bg: colors.kakao, fg: colors.kakaoInk, border: colors.kakao, dashed: false },
  }[variant];

  return (
    <Pressable
      onPress={onPress}
      disabled={off}
      style={({ pressed }) => [
        {
          paddingVertical: 15,
          paddingHorizontal: 16,
          borderRadius: radius.md,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: palette.bg,
          borderWidth: variant === 'primary' || variant === 'kakao' ? 0 : 1.5,
          borderColor: palette.border,
          borderStyle: palette.dashed ? 'dashed' : 'solid',
          opacity: off ? 0.6 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.fg} />
      ) : (
        <Sans style={{ color: palette.fg, fontSize: 15 }}>{label}</Sans>
      )}
    </Pressable>
  );
}

// ── 입력 ──────────────────────────────────────────────────────

export function Field({ style, serif, ...rest }: TextInputProps & { serif?: boolean }) {
  return (
    <TextInput
      placeholderTextColor={colors.muted5}
      {...rest}
      style={[
        {
          borderWidth: 1,
          borderColor: colors.lineField,
          backgroundColor: colors.card,
          borderRadius: radius.sm,
          paddingHorizontal: 12,
          paddingVertical: 11,
          fontSize: 14,
          color: colors.ink700,
          fontFamily: serif ? fonts.serif : fonts.sans,
        },
        style,
      ]}
    />
  );
}

// ── 안내 / 상태 ───────────────────────────────────────────────

export function Empty({ title, hint }: { title: string; hint?: string }) {
  return (
    <View style={{ paddingVertical: 40, alignItems: 'center', gap: 8 }}>
      <Sans style={{ fontSize: 13, color: colors.muted3, textAlign: 'center', lineHeight: 22 }}>
        {title}
      </Sans>
      {hint ? (
        <Sans style={{ fontSize: 12, color: colors.muted5, textAlign: 'center' }}>{hint}</Sans>
      ) : null}
    </View>
  );
}

export function Loading() {
  return (
    <View style={{ paddingVertical: 48, alignItems: 'center' }}>
      <ActivityIndicator color={colors.clay} />
    </View>
  );
}

export const sheet = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  pad: { padding: 20 },
  rowCenter: { flexDirection: 'row', alignItems: 'center' },
});
