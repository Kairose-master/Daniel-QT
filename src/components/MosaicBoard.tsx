import React, { useMemo } from 'react';
import { Pressable, useWindowDimensions, View } from 'react-native';

import { colors, radius } from '../theme';
import type { MemberCard } from '../types';
import { Avatar, Sans, Serif } from './ui';

const GAP = 10;
const H_PAD = 20; // 화면 좌우 패딩과 맞춥니다

/**
 * Setlog 식 모자이크 — "같은 하루, 함께한 묵상".
 * 나눔한 사람은 크게(미리보기), 아직 안 한 사람은 작고 흐리게 2열로 쌓습니다.
 */
export function MosaicBoard({
  cards,
  myUserId,
  onOpen,
}: {
  cards: MemberCard[];
  myUserId: string;
  onOpen: (userId: string) => void;
}) {
  const { width } = useWindowDimensions();
  const colW = (width - H_PAD * 2 - GAP) / 2;

  // 나눔한 사람 먼저(올린 시간 순), 그다음 아직 안 한 사람
  const ordered = useMemo(() => {
    const done = cards.filter((c) => c.entry);
    const todo = cards.filter((c) => !c.entry);
    done.sort((a, b) => (a.entry!.created_at < b.entry!.created_at ? -1 : 1));
    return [...done, ...todo];
  }, [cards]);

  // 각 타일의 예상 높이로 2열에 그리디 배치 (짧은 열에 추가)
  const columns = useMemo(() => {
    const cols: { card: MemberCard; height: number }[][] = [[], []];
    const heights = [0, 0];
    for (const card of ordered) {
      const h = tileHeight(card, colW);
      const target = heights[0] <= heights[1] ? 0 : 1;
      cols[target].push({ card, height: h });
      heights[target] += h + GAP;
    }
    return cols;
  }, [ordered, colW]);

  return (
    <View style={{ flexDirection: 'row', gap: GAP }}>
      {columns.map((col, ci) => (
        <View key={ci} style={{ flex: 1, gap: GAP }}>
          {col.map(({ card, height }) => (
            <Tile
              key={card.userId}
              card={card}
              height={height}
              isMe={card.userId === myUserId}
              onPress={() => onOpen(card.userId)}
            />
          ))}
        </View>
      ))}
    </View>
  );
}

function tileHeight(card: MemberCard, colW: number): number {
  if (!card.entry) return 96;
  // 미리보기 글자 수로 대략적인 높이를 정해 자연스러운 높낮이를 만듭니다.
  const len = card.entry.reflection.length;
  const lines = Math.min(6, Math.max(2, Math.ceil((len * 12) / (colW - 28))));
  return 96 + lines * 20;
}

function Tile({
  card,
  height,
  isMe,
  onPress,
}: {
  card: MemberCard;
  height: number;
  isMe: boolean;
  onPress: () => void;
}) {
  const done = !!card.entry;
  const stampCount = card.entry?.stamps.length ?? 0;
  const commentCount = card.entry?.comments.length ?? 0;

  return (
    <Pressable
      onPress={onPress}
      style={{
        height,
        backgroundColor: done ? colors.card : colors.cardMuted,
        borderWidth: 1,
        borderColor: isMe ? colors.clay : done ? colors.lineWarm : colors.lineSoft,
        borderRadius: radius.xl,
        padding: 14,
        overflow: 'hidden',
      }}
    >
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
        <Avatar name={card.name} seed={card.userId} size={30} dim={!done} />
        <View style={{ flex: 1 }}>
          <Sans style={{ fontSize: 13, color: colors.ink700 }} numberOfLines={1}>
            {isMe ? '나' : card.name}
          </Sans>
          {card.role === 'leader' && (
            <Sans style={{ fontSize: 9, color: colors.clay }}>리더</Sans>
          )}
        </View>
      </View>

      {done ? (
        <>
          <Serif
            style={{
              flex: 1,
              fontSize: 13,
              lineHeight: 21,
              color: colors.ink600,
              marginTop: 10,
            }}
          >
            {card.entry!.reflection}
          </Serif>
          {(stampCount > 0 || commentCount > 0) && (
            <View style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
              {stampCount > 0 && (
                <Sans style={{ fontSize: 11, color: colors.label }}>위로 {stampCount}</Sans>
              )}
              {commentCount > 0 && (
                <Sans style={{ fontSize: 11, color: colors.muted3 }}>댓글 {commentCount}</Sans>
              )}
            </View>
          )}
        </>
      ) : (
        <View style={{ flex: 1, justifyContent: 'flex-end' }}>
          <Sans style={{ fontSize: 11, color: colors.muted5 }}>아직 나누지 않았어요</Sans>
        </View>
      )}
    </Pressable>
  );
}
