-- ============================================================
-- 묵상 열매 — 출석·참여로 쌓이는 잔잔한 크레딧
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- ============================================================

-- 장부(ledger). 적립은 +, 나중에 소비는 - 로 기록합니다.
-- 클라이언트가 직접 못 넣도록 INSERT 정책을 주지 않고, 트리거(정의자 권한)로만 적립합니다.
create table if not exists public.fruit_ledger (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  group_id   uuid references public.groups(id) on delete set null,
  delta      int not null,
  reason     text not null,           -- 'qt' | 'streak7' | 'streak30' | 'spend:...'
  created_at timestamptz not null default now()
);
create index if not exists fruit_ledger_user_idx on public.fruit_ledger(user_id);

alter table public.fruit_ledger enable row level security;

-- 나 자신 + 같은 소그룹 사람의 열매는 볼 수 있습니다(잔잔한 격려용).
drop policy if exists fruit_select on public.fruit_ledger;
create policy fruit_select on public.fruit_ledger
  for select
  using (user_id = auth.uid() or public.shares_group_with(user_id));
-- INSERT/UPDATE/DELETE 정책 없음 → 클라이언트 직접 조작 불가.

-- 사용자별 합계 뷰 (뷰 사용자의 RLS 를 그대로 따름)
create or replace view public.fruit_totals
with (security_invoker = true) as
  select user_id, coalesce(sum(delta), 0)::int as total
  from public.fruit_ledger
  group by user_id;

-- QT 를 처음 올리면(=INSERT) 열매를 적립합니다.
-- 수정(upsert 의 UPDATE)은 AFTER INSERT 가 아니므로 중복 적립되지 않습니다.
create or replace function public.award_fruit_on_qt()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  d_date date;
  gid    uuid;
  streak int := 1;
  k      int := 1;
begin
  select p.date, p.group_id into d_date, gid
  from public.passages p where p.id = new.passage_id;

  -- 오늘 올린 것 포함, 하루씩 거슬러 올라가며 연속 묵상 길이를 셉니다.
  loop
    if exists (
      select 1
      from public.qt_entries q
      join public.passages p on p.id = q.passage_id
      where q.user_id = new.user_id
        and p.group_id = gid
        and p.date = d_date - k
    ) then
      streak := streak + 1;
      k := k + 1;
    else
      exit;
    end if;
  end loop;

  -- 기본 적립
  insert into public.fruit_ledger (user_id, group_id, delta, reason)
  values (new.user_id, gid, 1, 'qt');

  -- 연속 묵상 이정표 보너스 (도달한 그날 한 번)
  if streak = 7 then
    insert into public.fruit_ledger (user_id, group_id, delta, reason)
    values (new.user_id, gid, 3, 'streak7');
  elsif streak = 30 then
    insert into public.fruit_ledger (user_id, group_id, delta, reason)
    values (new.user_id, gid, 10, 'streak30');
  end if;

  return new;
end;
$$;

drop trigger if exists on_qt_award_fruit on public.qt_entries;
create trigger on_qt_award_fruit
  after insert on public.qt_entries
  for each row execute function public.award_fruit_on_qt();

-- 나중에 소비할 때 쓸 RPC (지금은 UI 없음, 구조만 준비).
-- 잔액을 확인하고 부족하면 막습니다.
create or replace function public.spend_fruit(amount int, what text)
returns int
language plpgsql
security definer
set search_path = public
as $$
declare
  bal int;
begin
  if auth.uid() is null then raise exception '로그인이 필요합니다'; end if;
  if amount is null or amount <= 0 then raise exception '수량이 올바르지 않아요'; end if;

  select coalesce(sum(delta), 0) into bal
  from public.fruit_ledger where user_id = auth.uid();

  if bal < amount then raise exception '묵상 열매가 부족해요'; end if;

  insert into public.fruit_ledger (user_id, delta, reason)
  values (auth.uid(), -amount, 'spend:' || coalesce(what, ''));

  return bal - amount;
end;
$$;
