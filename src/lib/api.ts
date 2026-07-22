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

export async function generateDevotion(ref: string, verseText?: string | null) {
  const { data, error } = await supabase.functions.invoke<{
    devotion: string;
    verse_text?: string;
  }>('generate-devotion', { body: { ref, verse_text: verseText ?? null } });
  if (error) throw new Error(error.message);
  if (!data?.devotion) throw new Error('묵상 글을 받지 못했어요.');
  return data;
}

// ── 그룹 ──────────────────────────────────────────────────────

export async function fetchGroup(groupId: string): Promise<Group> {
  return unwrap(
    await supabase.from('groups').select('*').eq('id', groupId).single(),
  ) as unknown as Group;
}
