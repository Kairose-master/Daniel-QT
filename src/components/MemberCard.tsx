import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, ScrollView, View } from 'react-native';

import { colors, fonts, radius, stampTypes } from '../theme';
import type { MemberCard as Card, StampKind } from '../types';
import { Avatar, Field, Sans, Serif, TagLabel } from './ui';

export const CARD_COLLAPSED_W = 104;
export const CARD_EXPANDED_W = 300;
const CARD_COLLAPSED_H = 214;
const CARD_EXPANDED_H = 468;

type Props = {
  card: Card;
  expanded: boolean;
  myUserId: string;
  onToggle: () => void;
  onStamp: (entryId: string, kind: StampKind | null) => void;
  onComment: (entryId: string, text: string) => Promise<void>;
};

export function MemberCardView({
  card,
  expanded,
  myUserId,
  onToggle,
  onStamp,
  onComment,
}: Props) {
  const anim = useRef(new Animated.Value(expanded ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: expanded ? 1 : 0,
      duration: 380,
      easing: Easing.bezier(0.2, 0.8, 0.2, 1),
      useNativeDriver: false, // width/height 는 네이티브 드라이버가 못 다룹니다
    }).start();
  }, [expanded, anim]);

  const width = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_COLLAPSED_W, CARD_EXPANDED_W],
  });
  const height = anim.interpolate({
    inputRange: [0, 1],
    outputRange: [CARD_COLLAPSED_H, CARD_EXPANDED_H],
  });

  const done = !!card.entry;

  return (
    <Animated.View
      style={{
        width,
        height,
        backgroundColor: done ? colors.card : colors.cardMuted,
        borderWidth: 1,
        borderColor: expanded ? '#e6d4b8' : colors.lineWarm,
        borderRadius: radius.xl,
        overflow: 'hidden',
      }}
    >
      {expanded ? (
        <ExpandedBody
          card={card}
          myUserId={myUserId}
          onClose={onToggle}
          onStamp={onStamp}
          onComment={onComment}
        />
      ) : (
        <Pressable onPress={onToggle} style={{ flex: 1 }}>
          <CollapsedBody card={card} />
        </Pressable>
      )}
    </Animated.View>
  );
}

// ── 접힌 상태 ─────────────────────────────────────────────────

function CollapsedBody({ card }: { card: Card }) {
  const done = !!card.entry;
  return (
    <View
      style={{
        flex: 1,
        alignItems: 'center',
        paddingTop: 16,
        paddingHorizontal: 9,
        paddingBottom: 12,
      }}
    >
      <Avatar name={card.name} seed={card.userId} size={42} dim={!done} />
      <Sans style={{ fontSize: 13, color: '#4d473c', marginTop: 8 }} numberOfLines={1}>
        {card.name}
      </Sans>

      {done ? (
        <Serif
          numberOfLines={4}
          style={{
            flex: 1,
            fontSize: 11,
            lineHeight: 18,
            color: colors.muted,
            marginTop: 9,
            textAlign: 'center',
          }}
        >
          {card.entry!.reflection}
        </Serif>
      ) : (
        <View style={{ flex: 1, justifyContent: 'center' }}>
          <Sans style={{ fontSize: 11, color: colors.muted5 }}>아직 안 올림</Sans>
        </View>
      )}

      <View
        style={{
          width: 7,
          height: 7,
          borderRadius: 3.5,
          backgroundColor: done ? colors.sage : '#ddd2bd',
          marginTop: 8,
        }}
      />
    </View>
  );
}

// ── 펼친 상태 ─────────────────────────────────────────────────

function ExpandedBody({
  card,
  myUserId,
  onClose,
  onStamp,
  onComment,
}: {
  card: Card;
  myUserId: string;
  onClose: () => void;
  onStamp: (entryId: string, kind: StampKind | null) => void;
  onComment: (entryId: string, text: string) => Promise<void>;
}) {
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const entry = card.entry;

  const send = async () => {
    if (!entry || !draft.trim() || sending) return;
    setSending(true);
    try {
      await onComment(entry.id, draft);
      setDraft('');
    } finally {
      setSending(false);
    }
  };

  const myStamp = entry?.stamps.find((s) => s.user_id === myUserId)?.kind ?? null;
  const counts = new Map<string, number>();
  for (const s of entry?.stamps ?? []) counts.set(s.kind, (counts.get(s.kind) ?? 0) + 1);

  return (
    <ScrollView
      style={{ flex: 1 }}
      contentContainerStyle={{ padding: 16, paddingBottom: 18 }}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Avatar name={card.name} seed={card.userId} size={40} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <Sans style={{ fontSize: 15, color: colors.ink800 }}>{card.name}</Sans>
            <Badge leader={card.role === 'leader'} />
          </View>
          <Sans style={{ fontSize: 11, color: '#b1a488', marginTop: 2 }}>
            {card.streak > 0 ? `${card.streak}일 연속 묵상` : '오늘 첫 묵상'}
          </Sans>
        </View>
        <Pressable onPress={onClose} hitSlop={10} style={{ paddingHorizontal: 4 }}>
          <Sans style={{ fontSize: 18, color: colors.muted5 }}>×</Sans>
        </Pressable>
      </View>

      {!entry ? (
        <View style={{ marginTop: 24, alignItems: 'center', paddingVertical: 20 }}>
          <Sans style={{ fontSize: 13, color: '#b1a488', lineHeight: 22, textAlign: 'center' }}>
            아직 오늘의 묵상을{'\n'}나누지 않았어요
          </Sans>
          <Sans style={{ fontSize: 12, color: colors.muted5, marginTop: 12 }}>
            기다리며 기도해 주세요 🙏
          </Sans>
        </View>
      ) : (
        <>
          <View style={{ marginTop: 16 }}>
            <TagLabel>느낀점</TagLabel>
          </View>
          <Serif style={{ fontSize: 14, lineHeight: 26, color: colors.ink700, marginTop: 6 }}>
            {entry.reflection}
          </Serif>

          {entry.prayer ? (
            <>
              <View style={{ marginTop: 16 }}>
                <TagLabel>기도제목</TagLabel>
              </View>
              <View
                style={{
                  backgroundColor: colors.tint,
                  borderRadius: 12,
                  padding: 12,
                  marginTop: 6,
                }}
              >
                <Sans style={{ fontSize: 13, lineHeight: 22, color: colors.ink500 }}>
                  {entry.prayer}
                </Sans>
              </View>
            </>
          ) : null}

          {/* 위로 스탬프 */}
          <View style={{ marginTop: 16 }}>
            {counts.size > 0 && (
              <View
                style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 11 }}
              >
                {stampTypes
                  .filter((t) => counts.get(t.key))
                  .map((t) => (
                    <View
                      key={t.key}
                      style={{
                        flexDirection: 'row',
                        alignItems: 'center',
                        gap: 5,
                        backgroundColor: '#f4ece0',
                        borderWidth: 1,
                        borderColor: '#ecdfc9',
                        borderRadius: radius.pill,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Sans style={{ fontSize: 11, color: '#8a6a4c' }}>{t.label}</Sans>
                      <Sans style={{ fontSize: 11, color: '#b39069' }}>
                        {counts.get(t.key)}
                      </Sans>
                    </View>
                  ))}
              </View>
            )}

            {entry.user_id !== myUserId && (
              <>
                <Sans style={{ fontSize: 11, letterSpacing: 1, color: colors.label, marginBottom: 8 }}>
                  잔잔한 위로 건네기
                </Sans>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                  {stampTypes.map((t) => {
                    const on = myStamp === t.key;
                    return (
                      <Pressable
                        key={t.key}
                        onPress={() => onStamp(entry.id, on ? null : t.key)}
                        style={{
                          borderWidth: 1,
                          borderColor: on ? colors.clay : colors.lineField,
                          backgroundColor: on ? colors.clay : colors.tint,
                          borderRadius: radius.pill,
                          paddingHorizontal: 12,
                          paddingVertical: 7,
                        }}
                      >
                        <Sans style={{ fontSize: 12, color: on ? colors.white : '#8a7f6a' }}>
                          {t.label}
                        </Sans>
                      </Pressable>
                    );
                  })}
                </View>
              </>
            )}
          </View>

          {/* 댓글 */}
          <View
            style={{ marginTop: 16, borderTopWidth: 1, borderTopColor: '#eee3d1', paddingTop: 12 }}
          >
            {entry.comments.map((c) => (
              <View key={c.id} style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
                <Avatar name={c.profile?.name ?? '?'} seed={c.user_id} size={24} />
                <View
                  style={{
                    flex: 1,
                    backgroundColor: colors.tint,
                    borderRadius: 12,
                    borderTopLeftRadius: 0,
                    paddingHorizontal: 11,
                    paddingVertical: 8,
                  }}
                >
                  <Sans style={{ fontSize: 11, color: '#a2957c', marginBottom: 2 }}>
                    {c.user_id === myUserId ? '나' : (c.profile?.name ?? '')}
                  </Sans>
                  <Sans style={{ fontSize: 13, color: '#4d473c', lineHeight: 21 }}>{c.text}</Sans>
                </View>
              </View>
            ))}

            <View style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
              <Field
                value={draft}
                onChangeText={setDraft}
                placeholder="따뜻한 댓글 남기기"
                onSubmitEditing={send}
                returnKeyType="send"
                style={{
                  flex: 1,
                  borderRadius: radius.pill,
                  paddingVertical: 8,
                  fontSize: 12,
                }}
              />
              <Pressable
                onPress={send}
                disabled={sending || !draft.trim()}
                style={{
                  backgroundColor: colors.clay,
                  borderRadius: radius.pill,
                  paddingHorizontal: 14,
                  justifyContent: 'center',
                  opacity: sending || !draft.trim() ? 0.5 : 1,
                }}
              >
                <Sans style={{ fontSize: 12, color: colors.white, fontFamily: fonts.sans }}>
                  등록
                </Sans>
              </Pressable>
            </View>
          </View>
        </>
      )}
    </ScrollView>
  );
}

function Badge({ leader }: { leader: boolean }) {
  const c = leader ? colors.clay : colors.labelSoft;
  return (
    <View
      style={{
        borderWidth: 1,
        borderColor: c,
        borderRadius: 6,
        paddingHorizontal: 5,
        paddingVertical: 1,
      }}
    >
      <Sans style={{ fontSize: 9, color: c }}>{leader ? '리더' : '멤버'}</Sans>
    </View>
  );
}
