import { useRouter } from 'expo-router';
import React, { useCallback, useEffect, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Avatar, Empty, Loading, Sans, Serif, TagLabel } from '../src/components/ui';
import { fetchEntries, fetchRecentPassages, PassageSummary } from '../src/lib/api';
import { formatKoreanDate } from '../src/lib/date';
import { useSession } from '../src/lib/session';
import { colors, radius } from '../src/theme';
import type { EntryView } from '../src/types';

export default function Archive() {
  const router = useRouter();
  const { activeGroup } = useSession();
  const [loading, setLoading] = useState(true);
  const [passages, setPassages] = useState<PassageSummary[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!activeGroup) return;
    setPassages(await fetchRecentPassages(activeGroup.id));
    setLoading(false);
  }, [activeGroup]);

  useEffect(() => {
    load();
  }, [load]);

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
        <Serif style={{ fontSize: 19, color: colors.ink800 }}>지난 묵상</Serif>
        <Pressable onPress={() => router.back()} hitSlop={10}>
          <Sans style={{ fontSize: 20, color: colors.muted5 }}>×</Sans>
        </Pressable>
      </View>

      {loading ? (
        <Loading />
      ) : passages.length === 0 ? (
        <Empty title="아직 지난 묵상이 없어요" hint="본문이 쌓이면 여기서 돌아볼 수 있어요" />
      ) : (
        <ScrollView contentContainerStyle={{ padding: 20, paddingBottom: 40 }}>
          {passages.map((p) => (
            <PassageRow
              key={p.id}
              passage={p}
              open={openId === p.id}
              onToggle={() => setOpenId((cur) => (cur === p.id ? null : p.id))}
            />
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

function PassageRow({
  passage,
  open,
  onToggle,
}: {
  passage: PassageSummary;
  open: boolean;
  onToggle: () => void;
}) {
  const [entries, setEntries] = useState<EntryView[] | null>(null);

  useEffect(() => {
    if (open && entries === null) {
      fetchEntries(passage.id)
        .then(setEntries)
        .catch(() => setEntries([]));
    }
  }, [open, entries, passage.id]);

  return (
    <View
      style={{
        backgroundColor: colors.card,
        borderWidth: 1,
        borderColor: colors.lineWarm,
        borderRadius: radius.lg,
        padding: 16,
        marginBottom: 10,
      }}
    >
      <Pressable onPress={onToggle}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <Sans style={{ fontSize: 11, letterSpacing: 1, color: colors.label }}>
            {formatKoreanDate(passage.date)}
          </Sans>
          <Sans style={{ fontSize: 11, color: colors.sageLight }}>
            {passage.entryCount}명 나눔
          </Sans>
        </View>
        <Serif style={{ fontSize: 18, color: colors.ink900, marginTop: 6 }}>
          {passage.ref}
        </Serif>
        {passage.devotion ? (
          <Serif
            numberOfLines={open ? undefined : 2}
            style={{ fontSize: 13, lineHeight: 22, color: colors.ink500, marginTop: 6 }}
          >
            {passage.devotion}
          </Serif>
        ) : null}
      </Pressable>

      {open && (
        <View style={{ marginTop: 14, borderTopWidth: 1, borderTopColor: colors.lineSoft, paddingTop: 12 }}>
          {passage.verse_text ? (
            <Serif style={{ fontSize: 14, lineHeight: 26, color: colors.ink500, marginBottom: 14 }}>
              {passage.verse_text}
            </Serif>
          ) : null}

          {entries === null ? (
            <Sans style={{ fontSize: 12, color: colors.muted4 }}>불러오는 중…</Sans>
          ) : entries.length === 0 ? (
            <Sans style={{ fontSize: 12, color: colors.muted4 }}>이 날은 나눔이 없었어요</Sans>
          ) : (
            entries.map((e) => (
              <View key={e.id} style={{ flexDirection: 'row', gap: 10, marginBottom: 14 }}>
                <Avatar name={e.profile?.name ?? '?'} seed={e.user_id} size={30} />
                <View style={{ flex: 1 }}>
                  <Sans style={{ fontSize: 13, color: colors.ink700, marginBottom: 3 }}>
                    {e.profile?.name ?? '이름없음'}
                  </Sans>
                  <Serif style={{ fontSize: 13, lineHeight: 22, color: colors.ink600 }}>
                    {e.reflection}
                  </Serif>
                  {e.prayer ? (
                    <View
                      style={{
                        backgroundColor: colors.tint,
                        borderRadius: 10,
                        padding: 9,
                        marginTop: 6,
                      }}
                    >
                      <TagLabel>기도제목</TagLabel>
                      <Sans style={{ fontSize: 12, lineHeight: 20, color: colors.ink500, marginTop: 3 }}>
                        {e.prayer}
                      </Sans>
                    </View>
                  ) : null}
                </View>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}
