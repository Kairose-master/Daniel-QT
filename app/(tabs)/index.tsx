import { useRouter } from 'expo-router';
import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Linking,
  Modal,
  Platform,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { GroupSwitcher } from '../../src/components/GroupSwitcher';
import { MemberDetailModal } from '../../src/components/MemberDetailModal';
import { MosaicBoard } from '../../src/components/MosaicBoard';
import {
  Avatar,
  Button,
  Empty,
  Field,
  Loading,
  Sans,
  SectionTitle,
  Serif,
  TagLabel,
} from '../../src/components/ui';
import { addComment, saveMyEntry, setStamp } from '../../src/lib/api';
import { dateKey, formatKoreanDate, formatKoreanTime } from '../../src/lib/date';
import { haptic } from '../../src/lib/haptics';
import { notifyGroup } from '../../src/lib/notifications';
import { useSession } from '../../src/lib/session';
import { useBoard } from '../../src/lib/useBoard';
import { colors, radius } from '../../src/theme';
import type { StampKind } from '../../src/types';

export default function ThreadScreen() {
  const router = useRouter();
  const { activeGroup, userId, profile, memberships } = useSession();
  const today = dateKey();
  const board = useBoard(activeGroup?.id ?? null, userId, today);

  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [writeOpen, setWriteOpen] = useState(false);
  const [roomsOpen, setRoomsOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const openCard = board.cards.find((c) => c.userId === expandedId) ?? null;

  const onRefresh = async () => {
    setRefreshing(true);
    await board.reload();
    setRefreshing(false);
  };

  const handleStamp = async (entryId: string, kind: StampKind | null) => {
    if (!userId) return;
    haptic.light();
    try {
      await setStamp(entryId, userId, kind);
      await board.reload();
    } catch (e) {
      Alert.alert('위로를 보내지 못했어요', String(e instanceof Error ? e.message : e));
    }
  };

  const handleComment = async (entryId: string, text: string) => {
    if (!userId) return;
    try {
      await addComment(entryId, userId, text);
      await board.reload();
    } catch (e) {
      Alert.alert('댓글을 남기지 못했어요', String(e instanceof Error ? e.message : e));
    }
  };

  const submitEntry = async (reflection: string, prayer: string) => {
    if (!userId || !board.passage) return;
    await saveMyEntry({ passageId: board.passage.id, userId, reflection, prayer });
    haptic.success();
    setWriteOpen(false);
    await board.reload();
    if (activeGroup) {
      notifyGroup({
        groupId: activeGroup.id,
        title: '오늘의 묵상',
        body: `${profile?.name ?? '지체'}님이 묵상을 나눴어요`,
        excludeUserId: userId,
      });
    }
  };

  if (board.loading) return <Loading />;

  const timeline = board.cards.filter((c) => c.entry);

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.clay} />
        }
      >
        {board.error && (
          <Sans style={{ color: colors.danger, fontSize: 12, marginBottom: 12 }}>
            {board.error}
          </Sans>
        )}

        {/* 오늘의 본문 */}
        {board.passage ? (
          <View
            style={{
              backgroundColor: '#fffdf8',
              borderWidth: 1,
              borderColor: colors.lineWarm,
              borderRadius: radius.xl,
              padding: 20,
            }}
          >
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Sans style={{ fontSize: 11, letterSpacing: 2, color: colors.label }}>
                오늘의 본문 · {formatKoreanDate(board.passage.date)}
              </Sans>
              <Sans style={{ fontSize: 11, color: colors.sageLight }}>
                {board.doneCount}/{board.total} 참여
              </Sans>
            </View>

            <Serif style={{ fontSize: 23, color: colors.ink900, marginTop: 10, marginBottom: 8 }}>
              {board.passage.ref}
            </Serif>

            {board.passage.verse_text ? (
              <Serif style={{ fontSize: 15, lineHeight: 28, color: colors.ink500 }}>
                {board.passage.verse_text}
              </Serif>
            ) : null}

            {board.passage.devotion ? (
              <View
                style={{
                  marginTop: 14,
                  backgroundColor: colors.tint,
                  borderRadius: 12,
                  padding: 12,
                }}
              >
                <Serif style={{ fontSize: 13, lineHeight: 24, color: colors.ink500 }}>
                  {board.passage.devotion}
                </Serif>
              </View>
            ) : null}

            {board.passage.link_url ? (
              <Pressable
                onPress={() => Linking.openURL(board.passage!.link_url!)}
                style={{
                  alignSelf: 'flex-start',
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 7,
                  marginTop: 14,
                  paddingHorizontal: 14,
                  paddingVertical: 8,
                  backgroundColor: colors.chip,
                  borderWidth: 1,
                  borderColor: colors.lineField,
                  borderRadius: radius.pill,
                }}
              >
                <View
                  style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay }}
                />
                <Sans style={{ fontSize: 12, color: '#8a6a4c' }}>함께 보는 설교 영상</Sans>
              </Pressable>
            ) : null}
          </View>
        ) : (
          <View
            style={{
              backgroundColor: '#fffdf8',
              borderWidth: 1,
              borderColor: colors.lineWarm,
              borderRadius: radius.xl,
              padding: 24,
            }}
          >
            <Sans style={{ fontSize: 11, letterSpacing: 2, color: colors.label }}>
              {formatKoreanDate(today)}
            </Sans>
            <Serif style={{ fontSize: 18, color: colors.ink800, marginTop: 10, lineHeight: 30 }}>
              아직 오늘의 본문이{'\n'}올라오지 않았어요
            </Serif>
            <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 8, lineHeight: 20 }}>
              리더가 본문을 올리면 알림으로 알려드릴게요
            </Sans>
          </View>
        )}

        {/* QT 쓰기 */}
        {board.passage && !board.myEntry && (
          <Button
            variant="dashed"
            label="＋  오늘의 QT 쓰기"
            onPress={() => setWriteOpen(true)}
            style={{ marginTop: 16, borderRadius: 16 }}
          />
        )}
        {board.passage && board.myEntry && (
          <Button
            variant="outline"
            label="내 나눔 고치기"
            onPress={() => setWriteOpen(true)}
            style={{ marginTop: 16, borderRadius: 16 }}
          />
        )}

        {/* 타임라인 */}
        <View
          style={{
            marginTop: 24,
            marginBottom: 12,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <SectionTitle>오늘의 타임라인</SectionTitle>
          <Pressable onPress={() => router.push('/archive')} hitSlop={8}>
            <Sans style={{ fontSize: 12, color: colors.clay }}>지난 묵상 →</Sans>
          </Pressable>
        </View>

        {timeline.length === 0 ? (
          <Empty title="아직 나눔이 없어요" hint="첫 묵상을 나눠보세요" />
        ) : (
          timeline.map((c) => (
            <Pressable
              key={c.userId}
              onPress={() => setExpandedId(c.userId)}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: 11,
                paddingVertical: 11,
                paddingHorizontal: 13,
                backgroundColor: '#fffdf8',
                borderWidth: 1,
                borderColor: colors.lineSoft,
                borderRadius: 14,
                marginBottom: 8,
              }}
            >
              <Avatar name={c.name} seed={c.userId} size={34} />
              <View style={{ flex: 1 }}>
                <Sans style={{ fontSize: 12, color: colors.ink400 }}>
                  <Sans style={{ color: colors.ink800 }}>{c.name}</Sans>님이 묵상을 나눴어요
                </Sans>
                <Serif numberOfLines={1} style={{ fontSize: 12, color: colors.muted, marginTop: 2 }}>
                  "{c.entry!.reflection}"
                </Serif>
              </View>
              <Sans style={{ fontSize: 11, color: colors.muted4 }}>
                {formatKoreanTime(c.entry!.created_at)}
              </Sans>
            </Pressable>
          ))
        )}

        {/* 같은 하루, 함께한 묵상 (Setlog 식 모자이크) */}
        <View style={{ marginTop: 24, marginBottom: 12 }}>
          <SectionTitle>같은 하루, 함께한 묵상</SectionTitle>
          <Sans style={{ fontSize: 11, color: colors.labelSoft, marginTop: 3 }}>
            {board.doneCount}명이 나눴어요 · 탭하면 자세히 볼 수 있어요
          </Sans>
        </View>

        <MosaicBoard cards={board.cards} myUserId={userId ?? ''} onOpen={setExpandedId} />
      </ScrollView>

      <WriteSheet
        visible={writeOpen}
        groupName={activeGroup?.name ?? ''}
        hasPassage={!!board.passage}
        multiRoom={memberships.length > 1}
        onOpenRooms={() => setRoomsOpen(true)}
        passageRef={board.passage?.ref ?? ''}
        initialReflection={board.myEntry?.reflection ?? ''}
        initialPrayer={board.myEntry?.prayer ?? ''}
        onClose={() => setWriteOpen(false)}
        onSubmit={submitEntry}
      />

      <GroupSwitcher
        visible={roomsOpen}
        onClose={() => setRoomsOpen(false)}
        title="어느 방에 올릴까요?"
        subtitle="고른 방의 오늘 본문에 나눔을 올려요"
      />

      <MemberDetailModal
        card={openCard}
        myUserId={userId ?? ''}
        visible={!!openCard}
        onClose={() => setExpandedId(null)}
        onStamp={handleStamp}
        onComment={handleComment}
      />
    </>
  );
}

// ── QT 작성 시트 ──────────────────────────────────────────────

function WriteSheet({
  visible,
  groupName,
  hasPassage,
  multiRoom,
  onOpenRooms,
  passageRef,
  initialReflection,
  initialPrayer,
  onClose,
  onSubmit,
}: {
  visible: boolean;
  groupName: string;
  hasPassage: boolean;
  multiRoom: boolean;
  onOpenRooms: () => void;
  passageRef: string;
  initialReflection: string;
  initialPrayer: string;
  onClose: () => void;
  onSubmit: (reflection: string, prayer: string) => Promise<void>;
}) {
  const [reflection, setReflection] = useState(initialReflection);
  const [prayer, setPrayer] = useState(initialPrayer);
  const [busy, setBusy] = useState(false);

  // 시트를 열 때마다 현재 값으로 맞춥니다.
  React.useEffect(() => {
    if (visible) {
      setReflection(initialReflection);
      setPrayer(initialPrayer);
    }
  }, [visible, initialReflection, initialPrayer]);

  const submit = async () => {
    if (!hasPassage) {
      Alert.alert('이 방은 아직 오늘 본문이 없어요', '리더가 본문을 올리면 나눔을 쓸 수 있어요.');
      return;
    }
    if (!reflection.trim()) {
      Alert.alert('느낀점을 적어주세요');
      return;
    }
    setBusy(true);
    try {
      await onSubmit(reflection, prayer);
    } catch (e) {
      Alert.alert('올리지 못했어요', String(e instanceof Error ? e.message : e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView
        style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,38,29,0.4)' }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <Pressable style={{ flex: 1 }} onPress={onClose} />
        <View
          style={{
            backgroundColor: '#f7f2ea',
            borderTopLeftRadius: radius.xxl,
            borderTopRightRadius: radius.xxl,
            padding: 22,
            paddingBottom: 34,
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
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <Serif style={{ fontSize: 18, color: colors.ink800 }}>오늘의 QT 나누기</Serif>
            <Pressable onPress={onClose} hitSlop={10}>
              <Sans style={{ fontSize: 20, color: colors.muted5 }}>×</Sans>
            </Pressable>
          </View>

          {/* 올릴 방 선택 */}
          <Pressable
            onPress={onOpenRooms}
            disabled={!multiRoom}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 8,
              alignSelf: 'flex-start',
              marginTop: 10,
              paddingHorizontal: 12,
              paddingVertical: 7,
              backgroundColor: colors.tint,
              borderWidth: 1,
              borderColor: colors.lineField,
              borderRadius: radius.pill,
            }}
          >
            <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: colors.clay }} />
            <Sans style={{ fontSize: 12, color: colors.ink600 }}>{groupName}</Sans>
            {multiRoom && <Sans style={{ fontSize: 11, color: colors.clay }}>방 바꾸기 ▾</Sans>}
          </Pressable>

          <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 8, marginBottom: 16 }}>
            {hasPassage ? passageRef : '이 방은 아직 오늘 본문이 없어요'}
          </Sans>

          <View style={{ marginBottom: 6 }}>
            <TagLabel>느낀점</TagLabel>
          </View>
          <Field
            serif
            multiline
            value={reflection}
            onChangeText={setReflection}
            placeholder="말씀을 통해 마음에 다가온 것을 나눠보세요"
            style={{ height: 110, textAlignVertical: 'top', lineHeight: 25, borderRadius: 12 }}
          />

          <View style={{ marginTop: 16, marginBottom: 6 }}>
            <TagLabel>기도제목</TagLabel>
          </View>
          <Field
            serif
            multiline
            value={prayer}
            onChangeText={setPrayer}
            placeholder="함께 기도하고 싶은 제목을 적어주세요"
            style={{ height: 74, textAlignVertical: 'top', lineHeight: 25, borderRadius: 12 }}
          />

          <Button
            label="나눔 올리기"
            onPress={submit}
            loading={busy}
            style={{ marginTop: 18, borderRadius: 14 }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
