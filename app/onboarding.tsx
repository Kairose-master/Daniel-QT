import { useRouter } from 'expo-router';
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogoMark } from '../src/components/LogoMark';
import { Avatar, Button, Field, Sans, Serif } from '../src/components/ui';
import { fetchMembers } from '../src/lib/api';
import { useSession } from '../src/lib/session';
import { kakaoEnabled } from '../src/lib/supabase';
import { colors, radius } from '../src/theme';
import type { MemberWithProfile } from '../src/types';

type Step = 'splash' | 'login' | 'group' | 'done';

export default function Onboarding() {
  const router = useRouter();
  const { session, memberships, activeGroup, signOut } = useSession();
  const [step, setStep] = useState<Step>('splash');

  // 로그인 상태에 따라 단계를 맞춥니다 (앱을 껐다 켜도 이어서).
  useEffect(() => {
    if (!session) return;
    setStep((s) => {
      if (s === 'done') return s;
      return memberships.length > 0 ? 'done' : 'group';
    });
  }, [session, memberships.length]);

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f1e6d2' }}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <View style={{ flex: 1, paddingHorizontal: 30, paddingTop: 24, paddingBottom: 28 }}>
          {step === 'splash' && <SplashStep onNext={() => setStep('login')} />}
          {step === 'login' && <LoginStep />}
          {step === 'group' && <GroupStep onSignOut={signOut} />}
          {step === 'done' && (
            <DoneStep
              groupName={activeGroup?.name ?? ''}
              groupId={activeGroup?.id ?? null}
              onFinish={() => router.replace('/(tabs)')}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ── 1. 스플래시 ───────────────────────────────────────────────

function SplashStep({ onNext }: { onNext: () => void }) {
  return (
    <>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <LogoMark size={78} />
        <Serif style={{ fontSize: 26, color: colors.ink900, marginTop: 22 }}>
          다니엘과 세친구
        </Serif>
        <Sans
          style={{
            fontSize: 14,
            color: '#8a7f6a',
            lineHeight: 26,
            marginTop: 12,
            textAlign: 'center',
          }}
        >
          같은 말씀, 함께 걷는 하루{'\n'}소그룹과 나누는 잔잔한 묵상
        </Sans>
      </View>
      <Button label="시작하기" onPress={onNext} style={{ borderRadius: 15 }} />
    </>
  );
}

// ── 2. 로그인 ─────────────────────────────────────────────────

function LoginStep() {
  const { signInWithEmail, signUpWithEmail, signInWithKakao } = useSession();
  const [mode, setMode] = useState<'choose' | 'email'>('choose');
  const [isSignUp, setIsSignUp] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState<'kakao' | 'email' | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (!email.trim() || password.length < 6) {
      setError('이메일과 6자 이상의 비밀번호를 입력해주세요.');
      return;
    }
    if (isSignUp && !name.trim()) {
      setError('소그룹에서 보일 이름을 알려주세요.');
      return;
    }
    setBusy('email');
    try {
      if (isSignUp) await signUpWithEmail(email, password, name);
      else await signInWithEmail(email, password);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  const kakao = async () => {
    setError(null);
    setBusy('kakao');
    try {
      await signInWithKakao();
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(null);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ alignItems: 'center', paddingTop: 40, paddingBottom: 28 }}>
        <LogoMark size={60} />
        <Serif style={{ fontSize: 20, color: colors.ink900, marginTop: 18 }}>
          간편하게 시작하기
        </Serif>
        <Sans
          style={{
            fontSize: 13,
            color: colors.muted,
            marginTop: 8,
            lineHeight: 22,
            textAlign: 'center',
          }}
        >
          3초면 충분해요.{'\n'}소그룹 지체들과 바로 연결됩니다
        </Sans>
      </View>

      <View style={{ gap: 10 }}>
        {mode === 'email' && (
          <View style={{ gap: 9, marginBottom: 4 }}>
            {isSignUp && (
              <Field
                placeholder="이름 (소그룹에 보일 이름)"
                value={name}
                onChangeText={setName}
                autoCapitalize="none"
              />
            )}
            <Field
              placeholder="이메일"
              value={email}
              onChangeText={setEmail}
              autoCapitalize="none"
              keyboardType="email-address"
              autoComplete="email"
            />
            <Field
              placeholder="비밀번호 (6자 이상)"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoComplete={isSignUp ? 'new-password' : 'current-password'}
            />
            <Button
              label={isSignUp ? '가입하고 시작하기' : '로그인'}
              onPress={submit}
              loading={busy === 'email'}
            />
            <Pressable onPress={() => setIsSignUp((v) => !v)} style={{ paddingVertical: 6 }}>
              <Sans style={{ fontSize: 12, color: colors.clay, textAlign: 'center' }}>
                {isSignUp ? '이미 계정이 있어요 · 로그인' : '처음이신가요? 이메일로 가입하기'}
              </Sans>
            </Pressable>
          </View>
        )}

        {error && (
          <Sans
            style={{ fontSize: 12, color: colors.danger, textAlign: 'center', lineHeight: 20 }}
          >
            {error}
          </Sans>
        )}

        {kakaoEnabled && (
          <Button
            variant="kakao"
            label={busy === 'kakao' ? '카카오로 연결 중…' : '카카오로 시작하기'}
            onPress={kakao}
            loading={busy === 'kakao'}
          />
        )}

        {mode === 'choose' && (
          <Button variant="outline" label="이메일로 시작하기" onPress={() => setMode('email')} />
        )}

        <Sans
          style={{
            textAlign: 'center',
            fontSize: 11,
            color: '#b3a68d',
            marginTop: 6,
            lineHeight: 18,
          }}
        >
          시작하면 이용약관과 개인정보처리방침에{'\n'}동의하는 것으로 간주됩니다
        </Sans>
      </View>
    </ScrollView>
  );
}

// ── 3. 소그룹 참여 / 만들기 ───────────────────────────────────

function GroupStep({ onSignOut }: { onSignOut: () => void }) {
  const { joinGroup, createGroup } = useSession();
  const [mode, setMode] = useState<'join' | 'create'>('join');
  const [code, setCode] = useState('');
  const [groupName, setGroupName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    setBusy(true);
    try {
      if (mode === 'join') await joinGroup(code);
      else await createGroup(groupName);
    } catch (e) {
      setError(messageOf(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <ScrollView
      contentContainerStyle={{ flexGrow: 1, justifyContent: 'center', paddingBottom: 24 }}
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
    >
      <View style={{ paddingVertical: 40 }}>
        {mode === 'join' ? (
          <>
            <Serif style={{ fontSize: 22, color: colors.ink900, lineHeight: 34 }}>
              소그룹 초대코드를{'\n'}입력해주세요
            </Serif>
            <Sans style={{ fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 22 }}>
              리더에게 받은 코드로 소그룹에 참여해요
            </Sans>
            <Field
              placeholder="예: DAN2QT"
              value={code}
              onChangeText={(t) => setCode(t.toUpperCase())}
              autoCapitalize="characters"
              autoCorrect={false}
              maxLength={12}
              style={{
                marginTop: 26,
                paddingVertical: 15,
                fontSize: 18,
                letterSpacing: 3,
                textAlign: 'center',
                borderColor: colors.lineStrong,
                borderRadius: radius.md,
              }}
            />
            <Pressable onPress={() => setMode('create')} style={{ marginTop: 18 }}>
              <Sans style={{ textAlign: 'center', fontSize: 12, color: '#a89c85' }}>
                코드가 없으신가요? <Sans style={{ color: colors.clay }}>새 소그룹 만들기</Sans>
              </Sans>
            </Pressable>
          </>
        ) : (
          <>
            <Serif style={{ fontSize: 22, color: colors.ink900, lineHeight: 34 }}>
              새 소그룹을{'\n'}만들어요
            </Serif>
            <Sans style={{ fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 22 }}>
              만든 사람이 리더가 되고, 초대코드가 발급됩니다
            </Sans>
            <Field
              placeholder="예: 새벽이슬 소그룹"
              value={groupName}
              onChangeText={setGroupName}
              style={{
                marginTop: 26,
                paddingVertical: 15,
                fontSize: 16,
                textAlign: 'center',
                borderColor: colors.lineStrong,
                borderRadius: radius.md,
              }}
            />
            <Pressable onPress={() => setMode('join')} style={{ marginTop: 18 }}>
              <Sans style={{ textAlign: 'center', fontSize: 12, color: '#a89c85' }}>
                초대코드가 있어요 · <Sans style={{ color: colors.clay }}>코드로 참여하기</Sans>
              </Sans>
            </Pressable>
          </>
        )}

        {error && (
          <Sans
            style={{
              fontSize: 12,
              color: colors.danger,
              textAlign: 'center',
              marginTop: 16,
              lineHeight: 20,
            }}
          >
            {error}
          </Sans>
        )}
      </View>

      <View style={{ gap: 10 }}>
        <Button
          label={mode === 'join' ? '참여하기' : '소그룹 만들기'}
          onPress={submit}
          loading={busy}
          disabled={mode === 'join' ? code.trim().length < 4 : groupName.trim().length < 1}
          style={{ borderRadius: 15 }}
        />
        <Pressable onPress={onSignOut} style={{ paddingVertical: 8 }}>
          <Sans style={{ textAlign: 'center', fontSize: 12, color: colors.muted4 }}>
            다른 계정으로 로그인
          </Sans>
        </Pressable>
      </View>
    </ScrollView>
  );
}

// ── 4. 완료 ───────────────────────────────────────────────────

function DoneStep({
  groupName,
  groupId,
  onFinish,
}: {
  groupName: string;
  groupId: string | null;
  onFinish: () => void;
}) {
  const [members, setMembers] = useState<MemberWithProfile[]>([]);

  useEffect(() => {
    if (!groupId) return;
    fetchMembers(groupId)
      .then(setMembers)
      .catch(() => setMembers([]));
  }, [groupId]);

  const shown = members.slice(0, 4);
  const rest = members.length - shown.length;

  return (
    <>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
        <View
          style={{
            width: 58,
            height: 58,
            borderRadius: 29,
            backgroundColor: colors.sage,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <Sans style={{ color: colors.white, fontSize: 24 }}>✓</Sans>
        </View>
        <Serif
          style={{ fontSize: 22, color: colors.ink900, marginTop: 20, textAlign: 'center', lineHeight: 34 }}
        >
          {groupName}에{'\n'}참여했어요
        </Serif>
        <Sans style={{ fontSize: 13, color: colors.muted, marginTop: 12 }}>
          {members.length}명의 지체와 함께 묵상을 나눠요
        </Sans>

        <View style={{ flexDirection: 'row', marginTop: 22, paddingLeft: 8 }}>
          {shown.map((m, i) => (
            <View
              key={m.user_id}
              style={{
                marginLeft: i === 0 ? 0 : -8,
                borderWidth: 2,
                borderColor: '#f1e6d2',
                borderRadius: 20,
              }}
            >
              <Avatar name={m.profile.name} seed={m.user_id} size={36} />
            </View>
          ))}
          {rest > 0 && (
            <View
              style={{
                width: 40,
                height: 40,
                marginLeft: -8,
                borderRadius: 20,
                borderWidth: 2,
                borderColor: '#f1e6d2',
                backgroundColor: '#7d8a94',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Sans style={{ color: colors.white, fontSize: 12 }}>+{rest}</Sans>
            </View>
          )}
        </View>
      </View>
      <Button label="묵상 시작하기" onPress={onFinish} style={{ borderRadius: 15 }} />
    </>
  );
}

function messageOf(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e);
  if (/Invalid login credentials/i.test(raw)) return '이메일 또는 비밀번호가 맞지 않아요.';
  if (/User already registered/i.test(raw)) return '이미 가입된 이메일이에요. 로그인해주세요.';
  if (/Password should be/i.test(raw)) return '비밀번호는 6자 이상이어야 해요.';
  if (/Network request failed/i.test(raw)) return '네트워크 연결을 확인해주세요.';
  return raw;
}
