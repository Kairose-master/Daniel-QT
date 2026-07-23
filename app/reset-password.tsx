import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { KeyboardAvoidingView, Platform, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Button, Field, Sans, Serif, TagLabel } from '../src/components/ui';
import { haptic } from '../src/lib/haptics';
import { supabase } from '../src/lib/supabase';
import { colors } from '../src/theme';

/**
 * 비밀번호 재설정 메일의 링크를 타고 들어오면 (auth 이벤트 PASSWORD_RECOVERY)
 * 세션이 임시로 열립니다. 여기서 새 비밀번호를 정합니다.
 */
export default function ResetPassword() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    if (password.length < 6) {
      setError('비밀번호는 6자 이상이어야 해요.');
      return;
    }
    if (password !== confirm) {
      setError('두 비밀번호가 달라요.');
      return;
    }
    setBusy(true);
    try {
      const { error: e } = await supabase.auth.updateUser({ password });
      if (e) throw e;
      haptic.success();
      router.replace('/');
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#f1e6d2' }}>
      <KeyboardAvoidingView
        style={{ flex: 1, padding: 30, justifyContent: 'center' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Serif style={{ fontSize: 22, color: colors.ink900, lineHeight: 32 }}>
          새 비밀번호를{'\n'}정해주세요
        </Serif>
        <Sans style={{ fontSize: 13, color: colors.muted, marginTop: 10, lineHeight: 22 }}>
          앞으로 이 비밀번호로 로그인해요
        </Sans>

        <View style={{ marginTop: 26, marginBottom: 6 }}>
          <TagLabel>새 비밀번호</TagLabel>
        </View>
        <Field value={password} onChangeText={setPassword} secureTextEntry placeholder="6자 이상" />

        <View style={{ marginTop: 14, marginBottom: 6 }}>
          <TagLabel>다시 입력</TagLabel>
        </View>
        <Field value={confirm} onChangeText={setConfirm} secureTextEntry placeholder="한 번 더" />

        {error && (
          <Sans style={{ fontSize: 12, color: colors.danger, marginTop: 14, textAlign: 'center' }}>
            {error}
          </Sans>
        )}

        <Button
          label="비밀번호 바꾸기"
          onPress={submit}
          loading={busy}
          style={{ marginTop: 24, borderRadius: 15 }}
        />
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
