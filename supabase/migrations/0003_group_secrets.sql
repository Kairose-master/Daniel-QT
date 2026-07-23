-- ============================================================
-- 소그룹별 AI 키 저장 (리더 본인 Anthropic 키로 과금)
-- Supabase SQL Editor 에 붙여넣고 Run 하세요. 여러 번 실행해도 안전합니다.
-- ============================================================

-- 키는 groups 행과 분리합니다. groups 는 멤버 전원이 읽을 수 있어서
-- 거기에 키를 두면 다른 멤버에게 노출되기 때문입니다.
create table if not exists public.group_secrets (
  group_id          uuid primary key references public.groups(id) on delete cascade,
  anthropic_api_key text,
  updated_at        timestamptz not null default now()
);

alter table public.group_secrets enable row level security;

-- 리더만 자기 소그룹의 키를 읽고/쓰고/지울 수 있습니다.
drop policy if exists group_secrets_all on public.group_secrets;
create policy group_secrets_all on public.group_secrets
  for all
  using (public.is_group_leader(group_id))
  with check (public.is_group_leader(group_id));
