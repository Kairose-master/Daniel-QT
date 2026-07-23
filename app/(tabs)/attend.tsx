import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshControl, ScrollView, View } from 'react-native';

import { FruitMark } from '../../src/components/FruitMark';
import { Avatar, Empty, Loading, Sans, Serif } from '../../src/components/ui';
import {
  fetchFruitTotals,
  fetchMembers,
  fetchPassagesInRange,
  fetchQtDays,
  QtDay,
} from '../../src/lib/api';
import {
  addDays,
  currentWeekKeys,
  dateKey,
  streakFrom,
  weekdayLabels,
  weekRangeLabel,
} from '../../src/lib/date';
import { useSession } from '../../src/lib/session';
import { colors, radius } from '../../src/theme';
import type { MemberWithProfile } from '../../src/types';

export default function AttendScreen() {
  const { activeGroup, userId } = useSession();
  const groupId = activeGroup?.id ?? null;

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [days, setDays] = useState<QtDay[]>([]);
  const [passageDates, setPassageDates] = useState<string[]>([]);
  const [fruit, setFruit] = useState<Map<string, number>>(new Map());

  const week = useMemo(() => currentWeekKeys(), []);

  const load = useCallback(async () => {
    if (!groupId) return;
    const since = dateKey(addDays(new Date(), -90));
    const [ms, ds, ps] = await Promise.all([
      fetchMembers(groupId),
      fetchQtDays(groupId, since),
      fetchPassagesInRange(groupId, week[0], week[6]),
    ]);
    setMembers(ms);
    setDays(ds);
    setPassageDates(ps.map((p) => p.date));
    setFruit(await fetchFruitTotals(ms.map((m) => m.user_id)));
    setLoading(false);
  }, [groupId, week]);

  useEffect(() => {
    load();
  }, [load]);

  const daysByUser = useMemo(() => {
    const map = new Map<string, Set<string>>();
    for (const d of days) {
      if (!map.has(d.user_id)) map.set(d.user_id, new Set());
      map.get(d.user_id)!.add(d.date);
    }
    return map;
  }, [days]);

  // 본문이 올라온 날만 분모로 셉니다.
  const activeDays = week.filter((d) => passageDates.includes(d));
  const possible = activeDays.length * members.length;
  const actual = days.filter((d) => activeDays.includes(d.date)).length;
  const groupRate = possible === 0 ? 0 : Math.round((actual / possible) * 100);

  const topStreak = members.reduce(
    (max, m) => Math.max(max, streakFrom(daysByUser.get(m.user_id) ?? [])),
    0,
  );

  const myFruit = (userId && fruit.get(userId)) || 0;

  if (loading) return <Loading />;

  return (
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
      <Serif style={{ fontSize: 19, color: colors.ink800 }}>이번 주 출석</Serif>
      <Sans style={{ fontSize: 12, color: colors.muted3, marginTop: 4 }}>
        {weekRangeLabel(week)} · 소그룹 전체 참여율 {groupRate}%
      </Sans>

      <View style={{ flexDirection: 'row', gap: 10, marginTop: 18, marginBottom: 12 }}>
        <Stat value={`${groupRate}%`} label="주간 평균 참여율" color={colors.clay} />
        <Stat value={`${topStreak}일`} label="최장 연속 묵상" color={colors.sage} />
      </View>

      {/* 묵상 열매 — 잔잔한 크레딧 */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 10,
          backgroundColor: colors.tint,
          borderWidth: 1,
          borderColor: colors.lineWarm,
          borderRadius: 16,
          padding: 14,
          marginBottom: 22,
        }}
      >
        <FruitMark size={22} />
        <View style={{ flex: 1 }}>
          <Sans style={{ fontSize: 11, color: colors.muted3 }}>내가 모은 묵상 열매</Sans>
          <Sans style={{ fontSize: 12, color: colors.muted4, marginTop: 1 }}>
            하루하루의 묵상이 열매로 맺혀요
          </Sans>
        </View>
        <Serif style={{ fontSize: 22, color: colors.gold }}>{myFruit}</Serif>
      </View>

      {members.length === 0 ? (
        <Empty title="소그룹에 아직 멤버가 없어요" />
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-end',
              gap: 9,
              paddingBottom: 8,
              paddingHorizontal: 2,
            }}
          >
            {weekdayLabels.map((d) => (
              <Sans
                key={d}
                style={{ width: 22, textAlign: 'center', fontSize: 10, color: colors.muted4 }}
              >
                {d}
              </Sans>
            ))}
            <View style={{ width: 34 }} />
          </View>

          {members.map((m) => {
            const set = daysByUser.get(m.user_id) ?? new Set<string>();
            const marks = week.map((d) => set.has(d));
            return (
              <View
                key={m.user_id}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  paddingVertical: 9,
                  borderTopWidth: 1,
                  borderTopColor: colors.lineSoft,
                }}
              >
                <Avatar name={m.profile.name} seed={m.user_id} size={30} />
                <View style={{ width: 54 }}>
                  <Sans style={{ fontSize: 13, color: colors.ink600 }} numberOfLines={1}>
                    {m.profile.name}
                  </Sans>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 3, marginTop: 1 }}>
                    <FruitMark size={11} />
                    <Sans style={{ fontSize: 10, color: colors.muted3 }}>
                      {fruit.get(m.user_id) ?? 0}
                    </Sans>
                  </View>
                </View>
                <View
                  style={{ flex: 1, flexDirection: 'row', justifyContent: 'flex-end', gap: 9 }}
                >
                  {marks.map((on, i) => (
                    <View
                      key={week[i]}
                      style={{
                        width: 22,
                        height: 22,
                        borderRadius: 7,
                        backgroundColor: on ? colors.sage : colors.empty,
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      {on && <Sans style={{ fontSize: 11, color: colors.white }}>·</Sans>}
                    </View>
                  ))}
                </View>
                <Sans
                  style={{ width: 34, textAlign: 'right', fontSize: 12, color: colors.muted2 }}
                >
                  {marks.filter(Boolean).length}/7
                </Sans>
              </View>
            );
          })}
        </>
      )}
    </ScrollView>
  );
}

function Stat({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <View
      style={{
        flex: 1,
        backgroundColor: '#fffdf8',
        borderWidth: 1,
        borderColor: colors.lineWarm,
        borderRadius: 16,
        padding: 14,
      }}
    >
      <Serif style={{ fontSize: 26, color }}>{value}</Serif>
      <Sans style={{ fontSize: 11, color: colors.muted3, marginTop: 2 }}>{label}</Sans>
    </View>
  );
}
