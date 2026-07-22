import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  useAudioRecorder,
  useAudioRecorderState,
} from 'expo-audio';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Animated,
  Easing,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  View,
} from 'react-native';

import { Avatar, Button, Empty, Loading, Sans, Serif } from '../../src/components/ui';
import {
  deleteVoiceMessage,
  fetchMembers,
  fetchVoiceMessages,
  markVoiceHeard,
  sendVoiceMessage,
  signedVoiceUrl,
  VoiceView,
} from '../../src/lib/api';
import { formatDuration, timeAgo } from '../../src/lib/date';
import { notifyGroup } from '../../src/lib/notifications';
import { useSession } from '../../src/lib/session';
import { colors, radius } from '../../src/theme';
import type { MemberWithProfile } from '../../src/types';

const MAX_SECONDS = 60;

type Filter = 'all' | 'recv' | 'sent';

export default function CheerScreen() {
  const { activeGroup, userId, profile } = useSession();
  const groupId = activeGroup?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [messages, setMessages] = useState<VoiceView[]>([]);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [filter, setFilter] = useState<Filter>('all');
  const [pending, setPending] = useState<{ uri: string; duration: number } | null>(null);
  const [uploading, setUploading] = useState(false);

  const recorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const recState = useAudioRecorderState(recorder, 250);

  const load = useCallback(async () => {
    if (!groupId) return;
    const [vs, ms] = await Promise.all([fetchVoiceMessages(groupId), fetchMembers(groupId)]);
    setMessages(vs);
    setMembers(ms);
    setLoading(false);
  }, [groupId]);

  useEffect(() => {
    load();
  }, [load]);

  // 녹음 시작 / 정지
  const toggleRecord = async () => {
    if (recState.isRecording) {
      await recorder.stop();
      const uri = recorder.uri;
      const seconds = Math.max(1, Math.round(recState.durationMillis / 1000));
      if (uri) setPending({ uri, duration: seconds });
      return;
    }

    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      Alert.alert(
        '마이크 권한이 필요해요',
        '설정에서 마이크 사용을 허용하면 응원 음성을 녹음할 수 있어요.',
      );
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record({ forDuration: MAX_SECONDS });
  };

  // forDuration 으로 자동 정지된 경우도 받는 사람 선택으로 넘깁니다.
  const wasRecording = useRef(false);
  useEffect(() => {
    if (wasRecording.current && !recState.isRecording && !pending && recorder.uri) {
      setPending({ uri: recorder.uri, duration: MAX_SECONDS });
    }
    wasRecording.current = recState.isRecording;
  }, [recState.isRecording, pending, recorder]);

  const send = async (toUserId: string) => {
    if (!pending || !groupId || !userId) return;
    setUploading(true);
    try {
      await sendVoiceMessage({
        groupId,
        fromUserId: userId,
        toUserId,
        localUri: pending.uri,
        duration: pending.duration,
      });
      await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
      setPending(null);
      await load();
      notifyGroup({
        groupId,
        toUserId,
        title: '응원 음성이 도착했어요',
        body: `${profile?.name ?? '지체'}님이 응원 음성을 보냈어요`,
      });
    } catch (e) {
      Alert.alert('보내지 못했어요', String(e instanceof Error ? e.message : e));
    } finally {
      setUploading(false);
    }
  };

  const remove = (msg: VoiceView) => {
    Alert.alert('이 응원 음성을 지울까요?', '', [
      { text: '취소', style: 'cancel' },
      {
        text: '삭제',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteVoiceMessage(msg);
            await load();
          } catch (e) {
            Alert.alert('삭제하지 못했어요', String(e instanceof Error ? e.message : e));
          }
        },
      },
    ]);
  };

  const shown = useMemo(() => {
    if (filter === 'recv') return messages.filter((m) => m.to_user_id === userId);
    if (filter === 'sent') return messages.filter((m) => m.from_user_id === userId);
    return messages;
  }, [messages, filter, userId]);

  const unheard = messages.filter((m) => m.to_user_id === userId && !m.heard).length;

  if (loading) return <Loading />;

  return (
    <>
      <ScrollView
        style={{ flex: 1, backgroundColor: colors.paper }}
        contentContainerStyle={{ padding: 20, paddingBottom: 40 }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.clay}
            onRefresh={async () => {
              setRefreshing(true);
              await load();
              setRefreshing(false);
            }}
          />
        }
      >
        <Serif style={{ fontSize: 19, color: colors.ink800 }}>응원함</Serif>
        <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 4 }}>
          {unheard > 0
            ? `아직 안 들은 음성이 ${unheard}개 있어요`
            : '서로를 위해 직접 녹음한 목소리를 모아요'}
        </Sans>

        {/* 녹음 */}
        <View
          style={{
            marginVertical: 20,
            backgroundColor: '#fbf4e8',
            borderWidth: 1,
            borderColor: colors.lineWarm,
            borderRadius: radius.xl,
            padding: 22,
            alignItems: 'center',
          }}
        >
          <RecordButton recording={recState.isRecording} onPress={toggleRecord} />
          <Sans style={{ fontSize: 13, color: '#8a6a4c', marginTop: 14 }}>
            {recState.isRecording
              ? `녹음 중… ${formatDuration(recState.durationMillis / 1000)} · 탭하여 완료`
              : '눌러서 응원 녹음하기'}
          </Sans>
          {recState.isRecording && (
            <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 4 }}>
              최대 {MAX_SECONDS}초
            </Sans>
          )}
        </View>

        {/* 필터 */}
        <View style={{ flexDirection: 'row', gap: 6, marginBottom: 14 }}>
          {(
            [
              ['all', '전체'],
              ['recv', '받은'],
              ['sent', '보낸'],
            ] as [Filter, string][]
          ).map(([key, label]) => {
            const on = filter === key;
            return (
              <Pressable
                key={key}
                onPress={() => setFilter(key)}
                style={{
                  paddingHorizontal: 14,
                  paddingVertical: 7,
                  borderRadius: radius.pill,
                  borderWidth: 1,
                  borderColor: on ? colors.clay : colors.lineField,
                  backgroundColor: on ? colors.clay : colors.tint,
                }}
              >
                <Sans style={{ fontSize: 12, color: on ? colors.white : '#8a7f6a' }}>{label}</Sans>
              </Pressable>
            );
          })}
        </View>

        {shown.length === 0 ? (
          <Empty title="아직 주고받은 응원이 없어요" hint="위 버튼을 눌러 첫 목소리를 남겨보세요" />
        ) : (
          shown.map((m) => (
            <VoiceCard
              key={m.id}
              msg={m}
              myUserId={userId ?? ''}
              onHeard={load}
              onDelete={() => remove(m)}
            />
          ))
        )}
      </ScrollView>

      {/* 받는 사람 선택 */}
      <Modal visible={!!pending} transparent animationType="slide" onRequestClose={() => setPending(null)}>
        <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(44,38,29,0.4)' }}>
          <Pressable style={{ flex: 1 }} onPress={() => (uploading ? null : setPending(null))} />
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
            <Serif style={{ fontSize: 18, color: colors.ink800 }}>누구에게 보낼까요?</Serif>
            <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 4, marginBottom: 16 }}>
              {pending ? `${formatDuration(pending.duration)} 녹음됨` : ''}
            </Sans>

            <ScrollView style={{ maxHeight: 300 }}>
              {members
                .filter((m) => m.user_id !== userId)
                .map((m) => (
                  <Pressable
                    key={m.user_id}
                    disabled={uploading}
                    onPress={() => send(m.user_id)}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      gap: 10,
                      padding: 12,
                      backgroundColor: '#fffdf8',
                      borderWidth: 1,
                      borderColor: colors.lineSoft,
                      borderRadius: 14,
                      marginBottom: 8,
                      opacity: uploading ? 0.5 : 1,
                    }}
                  >
                    <Avatar name={m.profile.name} seed={m.user_id} size={32} />
                    <Sans style={{ flex: 1, fontSize: 14, color: colors.ink600 }}>
                      {m.profile.name}
                    </Sans>
                    <Sans style={{ fontSize: 12, color: colors.muted4 }}>
                      {m.role === 'leader' ? '리더' : ''}
                    </Sans>
                  </Pressable>
                ))}
            </ScrollView>

            {uploading && (
              <View style={{ paddingVertical: 12 }}>
                <ActivityIndicator color={colors.clay} />
              </View>
            )}

            <Button
              variant="outline"
              label="다시 녹음하기"
              onPress={() => setPending(null)}
              disabled={uploading}
              style={{ marginTop: 8 }}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}

// ── 녹음 버튼 ─────────────────────────────────────────────────

function RecordButton({ recording, onPress }: { recording: boolean; onPress: () => void }) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!recording) {
      pulse.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulse, {
          toValue: 1.14,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulse, {
          toValue: 1,
          duration: 700,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [recording, pulse]);

  return (
    <Pressable onPress={onPress}>
      <Animated.View
        style={{
          width: 74,
          height: 74,
          borderRadius: 37,
          backgroundColor: recording ? colors.clayDeep : colors.clay,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [{ scale: pulse }],
        }}
      >
        <View
          style={{
            width: 26,
            height: 26,
            borderRadius: recording ? 5 : 13,
            backgroundColor: colors.white,
          }}
        />
      </Animated.View>
    </Pressable>
  );
}

// ── 음성 카드 ─────────────────────────────────────────────────

const BAR_HEIGHTS = [10, 18, 7, 22, 14, 26, 11, 20, 8, 24, 16, 12, 28, 9, 19, 13, 23, 10, 17, 7, 21, 15];

function VoiceCard({
  msg,
  myUserId,
  onHeard,
  onDelete,
}: {
  msg: VoiceView;
  myUserId: string;
  onHeard: () => void;
  onDelete: () => void;
}) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const player = useAudioPlayer(url ?? undefined);
  const status = useAudioPlayerStatus(player);
  const markedRef = useRef(false);

  const isMine = msg.from_user_id === myUserId;
  const isForMe = msg.to_user_id === myUserId;

  // 끝까지 들으면 heard 처리
  useEffect(() => {
    if (status.didJustFinish && isForMe && !msg.heard && !markedRef.current) {
      markedRef.current = true;
      markVoiceHeard(msg.id).then(onHeard).catch(() => {});
    }
  }, [status.didJustFinish, isForMe, msg.heard, msg.id, onHeard]);

  const toggle = async () => {
    if (status.playing) {
      player.pause();
      return;
    }
    if (!url) {
      setLoading(true);
      try {
        // 비공개 버킷 — 만료되는 서명 URL 로만 재생합니다.
        setUrl(await signedVoiceUrl(msg.storage_path));
      } catch (e) {
        Alert.alert('재생할 수 없어요', String(e instanceof Error ? e.message : e));
      } finally {
        setLoading(false);
      }
      return; // url 이 세팅되면 사용자가 한 번 더 누르거나 아래 효과가 재생합니다
    }
    if (status.currentTime >= status.duration && status.duration > 0) player.seekTo(0);
    player.play();
  };

  // 서명 URL 을 막 받은 경우 바로 재생
  const autoPlayRef = useRef(false);
  useEffect(() => {
    if (url && status.isLoaded && !autoPlayRef.current) {
      autoPlayRef.current = true;
      player.play();
    }
  }, [url, status.isLoaded, player]);

  const progress =
    status.duration > 0 ? status.currentTime / status.duration : 0;

  return (
    <View
      style={{
        backgroundColor: '#fffdf8',
        borderWidth: 1,
        borderColor: colors.lineWarm,
        borderRadius: radius.lg,
        paddingHorizontal: 16,
        paddingVertical: 14,
        marginBottom: 12,
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
        <Avatar name={msg.from.name} seed={msg.from_user_id} size={32} />
        <View style={{ flex: 1 }}>
          <Sans style={{ fontSize: 13, color: colors.ink600 }}>
            {isMine ? '나' : msg.from.name}
            <Sans style={{ fontSize: 12, color: colors.muted3 }}>
              {' → '}
              {isForMe ? '나' : msg.to.name}
            </Sans>
          </Sans>
        </View>
        {isForMe && !msg.heard && (
          <View
            style={{ width: 7, height: 7, borderRadius: 3.5, backgroundColor: colors.clay }}
          />
        )}
        <Sans style={{ fontSize: 11, color: colors.muted4 }}>{timeAgo(msg.created_at)}</Sans>
        {isMine && (
          <Pressable onPress={onDelete} hitSlop={8}>
            <Sans style={{ fontSize: 15, color: colors.muted5 }}>×</Sans>
          </Pressable>
        )}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 11, marginTop: 12 }}>
        <Pressable
          onPress={toggle}
          style={{
            width: 34,
            height: 34,
            borderRadius: 17,
            backgroundColor: colors.clay,
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {loading ? (
            <ActivityIndicator size="small" color={colors.white} />
          ) : (
            <Sans style={{ fontSize: 12, color: colors.white }}>
              {status.playing ? '❚❚' : '▶'}
            </Sans>
          )}
        </Pressable>

        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, height: 30 }}>
          {BAR_HEIGHTS.map((h, i) => {
            const seed = msg.id.charCodeAt(0) + i;
            const height = ((h * (seed % 5 || 2)) % 22) + 6;
            const passed = i / BAR_HEIGHTS.length <= progress && progress > 0;
            return (
              <View
                key={i}
                style={{
                  flex: 1,
                  height,
                  borderRadius: 2,
                  backgroundColor: passed ? colors.clay : colors.bar,
                }}
              />
            );
          })}
        </View>

        <Sans style={{ fontSize: 11, color: colors.muted2 }}>
          {formatDuration(msg.duration)}
        </Sans>
      </View>
    </View>
  );
}
