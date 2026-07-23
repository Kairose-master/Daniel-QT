import { randomUUID } from 'expo-crypto';
import { File } from 'expo-file-system';

import type {
  EntryView,
  Group,
  MemberWithProfile,
  Passage,
  Profile,
  StampKind,
  VoiceMessage,
} from '../types';
import { supabase } from './supabase';

function unwrap<T>(res: { data: T | null; error: { message: string } | null }): T {
  if (res.error) throw new Error(res.error.message);
  return res.data as T;
}

// ── 멤버 ──────────────────────────────────────────────────────

export async function fetchMembers(groupId: string): Promise<MemberWithProfile[]> {
  const rows = unwrap(
    await supabase
      .from('group_members')
      .select('*, profile:profiles(*)')
      .eq('group_id', groupId)
      .order('joined_at', { ascending: true }),
  ) as unknown as MemberWithProfile[];
  // 리더를 맨 앞으로
  return rows
    .filter((r) => r.profile)
    .sort((a, b) => (a.role === b.role ? 0 : a.role === 'leader' ? -1 : 1));
}

// ── 본문 ──────────────────────────────────────────────────────

export async function fetchPassage(groupId: string, date: string): Promise<Passage | null> {
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .eq('group_id', groupId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Passage) ?? null;
}

/** 가장 최근에 등록된 본문 (오늘 것이 없을 때 홈에서 보여줍니다) */
export async function fetchLatestPassage(groupId: string): Promise<Passage | null> {
  const { data, error } = await supabase
    .from('passages')
    .select('*')
    .eq('group_id', groupId)
    .order('date', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return (data as Passage) ?? null;
}

/** 아카이브용 — 최근 본문 목록 + 각 본문의 나눔 수 */
export type PassageSummary = Passage & { entryCount: number };

export async function fetchRecentPassages(
  groupId: string,
  limit = 60,
): Promise<PassageSummary[]> {
  const rows = (unwrap(
    await supabase
      .from('passages')
      .select('*, qt_entries(count)')
      .eq('group_id', groupId)
      .order('date', { ascending: false })
      .limit(limit),
  ) ?? []) as unknown as (Passage & { qt_entries: { count: number }[] })[];

  return rows.map((r) => {
    const { qt_entries, ...passage } = r;
    return { ...passage, entryCount: qt_entries?.[0]?.count ?? 0 };
  });
}

export async function fetchPassagesInRange(
  groupId: string,
  from: string,
  to: string,
): Promise<Passage[]> {
  return (unwrap(
    await supabase
      .from('passages')
      .select('*')
      .eq('group_id', groupId)
      .gte('date', from)
      .lte('date', to)
      .order('date', { ascending: true }),
  ) ?? []) as unknown as Passage[];
}

export async function savePassage(input: {
  groupId: string;
  date: string;
  ref: string;
  verseText: string | null;
  linkUrl: string | null;
  devotion: string | null;
  aiGenerated: boolean;
  userId: string;
}): Promise<Passage> {
  return unwrap(
    await supabase
      .from('passages')
      .upsert(
        {
          group_id: input.groupId,
          date: input.date,
          ref: input.ref.trim(),
          verse_text: input.verseText?.trim() || null,
          link_url: input.linkUrl?.trim() || null,
          devotion: input.devotion?.trim() || null,
          ai_generated: input.aiGenerated,
          created_by: input.userId,
        },
        { onConflict: 'group_id,date' },
      )
      .select()
      .single(),
  ) as unknown as Passage;
}

// ── QT 나눔 ───────────────────────────────────────────────────

const ENTRY_SELECT =
  '*, profile:profiles(*), comments(*, profile:profiles(*)), stamps(*)';

export async function fetchEntries(passageId: string): Promise<EntryView[]> {
  const rows = unwrap(
    await supabase
      .from('qt_entries')
      .select(ENTRY_SELECT)
      .eq('passage_id', passageId)
      .order('created_at', { ascending: true }),
  ) as unknown as EntryView[];

  return rows.map((e) => ({
    ...e,
    comments: [...(e.comments ?? [])].sort((a, b) =>
      a.created_at.localeCompare(b.created_at),
    ),
    stamps: e.stamps ?? [],
  }));
}

export async function saveMyEntry(input: {
  passageId: string;
  userId: string;
  reflection: string;
  prayer: string;
}): Promise<void> {
  const { error } = await supabase.from('qt_entries').upsert(
    {
      passage_id: input.passageId,
      user_id: input.userId,
      reflection: input.reflection.trim(),
      prayer: input.prayer.trim() || null,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'passage_id,user_id' },
  );
  if (error) throw new Error(error.message);
}

export async function addComment(
  qtEntryId: string,
  userId: string,
  text: string,
): Promise<void> {
  const { error } = await supabase
    .from('comments')
    .insert({ qt_entry_id: qtEntryId, user_id: userId, text: text.trim() });
  if (error) throw new Error(error.message);
}

export async function deleteComment(id: string): Promise<void> {
  const { error } = await supabase.from('comments').delete().eq('id', id);
  if (error) throw new Error(error.message);
}

/** 1인 1개 — 같은 걸 다시 누르면 해제, 다른 걸 누르면 교체 */
export async function setStamp(
  qtEntryId: string,
  userId: string,
  kind: StampKind | null,
): Promise<void> {
  if (kind === null) {
    const { error } = await supabase
      .from('stamps')
      .delete()
      .eq('qt_entry_id', qtEntryId)
      .eq('user_id', userId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase
    .from('stamps')
    .upsert({ qt_entry_id: qtEntryId, user_id: userId, kind }, { onConflict: 'qt_entry_id,user_id' });
  if (error) throw new Error(error.message);
}

// ── 출석 집계 ─────────────────────────────────────────────────

export type QtDay = { user_id: string; date: string };

export async function fetchQtDays(groupId: string, since: string): Promise<QtDay[]> {
  const rows = unwrap(
    await supabase
      .from('qt_days')
      .select('user_id, date')
      .eq('group_id', groupId)
      .gte('date', since),
  ) as unknown as QtDay[];
  return rows ?? [];
}

// ── 응원 음성 ─────────────────────────────────────────────────

export type VoiceView = VoiceMessage & { from: Profile; to: Profile };

export async function fetchVoiceMessages(groupId: string): Promise<VoiceView[]> {
  const rows = unwrap(
    await supabase
      .from('voice_messages')
      .select('*, from:profiles!voice_messages_from_user_id_fkey(*), to:profiles!voice_messages_to_user_id_fkey(*)')
      .eq('group_id', groupId)
      .order('created_at', { ascending: false })
      .limit(100),
  ) as unknown as VoiceView[];
  return rows ?? [];
}

/** 로컬 녹음 파일을 Storage 에 올리고 voice_messages 행을 만듭니다. */
export async function sendVoiceMessage(input: {
  groupId: string;
  fromUserId: string;
  toUserId: string;
  localUri: string;
  duration: number;
  waveform?: number[];
}): Promise<void> {
  const ext = input.localUri.split('.').pop()?.split('?')[0] || 'm4a';
  const path = `${input.groupId}/${randomUUID()}.${ext}`;

  const bytes = await new File(input.localUri).arrayBuffer();
  const contentType = ext === 'webm' ? 'audio/webm' : 'audio/m4a';

  const { error: upErr } = await supabase.storage
    .from('voice')
    .upload(path, bytes, { contentType, upsert: false });
  if (upErr) throw new Error(upErr.message);

  const { error } = await supabase.from('voice_messages').insert({
    group_id: input.groupId,
    from_user_id: input.fromUserId,
    to_user_id: input.toUserId,
    storage_path: path,
    duration: Math.round(input.duration),
    waveform: input.waveform && input.waveform.length > 0 ? input.waveform : null,
  });
  if (error) {
    // 행 생성에 실패하면 고아 파일을 남기지 않습니다.
    await supabase.storage.from('voice').remove([path]);
    throw new Error(error.message);
  }
}

/** 비공개 버킷이므로 만료되는 서명 URL 로만 재생합니다. */
export async function signedVoiceUrl(path: string, expiresIn = 3600): Promise<string> {
  const { data, error } = await supabase.storage.from('voice').createSignedUrl(path, expiresIn);
  if (error) throw new Error(error.message);
  return data.signedUrl;
}

export async function markVoiceHeard(id: string): Promise<void> {
  const { error } = await supabase.from('voice_messages').update({ heard: true }).eq('id', id);
  if (error) throw new Error(error.message);
}

export async function deleteVoiceMessage(msg: VoiceMessage): Promise<void> {
  const { error } = await supabase.from('voice_messages').delete().eq('id', msg.id);
  if (error) throw new Error(error.message);
  await supabase.storage.from('voice').remove([msg.storage_path]);
}

// ── AI 본문 ───────────────────────────────────────────────────

/** 본문 범위(ref)를 읽어 개역개정 구절만 불러옵니다. */
export async function fetchVerseText(groupId: string, ref: string): Promise<string> {
  const { data, error } = await supabase.functions.invoke<{ verse_text?: string }>(
    'generate-devotion',
    { body: { group_id: groupId, ref, verse_only: true } },
  );
  if (error) throw new Error(await extractFunctionError(error));
  if (!data?.verse_text) throw new Error('구절을 불러오지 못했어요.');
  return data.verse_text;
}

export async function generateDevotion(
  groupId: string,
  ref: string,
  verseText?: string | null,
) {
  const { data, error } = await supabase.functions.invoke<{
    devotion: string;
    verse_text?: string;
  }>('generate-devotion', {
    body: { group_id: groupId, ref, verse_text: verseText ?? null },
  });
  if (error) throw new Error(await extractFunctionError(error));
  if (!data?.devotion) throw new Error('묵상 글을 받지 못했어요.');
  return data;
}

/**
 * supabase.functions.invoke 는 non-2xx 를 "Edge function returned a non-2xx
 * status code" 로 뭉개버립니다. 함수가 응답 본문에 담은 진짜 이유(error)를 꺼냅니다.
 */
async function extractFunctionError(error: unknown): Promise<string> {
  const ctx = (error as { context?: unknown })?.context;
  // FunctionsHttpError 는 context 에 원본 Response 를 담고 있습니다.
  if (ctx && typeof (ctx as Response).json === 'function') {
    try {
      const body = await (ctx as Response).clone().json();
      if (body?.error) return body.detail ? `${body.error}\n(${body.detail})` : body.error;
    } catch {
      try {
        const text = await (ctx as Response).text();
        if (text) return text;
      } catch {}
    }
  }
  return error instanceof Error ? error.message : String(error);
}

// ── 소그룹 AI 키 (리더 전용) ──────────────────────────────────

/** 키가 등록되어 있는지만 확인 (실제 키 값은 가져오지 않습니다) */
export async function fetchApiKeyStatus(groupId: string): Promise<boolean> {
  const { data, error } = await supabase
    .from('group_secrets')
    .select('updated_at')
    .eq('group_id', groupId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

export async function saveGroupApiKey(groupId: string, key: string): Promise<void> {
  const { error } = await supabase.from('group_secrets').upsert(
    { group_id: groupId, anthropic_api_key: key.trim(), updated_at: new Date().toISOString() },
    { onConflict: 'group_id' },
  );
  if (error) throw new Error(error.message);
}

export async function clearGroupApiKey(groupId: string): Promise<void> {
  const { error } = await supabase.from('group_secrets').delete().eq('group_id', groupId);
  if (error) throw new Error(error.message);
}

// ── 출석 ──────────────────────────────────────────────────────

export type AttendDay = { user_id: string; date: string };

export async function fetchAttendance(groupId: string, since: string): Promise<AttendDay[]> {
  const rows = (unwrap(
    await supabase
      .from('attendance')
      .select('user_id, date')
      .eq('group_id', groupId)
      .gte('date', since),
  ) ?? []) as unknown as AttendDay[];
  return rows;
}

/** 오늘 출석했는지 (QT 작성 포함) */
export async function hasCheckedIn(
  groupId: string,
  userId: string,
  date: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('attendance')
    .select('date')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .eq('date', date)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return !!data;
}

/** 오늘 출석 체크 (QT 를 안 써도 참여로 기록) */
export async function checkIn(groupId: string, date: string): Promise<void> {
  const { error } = await supabase.rpc('check_in', { gid: groupId, d: date });
  if (error) throw new Error(error.message);
}

// ── 묵상 열매 ─────────────────────────────────────────────────

export async function fetchMyFruit(userId: string): Promise<number> {
  const { data, error } = await supabase
    .from('fruit_totals')
    .select('total')
    .eq('user_id', userId)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data?.total ?? 0;
}

/** 소그룹 멤버들의 열매 합계 (userId → total) */
export async function fetchFruitTotals(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const rows = (unwrap(
    await supabase.from('fruit_totals').select('user_id, total').in('user_id', userIds),
  ) ?? []) as unknown as { user_id: string; total: number }[];
  return new Map(rows.map((r) => [r.user_id, r.total]));
}

// ── 그룹 ──────────────────────────────────────────────────────

export async function fetchGroup(groupId: string): Promise<Group> {
  return unwrap(
    await supabase.from('groups').select('*').eq('id', groupId).single(),
  ) as unknown as Group;
}

/** 소그룹에서 나가기 (RLS: 본인 멤버십만 삭제 가능) */
export async function leaveGroup(groupId: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', userId);
  if (error) throw new Error(error.message);
}

/** 계정 삭제 (Edge Function delete-account 이 실제 처리) */
export async function deleteAccount(): Promise<void> {
  const { error } = await supabase.functions.invoke('delete-account');
  if (error) throw new Error(error.message);
}
