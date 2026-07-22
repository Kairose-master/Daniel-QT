-- ============================================================
-- 다니엘과 세친구 : 초기 스키마
-- Supabase 대시보드 > SQL Editor 에 전체를 붙여넣고 Run 하세요.
-- 여러 번 실행해도 안전합니다 (idempotent).
-- ============================================================


-- ------------------------------------------------------------
-- 1. 테이블
-- ------------------------------------------------------------

-- auth.users 와 1:1. 가입할 때 트리거로 자동 생성됩니다.
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

create index if not exists group_members_user_idx
  on public.group_members(user_id);

-- 리더가 올리는 일자별 본문. 소그룹당 하루에 하나.
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

create index if not exists passages_group_date_idx
  on public.passages(group_id, date desc);

-- 멤버별 QT 나눔. 출석, 참여율, 연속 묵상의 원천 데이터.
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
create index if not exists qt_entries_user_idx    on public.qt_entries(user_id);

create table if not exists public.comments (
  id          uuid primary key default gen_random_uuid(),
  qt_entry_id uuid not null references public.qt_entries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  text        text not null,
  created_at  timestamptz not null default now()
);

create index if not exists comments_entry_idx
  on public.comments(qt_entry_id, created_at);

-- 위로 스탬프. 1인 1개이므로 (글, 사람) 을 기본키로 둡니다.
create table if not exists public.stamps (
  qt_entry_id uuid not null references public.qt_entries(id) on delete cascade,
  user_id     uuid not null references public.profiles(id) on delete cascade,
  kind        text not null check (kind in ('pray', 'together', 'cheer', 'grace')),
  created_at  timestamptz not null default now(),
  primary key (qt_entry_id, user_id)
);

-- 응원 음성. 파일 자체는 Storage 의 voice 버킷에 있습니다.
create table if not exists public.voice_messages (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references public.groups(id) on delete cascade,
  from_user_id uuid not null references public.profiles(id) on delete cascade,
  to_user_id   uuid not null references public.profiles(id) on delete cascade,
  storage_path text not null,
  duration     int not null default 0,
  heard        boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists voice_group_idx
  on public.voice_messages(group_id, created_at desc);

-- 푸시 알림 토큰
create table if not exists public.push_tokens (
  user_id    uuid not null references public.profiles(id) on delete cascade,
  token      text not null,
  platform   text,
  updated_at timestamptz not null default now(),
  primary key (user_id, token)
);


-- ------------------------------------------------------------
-- 2. 가입하면 프로필을 자동으로 만듭니다
-- ------------------------------------------------------------

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, avatar_url)
  values (
    new.id,
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(new.raw_user_meta_data ->> 'nickname', ''),
      nullif(new.raw_user_meta_data ->> 'full_name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      '이름없음'
    ),
    coalesce(
      new.raw_user_meta_data ->> 'avatar_url',
      new.raw_user_meta_data ->> 'picture'
    )
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function public.handle_new_user();


-- ------------------------------------------------------------
-- 3. 헬퍼 함수
--    RLS 정책 안에서 group_members 를 직접 조회하면 정책이
--    자기 자신을 다시 부르는 무한 재귀가 생깁니다.
--    security definer 함수로 감싸서 이를 피합니다.
-- ------------------------------------------------------------

create or replace function public.is_group_member(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid()
  );
$$;

create or replace function public.is_group_leader(gid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where group_id = gid and user_id = auth.uid() and role = 'leader'
  );
$$;

-- Storage 경로의 첫 폴더가 내 소그룹인지 확인합니다.
-- uuid 로 캐스팅하면 다른 버킷 경로에서 에러가 날 수 있어 텍스트로 비교합니다.
create or replace function public.is_group_member_path(folder text)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.group_members
    where user_id = auth.uid() and group_id::text = folder
  );
$$;

-- 나와 같은 소그룹에 속한 사람인지 확인합니다.
create or replace function public.shares_group_with(uid uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1
    from public.group_members a
    join public.group_members b on a.group_id = b.group_id
    where a.user_id = auth.uid() and b.user_id = uid
  );
$$;

-- 어떤 QT 나눔이 속한 소그룹 id
create or replace function public.entry_group_id(eid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select p.group_id
  from public.qt_entries q
  join public.passages p on p.id = q.passage_id
  where q.id = eid;
$$;

-- 어떤 본문이 속한 소그룹 id
create or replace function public.passage_group_id(pid uuid)
returns uuid
language sql
security definer
stable
set search_path = public
as $$
  select group_id from public.passages where id = pid;
$$;


-- ------------------------------------------------------------
-- 4. 소그룹 만들기 / 참여하기
--    참여 전에는 groups 를 읽을 권한이 없으므로 RPC 로 처리합니다.
-- ------------------------------------------------------------

create or replace function public.generate_invite_code()
returns text
language plpgsql
volatile
set search_path = public
as $$
declare
  -- 헷갈리는 I, L, O, 0, 1 은 뺐습니다
  alphabet constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
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
end;
$$;

create or replace function public.create_group(group_name text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
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
end;
$$;

create or replace function public.join_group_by_code(code text)
returns public.groups
language plpgsql
security definer
set search_path = public
as $$
declare
  g public.groups;
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;

  select * into g
  from public.groups
  where invite_code = upper(trim(code));

  if g.id is null then
    raise exception '초대코드를 찾을 수 없어요';
  end if;

  insert into public.group_members (group_id, user_id, role)
  values (g.id, auth.uid(), 'member')
  on conflict (group_id, user_id) do nothing;

  return g;
end;
$$;


-- ------------------------------------------------------------
-- 5. 출석 집계용 뷰
--    security_invoker = true 이므로 보는 사람의 RLS 가 그대로 적용됩니다.
-- ------------------------------------------------------------

create or replace view public.qt_days
with (security_invoker = true)
as
  select
    p.group_id,
    q.user_id,
    p.date,
    q.id as qt_entry_id
  from public.qt_entries q
  join public.passages p on p.id = q.passage_id;


-- ------------------------------------------------------------
-- 6. RLS (행 수준 보안)
-- ------------------------------------------------------------

alter table public.profiles       enable row level security;
alter table public.groups         enable row level security;
alter table public.group_members  enable row level security;
alter table public.passages       enable row level security;
alter table public.qt_entries     enable row level security;
alter table public.comments       enable row level security;
alter table public.stamps         enable row level security;
alter table public.voice_messages enable row level security;
alter table public.push_tokens    enable row level security;

-- profiles : 나 자신과 같은 소그룹 사람만 볼 수 있습니다.
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select
  using (id = auth.uid() or public.shares_group_with(id));

drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles
  for update
  using (id = auth.uid())
  with check (id = auth.uid());

-- groups : 멤버만 조회. 만들기와 참여는 위의 RPC 로만 합니다.
drop policy if exists groups_select on public.groups;
create policy groups_select on public.groups
  for select
  using (public.is_group_member(id));

drop policy if exists groups_update on public.groups;
create policy groups_update on public.groups
  for update
  using (public.is_group_leader(id))
  with check (public.is_group_leader(id));

-- group_members : 같은 소그룹 멤버 목록만. 탈퇴는 본인 또는 리더.
drop policy if exists group_members_select on public.group_members;
create policy group_members_select on public.group_members
  for select
  using (public.is_group_member(group_id));

drop policy if exists group_members_delete on public.group_members;
create policy group_members_delete on public.group_members
  for delete
  using (user_id = auth.uid() or public.is_group_leader(group_id));

-- passages : 멤버는 읽기, 리더만 쓰기
drop policy if exists passages_select on public.passages;
create policy passages_select on public.passages
  for select
  using (public.is_group_member(group_id));

drop policy if exists passages_insert on public.passages;
create policy passages_insert on public.passages
  for insert
  with check (public.is_group_leader(group_id) and created_by = auth.uid());

drop policy if exists passages_update on public.passages;
create policy passages_update on public.passages
  for update
  using (public.is_group_leader(group_id))
  with check (public.is_group_leader(group_id));

drop policy if exists passages_delete on public.passages;
create policy passages_delete on public.passages
  for delete
  using (public.is_group_leader(group_id));

-- qt_entries : 같은 소그룹은 읽기, 쓰기는 본인 것만
drop policy if exists qt_select on public.qt_entries;
create policy qt_select on public.qt_entries
  for select
  using (public.is_group_member(public.passage_group_id(passage_id)));

drop policy if exists qt_insert on public.qt_entries;
create policy qt_insert on public.qt_entries
  for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(public.passage_group_id(passage_id))
  );

drop policy if exists qt_update on public.qt_entries;
create policy qt_update on public.qt_entries
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists qt_delete on public.qt_entries;
create policy qt_delete on public.qt_entries
  for delete
  using (user_id = auth.uid());

-- comments
drop policy if exists comments_select on public.comments;
create policy comments_select on public.comments
  for select
  using (public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists comments_insert on public.comments;
create policy comments_insert on public.comments
  for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(public.entry_group_id(qt_entry_id))
  );

drop policy if exists comments_delete on public.comments;
create policy comments_delete on public.comments
  for delete
  using (user_id = auth.uid());

-- stamps
drop policy if exists stamps_select on public.stamps;
create policy stamps_select on public.stamps
  for select
  using (public.is_group_member(public.entry_group_id(qt_entry_id)));

drop policy if exists stamps_insert on public.stamps;
create policy stamps_insert on public.stamps
  for insert
  with check (
    user_id = auth.uid()
    and public.is_group_member(public.entry_group_id(qt_entry_id))
  );

drop policy if exists stamps_update on public.stamps;
create policy stamps_update on public.stamps
  for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists stamps_delete on public.stamps;
create policy stamps_delete on public.stamps
  for delete
  using (user_id = auth.uid());

-- voice_messages : 응원함은 소그룹이 함께 보는 화면이라 멤버 전체 읽기.
-- heard 갱신은 받은 사람, 삭제는 보낸 사람만.
drop policy if exists voice_select on public.voice_messages;
create policy voice_select on public.voice_messages
  for select
  using (public.is_group_member(group_id));

drop policy if exists voice_insert on public.voice_messages;
create policy voice_insert on public.voice_messages
  for insert
  with check (from_user_id = auth.uid() and public.is_group_member(group_id));

drop policy if exists voice_update on public.voice_messages;
create policy voice_update on public.voice_messages
  for update
  using (to_user_id = auth.uid() or from_user_id = auth.uid())
  with check (to_user_id = auth.uid() or from_user_id = auth.uid());

drop policy if exists voice_delete on public.voice_messages;
create policy voice_delete on public.voice_messages
  for delete
  using (from_user_id = auth.uid());

-- push_tokens : 본인 것만
drop policy if exists push_all on public.push_tokens;
create policy push_all on public.push_tokens
  for all
  using (user_id = auth.uid())
  with check (user_id = auth.uid());


-- ------------------------------------------------------------
-- 7. Realtime
--    이미 등록된 테이블을 다시 추가하면 에러가 나므로 건너뜁니다.
-- ------------------------------------------------------------

do $$
declare
  t text;
begin
  foreach t in array array[
    'qt_entries', 'comments', 'stamps', 'passages', 'voice_messages'
  ] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime'
        and schemaname = 'public'
        and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end;
$$;


-- ------------------------------------------------------------
-- 8. Storage : 응원 음성 버킷
-- ------------------------------------------------------------

insert into storage.buckets (id, name, public)
values ('voice', 'voice', false)
on conflict (id) do nothing;

-- 경로 규칙 : voice/{group_id}/{uuid}.m4a
--
-- 아래 세 개는 storage.objects 에 정책을 만드는 문장입니다.
-- 프로젝트에 따라 "must be owner of table objects" 권한 오류가 날 수 있습니다.
-- 그럴 때는 이 블록만 건너뛰고, 대시보드의
--   Storage > voice > Policies > New policy
-- 에서 아래 USING / WITH CHECK 식을 그대로 붙여 만들면 됩니다.

do $$
begin
  begin
    drop policy if exists voice_obj_select on storage.objects;
    create policy voice_obj_select on storage.objects
      for select
      using (
        bucket_id = 'voice'
        and public.is_group_member_path((storage.foldername(name))[1])
      );

    drop policy if exists voice_obj_insert on storage.objects;
    create policy voice_obj_insert on storage.objects
      for insert
      with check (
        bucket_id = 'voice'
        and public.is_group_member_path((storage.foldername(name))[1])
      );

    drop policy if exists voice_obj_delete on storage.objects;
    create policy voice_obj_delete on storage.objects
      for delete
      using (bucket_id = 'voice' and owner = auth.uid());

  exception when insufficient_privilege then
    raise notice 'storage.objects 정책을 만들 권한이 없습니다. 대시보드에서 직접 추가해주세요.';
  end;
end;
$$;


-- ============================================================
-- 끝. 여기까지 오류 없이 실행됐다면 준비 완료입니다.
-- ============================================================
