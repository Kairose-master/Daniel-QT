import * as Clipboard from 'expo-clipboard';
import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import { Alert, Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Button, Field, Sans, Serif, TagLabel } from '../src/components/ui';
import { deleteAccount, leaveGroup } from '../src/lib/api';
import { haptic } from '../src/lib/haptics';
import { useSession } from '../src/lib/session';
import { colors, radius } from '../src/theme';

export default function Settings() {
  const router = useRouter();
  const {
    profile,
    userId,
    memberships,
    activeGroup,
    role,
    setActiveGroup,
    updateName,
    refreshMemberships,
    signOut,
  } = useSession();

  const [name, setName] = useState(profile?.name ?? '');
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const onLeaveGroup = () => {
    if (!activeGroup || !userId) return;
    Alert.alert(
      `'${activeGroup.name}'에서 나갈까요?`,
      role === 'leader'
        ? '리더가 나가면 다른 멤버에게 리더가 넘어가요. 혼자라면 소그룹이 사라져요.'
        : '다시 들어오려면 초대코드가 필요해요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '나가기',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await leaveGroup(activeGroup.id, userId);
              await refreshMemberships();
              haptic.success();
              router.replace('/');
            } catch (e) {
              Alert.alert('나가지 못했어요', String(e instanceof Error ? e.message : e));
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const onDeleteAccount = () => {
    Alert.alert(
      '정말 계정을 삭제할까요?',
      '내 묵상·댓글·응원 음성이 모두 지워지고 되돌릴 수 없어요.',
      [
        { text: '취소', style: 'cancel' },
        {
          text: '계정 삭제',
          style: 'destructive',
          onPress: async () => {
            setBusy(true);
            try {
              await deleteAccount();
              haptic.success();
              await signOut();
              router.replace('/onboarding');
            } catch (e) {
              Alert.alert(
                '삭제하지 못했어요',
                `${e instanceof Error ? e.message : e}\n\ndelete-account Edge Function 배포가 필요할 수 있어요.`,
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ],
    );
  };

  const save = async () => {
    if (!name.trim()) return;
    setSaving(true);
    try {
      await updateName(name);
      Alert.alert('이름을 바꿨어요');
    } catch (e) {
      Alert.alert('바꾸지 못했어요', String(e instanceof Error ? e.message : e));
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.paper }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: 20,
          paddingVertical: 14,
          borderBottomWidth: 1,
          borderBottomColor: colors.line,
        }}
      >
        <Serif style={{ fontSize: 19, color: colors.ink800 }}>내 설정</Serif>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Sans style={{ fontSize: 20, color: colors.muted5 }}>×</Sans>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
        <View style={{ alignItems: 'center', paddingVertical: 12 }}>
          <Avatar name={profile?.name ?? '나'} seed={userId ?? 'me'} size={64} />
        </View>

        <View style={{ marginTop: 12, marginBottom: 6 }}>
          <TagLabel>이름</TagLabel>
        </View>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          <Field value={name} onChangeText={setName} style={{ flex: 1 }} />
          <Button label="저장" onPress={save} loading={saving} style={{ paddingVertical: 11 }} />
        </View>

        {activeGroup && (
          <>
            <View style={{ marginTop: 24, marginBottom: 6 }}>
              <TagLabel>초대코드</TagLabel>
            </View>
            <Pressable
              onPress={async () => {
                await Clipboard.setStringAsync(activeGroup.invite_code);
                setCopied(true);
                setTimeout(() => setCopied(false), 1600);
              }}
              style={{
                backgroundColor: colors.tint,
                borderWidth: 1,
                borderColor: colors.lineWarm,
                borderRadius: radius.lg,
                padding: 16,
              }}
            >
              <Serif style={{ fontSize: 24, letterSpacing: 6, color: colors.clay }}>
                {activeGroup.invite_code}
              </Serif>
              <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 6 }}>
                {copied ? '복사했어요!' : '탭하면 복사돼요'}
              </Sans>
            </Pressable>
          </>
        )}

        {memberships.length > 1 && (
          <>
            <View style={{ marginTop: 24, marginBottom: 8 }}>
              <TagLabel>소그룹 바꾸기</TagLabel>
            </View>
            {memberships.map((m) => {
              const on = m.group.id === activeGroup?.id;
              return (
                <Pressable
                  key={m.group.id}
                  onPress={() => setActiveGroup(m.group.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fffdf8',
                    borderWidth: 1,
                    borderColor: on ? colors.clay : colors.lineSoft,
                    borderRadius: 14,
                    padding: 14,
                    marginBottom: 8,
                  }}
                >
                  <Sans style={{ fontSize: 14, color: colors.ink600 }}>{m.group.name}</Sans>
                  <Sans style={{ fontSize: 11, color: on ? colors.clay : colors.muted4 }}>
                    {m.role === 'leader' ? '리더' : '멤버'}
                    {on ? ' · 사용 중' : ''}
                  </Sans>
                </Pressable>
              );
            })}
          </>
        )}

        <Button
          variant="outline"
          label="새 소그룹 참여 / 만들기"
          onPress={() => router.push('/onboarding?add=1')}
          style={{ marginTop: 24 }}
        />

        {activeGroup && (
          <Pressable onPress={onLeaveGroup} disabled={busy} style={{ paddingVertical: 14 }}>
            <Sans style={{ textAlign: 'center', fontSize: 13, color: colors.muted2 }}>
              '{activeGroup.name}'에서 나가기
            </Sans>
          </Pressable>
        )}

        <Pressable
          onPress={() => {
            Alert.alert('로그아웃할까요?', '', [
              { text: '취소', style: 'cancel' },
              {
                text: '로그아웃',
                style: 'destructive',
                onPress: async () => {
                  await signOut();
                  router.replace('/onboarding');
                },
              },
            ]);
          }}
          style={{ paddingVertical: 14 }}
        >
          <Sans style={{ textAlign: 'center', fontSize: 13, color: colors.danger }}>
            로그아웃
          </Sans>
        </Pressable>

        <View
          style={{ flexDirection: 'row', justifyContent: 'center', gap: 14, paddingVertical: 6 }}
        >
          <Pressable onPress={() => router.push('/legal?type=terms')} hitSlop={6}>
            <Sans style={{ fontSize: 12, color: colors.muted2 }}>이용약관</Sans>
          </Pressable>
          <Sans style={{ fontSize: 12, color: colors.muted5 }}>·</Sans>
          <Pressable onPress={() => router.push('/legal?type=privacy')} hitSlop={6}>
            <Sans style={{ fontSize: 12, color: colors.muted2 }}>개인정보처리방침</Sans>
          </Pressable>
        </View>

        <View style={{ height: 1, backgroundColor: colors.line, marginVertical: 8 }} />

        <Pressable onPress={onDeleteAccount} disabled={busy} style={{ paddingVertical: 14 }}>
          <Sans style={{ textAlign: 'center', fontSize: 12, color: colors.muted4 }}>
            계정 삭제
          </Sans>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}
