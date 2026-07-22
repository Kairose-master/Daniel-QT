-- 다니엘과 세친구 — 초기 스키마
-- Supabase SQL Editor에 그대로 붙여넣어 실행하세요.

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────
-- 테이블
-- ─────────────────────────────────────────────────────────────

-- auth.users 와 1:1. 가입 시 트리거로 자동 생성됩니다.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  name        text not null default '',
  avatar_url  text,
  created_at  timestamptz not null default now()
);

create table if not exists public.groups (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  invite_code text not null unique,
  leader_id   uuid not null references public.profiles(id) on delete restrict,
  created_at  timestamptz not null default now()
);

create table if not exists public.group_members (
  group_id  uuid not null references public.groups(id) on delete cascade,
  user_id   uuid not null references public.profiles(id) on delete cascade,
  role      text not null default 'member' check (role in ('leader', 'member')),
  joined_at timestamptz not null default now(),
  primary key (group_id, user_id)
);
create index if not exists group_members_user_idx on public.group_members(user_id);

-- 리더가 등록하는 일자별 본문. 소그룹당 하루 하나.
create table if not exists public.passages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  date         date not null,
  ref          text not null,
  verse_text   text,
  link_url     text,
  devotion     text,
  ai_generated boolean not null default false,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  unique (group_id, date)
);
create index if not exists passages_group_date_idx on public.passages(group_id, date desc);

-- 멤버별 QT 나눔. 출석·참여율·스트릭의 원천.
create table if not exists public.qt_entries (
  id         uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.passages(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  reflection text not null,
  prayer     text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (passage_id, user_id)
);
create index if not exists qt_entries_passage_idx on public.qt_entries(passage_id);
create index if not exists qt_entries_user_idx on public.qt_entries(user_id);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  qt_entry_id uuid not null references public.qt_entries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);
create index if not exists comments_entry_idx on public.comments(qt_entry_id, created_at);

-- 위로 스탬프. 1인 1개(종류 변경은 update).
create table if not exists public.stamps (
  qt_entry_id uuid not null references public.qt_entries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('pray', 'together', 'cheer', 'grace')),
  created_at  timestamptz not null default now(),
  primary key (qt_entry_id, user_id)
);

create table if not exists public.voice_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id   uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  duration     int not null default 0, -- 초
  heard        boolean not null default false,
  created_at   timestamptz not null default now()
);
create index if not exists voice_group_idx on public.voice_messages(group_id, created_at desc);

-- 푸시 토큰
create table if not exists public.push_tokens (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);

-- ─────────────────────────────────────────────────────────────
-- 가입 시 프로필 자동 생성
-- ─────────────────────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      new.raw_user_meta_data ->> 'name',
      new.raw_user_meta_data ->> 'nickname',
      new.raw_user_meta_data ->> 'full_name',
      split_part(coalesce(new.email, ''), '@', 1),
      '이름없음'
    ),
    coalesce(new.raw_user_meta_data ->> 'avatar_url', new.raw_user_meta_data ->> 'picture')
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ─────────────────────────────────────────────────────────────
-- 헬퍼 (RLS 재귀를 피하려면 security definer 가 필요합니다)
-- ─────────────────────────────────────────────────────────────
create or replace function public.is_group_member(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_leader(gid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'leader'
  );
$$;

-- Storage 경로(첫 폴더)가 내가 속한 소그룹인가.
-- uuid 가 아닌 경로에서 캐스팅 에러가 나지 않도록 텍스트로 비교합니다.
create or replace function public.is_group_member_path(folder text)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.group_members
    where user_id = auth.uid() and group_id::text = folder
  );
$$;

-- 나와 같은 소그룹에 속한 사람인가
create or replace function public.shares_group_with(uid uuid)
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

create or replace function public.entry_group_id(eid uuid)
returns uuid language sql security definer stable set search_path = public as $$
  select p.group_id
  from public.qt_entries q
  join public.passages p on p.id = q.passage_id
  where q.id = eid;
$$;

-- ─────────────────────────────────────────────────────────────
-- 소그룹 생성 / 참여 RPC
-- (가입 전에는 groups 를 읽을 수 없으므로 RPC로 처리)
-- ─────────────────────────────────────────────────────────────
create or replace function public.generate_invite_code()
returns text language plpgsql volatile set search_path = public as $$
declare
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 헷갈리는 I,L,O,0,1 제외
  code text;
  i int;
begin
  loop
    code := '';
    for i in 1..6 loop
      code := code || substr(alphabet, floor(random() * length(alphabet))::int + 1, 1);
    end loop;
    exit when not exists (select 1 from public.groups g where g.invite_code = code);
  end loop;
  return code;
end $$;

create or replace function public.create_group(group_name text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  if coalesce(trim(group_name), '') = '' then
    raise exception '소그룹 이름을 입력해주세요';
  end if;

  insert into public.groups (name, invite_code, leader_id)
  values (trim(group_name), public.generate_invite_code(), auth.uid())
  returning * into g;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'leader');

  return g;
end $$;

create or replace function public.join_group_by_code(code text)
returns public.groups language plpgsql security definer set search_path = public as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into g from public.groups
  where invite_code = upper(trim(code));

  if g.id is null then
    raise exception '초대코드를 찾을 수 없어요';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end $$;

-- ─────────────────────────────────────────────────────────────
-- 출석 집계용 뷰 — 내가 속한 소그룹의 (그룹, 유저, 날짜) 참여 기록
-- ─────────────────────────────────────────────────────────────
create or replace view public.qt_days
with (security_invoker = true) as
  select p.group_id, q.user_id, p.date, q.id as qt_entry_id
  from public.qt_entries q
  join public.passages p on p.id = q.passage_id;

-- ─────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────
alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.passages       enable row level security;
alter table public.qt_entries     enable row level security;
alter table public.comments       enable row level security;
alter table public.stamps         enable row level security;
alter table public.voice_messages enable row level security;
alter table public.push_tokens    enable row level security;

-- profiles: 나 자신 + 같은 소그룹 사람만
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles for select
  using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update
  using (id = auth.uid()) with check (id = auth.uid());

-- groups: 멤버만 조회. 생성/참여는 RPC로만.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups for select
  using (public.is_group_member(id));

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups for update
  using (public.is_group_leader(id)) with check (public.is_group_leader(id));

-- group_members: 같은 소그룹 멤버 목록 조회. 본인 탈퇴만 허용.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members for select
  using (public.is_group_member(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members for delete
  using (user_id = auth.uid() or public.is_group_leader(group_id));

-- passages: 멤버 조회, 리더만 등록/수정/삭제
drop policy if exists passages_select on public.passages;
create policy passages_select on public.passages for select
  using (public.is_group_member(group_id));

drop policy if exists passages_write on public.passages;
create policy passages_write on public.passages for insert
  with check (public.is_group_leader(group_id) and created_by = auth.uid());

drop policy if exists passages_update on public.passages;
create policy passages_update on public.passages for update
  using (public.is_group_leader(group_id)) with check (public.is_group_leader(group_id));

drop policy if exists passages_delete on public.passages;
create policy passages_delete on public.passages for delete
  using (public.is_group_leader(group_id));

-- qt_entries: 같은 소그룹 조회, 본인 것만 작성/수정/삭제
drop policy if exists qt_select on public.qt_entries;
create policy qt_select on public.qt_entries for select
  using (public.is_group_member((select group_id from public.passages where id = passage_id)));

drop policy if exists qt_insert on public.qt_entries;
create policy qt_insert on public.qt_entries for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member((select group_id from public.passages where id = passage_id))
  );

drop policy if exists qt_update on public.qt_entries;
create policy qt_update on public.qt_entries for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists qt_delete on public.qt_entries;
create policy qt_delete on public.qt_entries for delete
  using (user_id = auth.uid());

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments for select
  using (public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments for insert
  with check (user_id = auth.uid() and public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments for delete
  using (user_id = auth.uid());

-- stamps
drop policy if exists stamps_select on public.stamps;
create policy stamps_select on public.stamps for select
  using (public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists stamps_insert on public.stamps;
create policy stamps_insert on public.stamps for insert
  with check (user_id = auth.uid() and public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists stamps_update on public.stamps;
create policy stamps_update on public.stamps for update
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists stamps_delete on public.stamps;
create policy stamps_delete on public.stamps for delete
  using (user_id = auth.uid());

-- voice_messages: 같은 소그룹이면 조회(응원함은 소그룹 전체가 함께 봄), 보낸 사람만 삭제
drop policy if exists voice_select on public.voice_messages;
create policy voice_select on public.voice_messages for select
  using (public.is_group_member(group_id));

drop policy if exists voice_insert on public.voice_messages;
create policy voice_insert on public.voice_messages for insert
  with check (from_user_id = auth.uid() and public.is_group_member(group_id));

-- 받는 사람이 heard 를 갱신할 수 있어야 합니다
drop policy if exists voice_update on public.voice_messages;
create policy voice_update on public.voice_messages for update
  using (to_user_id = auth.uid() or from_user_id = auth.uid())
  with check (to_user_id = auth.uid() or from_user_id = auth.uid());

drop policy if exists voice_delete on public.voice_messages;
create policy voice_delete on public.voice_messages for delete
  using (from_user_id = auth.uid());

-- push_tokens: 본인 것만
drop policy if exists push_all on public.push_tokens;
create policy push_all on public.push_tokens for all
  using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ─────────────────────────────────────────────────────────────
-- Storage — 응원 음성 (비공개 버킷)
-- ─────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('voice', 'voice', false)
on conflict (id) do nothing;

-- 경로 규칙: voice/{group_id}/{uuid}.m4a
drop policy if exists voice_obj_select on storage.objects;
create policy voice_obj_select on storage.objects for select
  using (
    bucket_id = 'voice'
    and public.is_group_member_path((storage.foldername(name))[1])
  );

drop policy if exists voice_obj_insert on storage.objects;
create policy voice_obj_insert on storage.objects for insert
  with check (
    bucket_id = 'voice'
    and public.is_group_member_path((storage.foldername(name))[1])
  );

drop policy if exists voice_obj_delete on storage.objects;
create policy voice_obj_delete on storage.objects for delete
  using (
    bucket_id = 'voice'
    and owner = auth.uid()
  );

-- ─────────────────────────────────────────────────────────────
-- Realtime
-- ─────────────────────────────────────────────────────────────
-- 이미 등록된 테이블을 다시 추가하면 에러가 나므로 건너뜁니다 (마이그레이션 재실행 대비).
do $$
declare
  t text;
begin
  foreach t in array array['qt_entries', 'comments', 'stamps', 'passages', 'voice_messages'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
