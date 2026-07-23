import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { EntryView, MemberCard, MemberWithProfile, Passage } from '../types';
import { fetchEntries, fetchMembers, fetchPassage, fetchQtDays, QtDay } from './api';
import { addDays, dateKey, streakFrom } from './date';
import { supabase } from './supabase';

/** useBoard 인스턴스마다 고유한 Realtime 채널 이름을 주기 위한 카운터 */
let boardChannelSeq = 0;

export type Board = {
  loading: boolean;
  error: string | null;
  passage: Passage | null;
  members: MemberWithProfile[];
  entries: EntryView[];
  cards: MemberCard[];
  myEntry: EntryView | null;
  doneCount: number;
  total: number;
  reload: () => Promise<void>;
};

/**
 * 오늘의 본문 + 멤버 + 나눔을 한 번에 읽고, Realtime 으로 갱신합니다.
 * 스트릭은 최근 60일 qt_days 에서 계산합니다.
 */
export function useBoard(groupId: string | null, userId: string | null, date: string): Board {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [passage, setPassage] = useState<Passage | null>(null);
  const [members, setMembers] = useState<MemberWithProfile[]>([]);
  const [entries, setEntries] = useState<EntryView[]>([]);
  const [days, setDays] = useState<QtDay[]>([]);

  const passageIdRef = useRef<string | null>(null);
  passageIdRef.current = passage?.id ?? null;

  // 홈과 관리 탭이 동시에 useBoard 를 쓰므로, 같은 topic 에 두 번 구독해
  // Realtime 이 충돌하지 않도록 훅 인스턴스마다 고유한 채널 이름을 씁니다.
  const channelIdRef = useRef<number>(0);
  if (channelIdRef.current === 0) channelIdRef.current = ++boardChannelSeq;

  const load = useCallback(async () => {
    if (!groupId) {
      setLoading(false);
      return;
    }
    setError(null);
    try {
      const since = dateKey(addDays(new Date(), -60));
      const [p, ms, ds] = await Promise.all([
        fetchPassage(groupId, date),
        fetchMembers(groupId),
        fetchQtDays(groupId, since),
      ]);
      setPassage(p);
      setMembers(ms);
      setDays(ds);
      setEntries(p ? await fetchEntries(p.id) : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [groupId, date]);

  useEffect(() => {
    setLoading(true);
    load();
  }, [load]);

  // Realtime — 누가 나눔을 올리거나 댓글·스탬프를 남기면 다시 읽습니다.
  useEffect(() => {
    if (!groupId) return;
    const channel = supabase
      .channel(`board:${groupId}:${channelIdRef.current}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'qt_entries' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'comments' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stamps' }, () => load())
      .on('postgres_changes', { event: '*', schema: 'public', table: 'passages' }, () => load())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [groupId, load]);

  const cards = useMemo<MemberCard[]>(() => {
    const byUser = new Map(entries.map((e) => [e.user_id, e]));
    const daysByUser = new Map<string, Set<string>>();
    for (const d of days) {
      if (!daysByUser.has(d.user_id)) daysByUser.set(d.user_id, new Set());
      daysByUser.get(d.user_id)!.add(d.date);
    }

    return members
      .map((m) => ({
        userId: m.user_id,
        name: m.profile.name || '이름없음',
        role: m.role,
        entry: byUser.get(m.user_id) ?? null,
        streak: streakFrom(daysByUser.get(m.user_id) ?? []),
      }))
      .sort((a, b) => {
        // 올린 사람 먼저, 그 안에서는 올린 시간 순
        if (!!a.entry !== !!b.entry) return a.entry ? -1 : 1;
        if (a.entry && b.entry) return a.entry.created_at.localeCompare(b.entry.created_at);
        return a.name.localeCompare(b.name);
      });
  }, [members, entries, days]);

  const myEntry = useMemo(
    () => (userId ? (entries.find((e) => e.user_id === userId) ?? null) : null),
    [entries, userId],
  );

  return {
    loading,
    error,
    passage,
    members,
    entries,
    cards,
    myEntry,
    doneCount: entries.length,
    total: members.length,
    reload: load,
  };
}
