-- 2026-10-14 커뮤니티 규칙 추가
-- 이미 schema.sql을 실행한 Supabase 프로젝트에 이 파일만 SQL Editor에서 한 번 실행한다.
-- (schema.sql에는 같은 내용이 이미 들어 있으므로, 새로 만드는 프로젝트는 실행하지 않아도 된다)

-- 1. 피드 글(sns)은 500자까지
alter table public.posts
  add constraint posts_sns_length check (board <> 'sns' or char_length(body) <= 500);

-- 2. 본인이 쓴 글·댓글은 신고할 수 없다
create or replace function public.is_own_content(p_post bigint, p_comment bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where id = p_post and author_id = auth.uid())
      or exists (select 1 from public.comments where id = p_comment and author_id = auth.uid())
$$;

drop policy if exists "로그인 사용자 신고" on public.reports;
create policy "로그인 사용자 신고" on public.reports
  for insert with check (reporter_id = auth.uid() and status = 'open' and not public.is_own_content(post_id, comment_id));
