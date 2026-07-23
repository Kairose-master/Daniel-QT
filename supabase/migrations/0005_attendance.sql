-- ============================================================
-- 출석을 실제 기능으로 + 보상(묵상 열매)을 출석에 통합
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- (0004_fruit.sql 을 먼저 실행했어야 합니다.)
-- ============================================================

-- 하루 한 번의 출석 기록. QT 를 쓰면 자동으로, 안 써도 '출석 체크'로 남깁니다.
create table if not exists public.attendance (
  group_id   uuid not null references public.groups(id) on delete cascade,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  date       date not null,
  source     text not null default 'checkin',   -- 'checkin' | 'qt'
  created_at timestamptz not null default now(),
  primary key (group_id, user_id, date)
);
create index if not exists attendance_group_date_idx on public.attendance(group_id, date);
create index if not exists attendance_user_idx on public.attendance(user_id);

alter table public.attendance enable row level security;

drop policy if exists attendance_select on public.attendance;
create policy attendance_select on public.attendance
  for select using (public.is_group_member(group_id));

drop policy if exists attendance_insert on public.attendance;
create policy attendance_insert on public.attendance
  for insert with check (user_id = auth.uid() and public.is_group_member(group_id));

-- 오늘 출석 체크 (날짜는 기기 로컬 기준으로 클라이언트가 넘깁니다)
create or replace function public.check_in(gid uuid, d date)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if not public.is_group_member(gid) then raise exception '이 소그룹의 멤버가 아니에요'; end if;

  insert into public.attendance (group_id, user_id, date, source)
  values (gid, auth.uid(), d, 'checkin')
  on conflict (group_id, user_id, date) do nothing;
end;
$$;

-- QT 를 올리면 그날 출석도 자동으로 남깁니다.
create or replace function public.attend_on_qt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_date date;
  gid    uuid;
begin
  select p.date, p.group_id into d_date, gid
  from public.passages p where p.id = new.passage_id;

  insert into public.attendance (group_id, user_id, date, source)
  values (gid, new.user_id, d_date, 'qt')
  on conflict (group_id, user_id, date) do nothing;

  return new;
end;
$$;

drop trigger if exists on_qt_attend on public.qt_entries;
create trigger on_qt_attend
  after insert on public.qt_entries
  for each row execute function public.attend_on_qt();

-- 보상은 이제 '출석'을 원천으로 합니다 (QT 든 체크인이든 하루 한 번).
-- 기존 qt 기반 적립 트리거는 중복이 되므로 제거합니다.
drop trigger if exists on_qt_award_fruit on public.qt_entries;

create or replace function public.award_fruit_on_attendance()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  streak int := 1;
  k      int := 1;
begin
  -- 오늘 포함, 하루씩 거슬러 올라가며 연속 출석 길이를 셉니다.
  loop
    if exists (
      select 1 from public.attendance a
      where a.user_id = new.user_id
        and a.group_id = new.group_id
        and a.date = new.date - k
    ) then
      streak := streak + 1;
      k := k + 1;
    else
      exit;
    end if;
  end loop;

  insert into public.fruit_ledger (user_id, group_id, delta, reason)
  values (new.user_id, new.group_id, 1, 'attend');

  if streak = 7 then
    insert into public.fruit_ledger (user_id, group_id, delta, reason)
    values (new.user_id, new.group_id, 3, 'streak7');
  elsif streak = 30 then
    insert into public.fruit_ledger (user_id, group_id, delta, reason)
    values (new.user_id, new.group_id, 10, 'streak30');
  end if;

  return new;
end;
$$;

drop trigger if exists on_attend_award_fruit on public.attendance;
create trigger on_attend_award_fruit
  after insert on public.attendance
  for each row execute function public.award_fruit_on_attendance();

-- Realtime
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance'
  ) then
    alter publication supabase_realtime add table public.attendance;
  end if;
end $$;
