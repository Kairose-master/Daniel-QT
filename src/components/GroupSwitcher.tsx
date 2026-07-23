import { useRouter } from 'expo-router';
import React from 'react';
import { Modal, Pressable, ScrollView, View } from 'react-native';

import { haptic } from '../lib/haptics';
import { useSession } from '../lib/session';
import { colors, radius } from '../theme';
import { Sans, Serif } from './ui';

/**
 * 방(소그룹) 전환 시트. 헤더와 QT 작성 시트에서 함께 씁니다.
 * 방을 고르면 activeGroup 이 바뀌고 홈 전체(본문·타임라인·카드)가 그 방으로 갱신됩니다.
 */
export function GroupSwitcher({
  visible,
  onClose,
  title = '소그룹 고르기',
  subtitle,
}: {
  visible: boolean;
  onClose: () => void;
  title?: string;
  subtitle?: string;
}) {
  const router = useRouter();
  const { memberships, activeGroup, setActiveGroup } = useSession();

  const pick = async (groupId: string) => {
    haptic.select();
    await setActiveGroup(groupId);
    onClose();
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,38,29,0.4)' }}>
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#f7f2ea',
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            padding: 22,
            paddingBottom: 34,
            maxHeight: '75%',
          }}
        >
          <View
            style={{
              width: 40,
              height: 4,
              borderRadius: 2,
              backgroundColor: '#ddd2bd',
              alignSelf: 'center',
              marginBottom: 16,
            }}
          />
          <Serif style={{ fontSize: 18, color: colors.ink800 }}>{title}</Serif>
          {subtitle ? (
            <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 4 }}>{subtitle}</Sans>
          ) : null}

          <ScrollView style={{ marginTop: 16 }} showsVerticalScrollIndicator={false}>
            {memberships.map((m) => {
              const on = m.group.id === activeGroup?.id;
              return (
                <Pressable
                  key={m.group.id}
                  onPress={() => pick(m.group.id)}
                  style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    backgroundColor: '#fffdf8',
                    borderWidth: 1,
                    borderColor: on ? colors.clay : colors.lineSoft,
                    borderRadius: 14,
                    padding: 15,
                    marginBottom: 8,
                  }}
                >
                  <View style={{ flex: 1 }}>
                    <Sans style={{ fontSize: 15, color: colors.ink700 }}>{m.group.name}</Sans>
                    <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 2 }}>
                      {m.role === 'leader' ? '내가 리더' : '멤버'}
                    </Sans>
                  </View>
                  {on ? (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        backgroundColor: colors.clay,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <Sans style={{ color: colors.white, fontSize: 12 }}>✓</Sans>
                    </View>
                  ) : (
                    <View
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 11,
                        borderWidth: 1.5,
                        borderColor: colors.lineStrong,
                      }}
                    />
                  )}
                </Pressable>
              );
            })}
          </ScrollView>

          <Pressable
            onPress={() => {
              onClose();
              router.push('/onboarding?add=1');
            }}
            style={{
              borderWidth: 1.5,
              borderColor: colors.lineStrong,
              borderStyle: 'dashed',
              borderRadius: 14,
              paddingVertical: 14,
              alignItems: 'center',
              marginTop: 4,
            }}
          >
            <Sans style={{ fontSize: 14, color: colors.ink500 }}>＋ 새 소그룹 참여 / 만들기</Sans>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}
