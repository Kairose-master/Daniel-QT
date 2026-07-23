/**
 * DB 타입. supabase/migrations/0001_init.sql 과 짝을 이룹니다.
 * 스키마를 바꾸면 여기도 같이 고치세요.
 * (또는 `npx supabase gen types typescript --project-id <id> > src/types.ts` 로 재생성)
 */

export type StampKind = 'pray' | 'together' | 'cheer' | 'grace';
export type MemberRole = 'leader' | 'member';

export type Profile = {
  id: string;
  name: string;
  avatar_url: string | null;
  created_at: string;
};

export type Group = {
  id: string;
  name: string;
  invite_code: string;
  leader_id: string;
  created_at: string;
};

export type GroupMember = {
  group_id: string;
  user_id: string;
  role: MemberRole;
  joined_at: string;
};

export type Passage = {
  id: string;
  group_id: string;
  /** YYYY-MM-DD */
  date: string;
  ref: string;
  verse_text: string | null;
  link_url: string | null;
  devotion: string | null;
  ai_generated: boolean;
  created_by: string | null;
  created_at: string;
};

export type QtEntry = {
  id: string;
  passage_id: string;
  user_id: string;
  reflection: string;
  prayer: string | null;
  created_at: string;
  updated_at: string;
};

export type Comment = {
  id: string;
  qt_entry_id: string;
  user_id: string;
  text: string;
  created_at: string;
};

export type Stamp = {
  qt_entry_id: string;
  user_id: string;
  kind: StampKind;
  created_at: string;
};

export type VoiceMessage = {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  storage_path: string;
  duration: number;
  heard: boolean;
  /** 녹음 중 수집한 진폭 샘플 (0~100). null 이면 데코용 막대로 표시 */
  waveform: number[] | null;
  created_at: string;
};

export type PushToken = {
  user_id: string;
  token: string;
  platform: string | null;
  updated_at: string;
};

export type GroupSecret = {
  group_id: string;
  anthropic_api_key: string | null;
  updated_at: string;
};

type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type Database = {
  public: {
    Tables: {
      profiles: Table<Profile, 'id'>;
      groups: Table<Group, 'name' | 'invite_code' | 'leader_id'>;
      group_members: Table<GroupMember, 'group_id' | 'user_id'>;
      passages: Table<Passage, 'group_id' | 'date' | 'ref'>;
      qt_entries: Table<QtEntry, 'passage_id' | 'user_id' | 'reflection'>;
      comments: Table<Comment, 'qt_entry_id' | 'user_id' | 'text'>;
      stamps: Table<Stamp, 'qt_entry_id' | 'user_id' | 'kind'>;
      voice_messages: Table<
        VoiceMessage,
        'group_id' | 'from_user_id' | 'to_user_id' | 'storage_path'
      >;
      push_tokens: Table<PushToken, 'user_id' | 'token'>;
      group_secrets: Table<GroupSecret, 'group_id'>;
    };
    Views: {
      qt_days: {
        Row: { group_id: string; user_id: string; date: string; qt_entry_id: string };
        Relationships: [];
      };
    };
    Functions: {
      create_group: { Args: { group_name: string }; Returns: Group };
      join_group_by_code: { Args: { code: string }; Returns: Group };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

// ── 화면에서 쓰는 조합 타입 ────────────────────────────────────

export type MemberWithProfile = GroupMember & { profile: Profile };

export type EntryView = QtEntry & {
  profile: Profile;
  comments: (Comment & { profile: Profile })[];
  stamps: Stamp[];
};

/** 묵상 홈의 멤버 카드 한 장 */
export type MemberCard = {
  userId: string;
  name: string;
  role: MemberRole;
  entry: EntryView | null;
  streak: number;
};
