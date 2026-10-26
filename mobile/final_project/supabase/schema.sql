-- =====================================================================
-- 이코노바(ECONOVA) 데이터베이스 스키마
-- Supabase 대시보드 → SQL Editor에 전체를 붙여 넣고 실행한다.
--
-- 원칙
-- 1. 모든 테이블에 RLS를 켠다. 정책이 없는 동작은 기본적으로 거부된다.
-- 2. 브라우저는 공개 anon 키만 쓴다. service_role 키는 브라우저에 넣지 않는다.
-- 3. 사용자가 바꾸면 안 되는 열(권한, 숨김, 집계 수)은 열 단위 권한으로 막고,
--    필요한 변경은 security definer 함수나 트리거로만 한다.
-- 4. 개인 투자 기록은 본인만 읽고 쓸 수 있다.
-- =====================================================================

create extension if not exists pg_trgm;

-- ---------------------------------------------------------------------
-- 공통 함수
-- ---------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- 종목 ID 형식: KR.005930 / US.NAS.AAPL (shared/symbols.js와 같은 규칙)
create or replace function public.is_symbol_id(value text)
returns boolean language sql immutable as $$
  select value ~ '^(KR\.[0-9A-Z]{6}|US\.(NAS|NYS|AMS)\.[A-Z][A-Z0-9/-]{0,9})$'
$$;

-- ---------------------------------------------------------------------
-- 회원 프로필
-- ---------------------------------------------------------------------

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  nickname text not null unique check (char_length(nickname) between 2 and 20),
  bio text not null default '' check (char_length(bio) <= 200),
  role text not null default 'user' check (role in ('user', 'admin')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'admin')
$$;

-- 가입하면 프로필을 자동으로 만든다. 닉네임이 겹치면 뒤에 짧은 ID를 붙인다.
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = '' as $$
declare
  wanted text := coalesce(nullif(trim(new.raw_user_meta_data ->> 'nickname'), ''), 'user');
begin
  wanted := left(wanted, 15);
  if char_length(wanted) < 2 then
    wanted := 'user';
  end if;
  begin
    insert into public.profiles (id, nickname) values (new.id, wanted);
  exception when unique_violation then
    insert into public.profiles (id, nickname) values (new.id, wanted || '_' || left(new.id::text, 4));
  end;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.profiles enable row level security;

create policy "프로필은 누구나 조회" on public.profiles
  for select using (true);
create policy "본인 프로필만 수정" on public.profiles
  for update using (id = auth.uid()) with check (id = auth.uid());

-- role은 사용자가 바꿀 수 없다
revoke update on public.profiles from anon, authenticated;
grant update (nickname, bio) on public.profiles to authenticated;

-- 계정 삭제: 투자 기록 등 개인 데이터는 함께 삭제되고,
-- 게시글·댓글은 작성자 표시만 사라진다(익명화).
create or replace function public.delete_my_account()
returns void language plpgsql security definer set search_path = '' as $$
begin
  if auth.uid() is null then
    raise exception '로그인이 필요합니다';
  end if;
  delete from auth.users where id = auth.uid();
end;
$$;

revoke execute on function public.delete_my_account() from public, anon;
grant execute on function public.delete_my_account() to authenticated;

-- ---------------------------------------------------------------------
-- 종목 목록 (서버가 종목 마스터를 받아 채운다. 사용자는 읽기만)
-- ---------------------------------------------------------------------

create table public.stocks (
  symbol_id text primary key check (public.is_symbol_id(symbol_id)),
  market text not null check (market in ('KR', 'US')),
  code text not null,
  exchange text,
  name text not null,
  name_en text,
  sector text,
  currency text not null check (currency in ('KRW', 'USD')),
  updated_at timestamptz not null default now()
);

create index stocks_name_trgm on public.stocks using gin (name gin_trgm_ops);

alter table public.stocks enable row level security;
create policy "종목은 누구나 조회" on public.stocks for select using (true);

-- ---------------------------------------------------------------------
-- 사용자 정의 지표 (게시글에서 공유할 수 있어 posts보다 먼저 만든다)
-- ---------------------------------------------------------------------

create table public.custom_indicators (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  name text not null check (char_length(name) between 1 and 40),
  expression text not null check (char_length(expression) between 1 and 500),
  params jsonb not null default '{}'::jsonb,
  pane text not null default 'price' check (pane in ('price', 'separate')),
  color text not null default '#3b5bdb' check (color ~ '^#[0-9a-fA-F]{6}$'),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger custom_indicators_updated_at before update on public.custom_indicators
  for each row execute function public.set_updated_at();

alter table public.custom_indicators enable row level security;

create policy "본인 지표와 공개 지표 조회" on public.custom_indicators
  for select using (user_id = auth.uid() or is_public);
create policy "본인 지표 작성" on public.custom_indicators
  for insert with check (user_id = auth.uid());
create policy "본인 지표 수정" on public.custom_indicators
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "본인 지표 삭제" on public.custom_indicators
  for delete using (user_id = auth.uid());

-- 종목별 차트 설정. symbol_id가 '*'이면 모든 종목의 기본값
create table public.chart_settings (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  symbol_id text not null check (symbol_id = '*' or public.is_symbol_id(symbol_id)),
  settings jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, symbol_id)
);

create trigger chart_settings_updated_at before update on public.chart_settings
  for each row execute function public.set_updated_at();

alter table public.chart_settings enable row level security;
create policy "본인 차트 설정만" on public.chart_settings
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 게시글 (SNS와 게시판이 함께 쓴다)
-- board: sns(피드 전용 짧은 글) / kr / us / company / economy / free
-- ---------------------------------------------------------------------

create table public.posts (
  id bigint generated always as identity primary key,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  board text not null check (board in ('sns', 'kr', 'us', 'company', 'economy', 'free')),
  title text check (title is null or char_length(title) between 1 and 100),
  body text not null check (char_length(body) between 1 and 10000),
  stock_symbol text check (stock_symbol is null or public.is_symbol_id(stock_symbol)),
  indicator_id bigint references public.custom_indicators (id) on delete set null,
  hidden boolean not null default false,
  like_count integer not null default 0,
  comment_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 게시판 글은 제목이 필요하다
  constraint posts_title_required check (board = 'sns' or title is not null),
  -- 피드 글(sns)은 짧은 글: 500자까지
  constraint posts_sns_length check (board <> 'sns' or char_length(body) <= 500)
);

create index posts_board_created on public.posts (board, created_at desc);
create index posts_author_created on public.posts (author_id, created_at desc);
create index posts_stock_created on public.posts (stock_symbol, created_at desc) where stock_symbol is not null;
create index posts_title_trgm on public.posts using gin (title gin_trgm_ops);
create index posts_body_trgm on public.posts using gin (body gin_trgm_ops);

create trigger posts_updated_at before update on public.posts
  for each row execute function public.set_updated_at();

-- 도배 방지: 1분에 5개까지
create or replace function public.can_write_post()
returns boolean language sql stable security definer set search_path = '' as $$
  select count(*) < 5 from public.posts
  where author_id = auth.uid() and created_at > now() - interval '1 minute'
$$;

alter table public.posts enable row level security;

create policy "숨김이 아닌 글은 누구나 조회" on public.posts
  for select using (not hidden or author_id = auth.uid() or public.is_admin());
create policy "로그인 사용자 작성" on public.posts
  for insert with check (author_id = auth.uid() and public.can_write_post());
create policy "본인 글 수정" on public.posts
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "본인 글 또는 관리자 삭제" on public.posts
  for delete using (author_id = auth.uid() or public.is_admin());

-- 숨김 여부와 집계 수는 사용자가 직접 바꿀 수 없다
revoke update on public.posts from anon, authenticated;
grant update (title, body, board, stock_symbol, indicator_id) on public.posts to authenticated;

create or replace function public.admin_set_post_hidden(target bigint, value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다';
  end if;
  update public.posts set hidden = value where id = target;
end;
$$;

-- ---------------------------------------------------------------------
-- 댓글
-- ---------------------------------------------------------------------

create table public.comments (
  id bigint generated always as identity primary key,
  post_id bigint not null references public.posts (id) on delete cascade,
  author_id uuid default auth.uid() references public.profiles (id) on delete set null,
  body text not null check (char_length(body) between 1 and 2000),
  hidden boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index comments_post_created on public.comments (post_id, created_at);

create trigger comments_updated_at before update on public.comments
  for each row execute function public.set_updated_at();

create or replace function public.can_write_comment()
returns boolean language sql stable security definer set search_path = '' as $$
  select count(*) < 10 from public.comments
  where author_id = auth.uid() and created_at > now() - interval '1 minute'
$$;

alter table public.comments enable row level security;

-- 원글을 볼 수 있을 때만 댓글도 보인다(posts의 RLS가 함께 적용됨)
create policy "볼 수 있는 글의 댓글 조회" on public.comments
  for select using (
    (not hidden or author_id = auth.uid() or public.is_admin())
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "로그인 사용자 댓글 작성" on public.comments
  for insert with check (
    author_id = auth.uid()
    and public.can_write_comment()
    and exists (select 1 from public.posts p where p.id = post_id)
  );
create policy "본인 댓글 수정" on public.comments
  for update using (author_id = auth.uid()) with check (author_id = auth.uid());
create policy "본인 댓글 또는 관리자 삭제" on public.comments
  for delete using (author_id = auth.uid() or public.is_admin());

revoke update on public.comments from anon, authenticated;
grant update (body) on public.comments to authenticated;

create or replace function public.admin_set_comment_hidden(target bigint, value boolean)
returns void language plpgsql security definer set search_path = '' as $$
begin
  if not public.is_admin() then
    raise exception '관리자만 할 수 있습니다';
  end if;
  update public.comments set hidden = value where id = target;
end;
$$;

-- ---------------------------------------------------------------------
-- 좋아요, 팔로우
-- ---------------------------------------------------------------------

create table public.likes (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  post_id bigint not null references public.posts (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, post_id)
);

alter table public.likes enable row level security;
create policy "좋아요 조회" on public.likes for select using (true);
create policy "본인 좋아요 추가" on public.likes for insert with check (user_id = auth.uid());
create policy "본인 좋아요 취소" on public.likes for delete using (user_id = auth.uid());

create table public.follows (
  follower_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  following_id uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, following_id),
  check (follower_id <> following_id)
);

create index follows_following on public.follows (following_id);

alter table public.follows enable row level security;
create policy "팔로우 관계 조회" on public.follows for select using (true);
create policy "본인이 팔로우" on public.follows for insert with check (follower_id = auth.uid());
create policy "본인이 언팔로우" on public.follows for delete using (follower_id = auth.uid());

-- 좋아요·댓글 수 집계 (사용자는 posts의 집계 열을 직접 못 바꾸므로 트리거가 처리)
create or replace function public.update_post_counts()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if tg_table_name = 'likes' then
    update public.posts set like_count = like_count + (case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  else
    update public.posts set comment_count = comment_count + (case when tg_op = 'INSERT' then 1 else -1 end)
    where id = coalesce(new.post_id, old.post_id);
  end if;
  return null;
end;
$$;

create trigger likes_count after insert or delete on public.likes
  for each row execute function public.update_post_counts();
create trigger comments_count after insert or delete on public.comments
  for each row execute function public.update_post_counts();

-- ---------------------------------------------------------------------
-- 북마크 (게시글, 뉴스)
-- ---------------------------------------------------------------------

create table public.bookmarks (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  kind text not null check (kind in ('post', 'news')),
  post_id bigint references public.posts (id) on delete cascade,
  news_url text check (news_url is null or news_url ~ '^https?://'),
  news_title text check (news_title is null or char_length(news_title) <= 300),
  news_source text,
  news_published_at timestamptz,
  created_at timestamptz not null default now(),
  check (
    (kind = 'post' and post_id is not null and news_url is null)
    or (kind = 'news' and news_url is not null and news_title is not null and post_id is null)
  )
);

create unique index bookmarks_post_unique on public.bookmarks (user_id, post_id) where kind = 'post';
create unique index bookmarks_news_unique on public.bookmarks (user_id, news_url) where kind = 'news';

alter table public.bookmarks enable row level security;
create policy "본인 북마크만" on public.bookmarks
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 신고
-- ---------------------------------------------------------------------

create table public.reports (
  id bigint generated always as identity primary key,
  reporter_id uuid default auth.uid() references public.profiles (id) on delete set null,
  post_id bigint references public.posts (id) on delete cascade,
  comment_id bigint references public.comments (id) on delete cascade,
  reason text not null check (char_length(reason) between 1 and 500),
  status text not null default 'open' check (status in ('open', 'resolved', 'rejected')),
  created_at timestamptz not null default now(),
  check ((post_id is null) <> (comment_id is null))
);

create unique index reports_once_per_post on public.reports (reporter_id, post_id) where post_id is not null;
create unique index reports_once_per_comment on public.reports (reporter_id, comment_id) where comment_id is not null;

alter table public.reports enable row level security;
create policy "본인 신고 또는 관리자 조회" on public.reports
  for select using (reporter_id = auth.uid() or public.is_admin());
-- 본인이 쓴 글·댓글은 신고할 수 없다
create or replace function public.is_own_content(p_post bigint, p_comment bigint)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.posts where id = p_post and author_id = auth.uid())
      or exists (select 1 from public.comments where id = p_comment and author_id = auth.uid())
$$;

create policy "로그인 사용자 신고" on public.reports
  for insert with check (reporter_id = auth.uid() and status = 'open' and not public.is_own_content(post_id, comment_id));
create policy "관리자 처리" on public.reports
  for update using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 관심 종목
-- ---------------------------------------------------------------------

create table public.watchlists (
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  symbol_id text not null check (public.is_symbol_id(symbol_id)),
  position integer not null default 0,
  created_at timestamptz not null default now(),
  primary key (user_id, symbol_id)
);

alter table public.watchlists enable row level security;
create policy "본인 관심 종목만" on public.watchlists
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 투자 거래 원장 (본인만 접근)
-- 매수·매도·배당·분할을 한 원장에 시간순으로 기록한다.
-- 보유 수량과 손익은 저장하지 않고 원장에서 계산한다(이동평균법).
-- 매도 수량이 보유 수량을 넘지 않는지는 원장 전체를 시간순으로 다시 계산해 앱에서 검증한다.
-- ---------------------------------------------------------------------

create table public.transactions (
  id bigint generated always as identity primary key,
  user_id uuid not null default auth.uid() references public.profiles (id) on delete cascade,
  symbol_id text not null check (public.is_symbol_id(symbol_id)),
  type text not null check (type in ('buy', 'sell', 'dividend', 'split')),
  traded_at timestamptz not null,
  -- 같은 시각 거래의 순서
  seq integer not null default 0,
  currency text not null check (currency in ('KRW', 'USD')),
  quantity numeric(20, 6),
  price numeric(20, 4),
  -- 배당: 세후 입금액
  amount numeric(20, 4),
  fee numeric(20, 4) not null default 0 check (fee >= 0),
  tax numeric(20, 4) not null default 0 check (tax >= 0),
  -- 분할: 1주가 몇 주가 되었는지 (4:1 분할이면 4, 1:5 병합이면 0.2)
  split_ratio numeric(12, 6),
  -- USD 거래의 원화 환율(원/달러). 없으면 원화 환산 손익을 계산하지 않는다.
  fx_rate numeric(12, 4) check (fx_rate is null or fx_rate > 0),
  memo text not null default '' check (char_length(memo) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  -- 시장과 통화가 맞아야 한다
  check ((symbol_id like 'KR.%' and currency = 'KRW') or (symbol_id like 'US.%' and currency = 'USD')),
  check (currency = 'USD' or fx_rate is null),
  -- 유형별 필수 값. CHECK는 NULL을 통과시키므로 coalesce로 빈 값을 거부한다.
  check (coalesce(
    case type
      when 'buy' then quantity > 0 and price >= 0 and amount is null and split_ratio is null
      when 'sell' then quantity > 0 and price >= 0 and amount is null and split_ratio is null
      when 'dividend' then amount > 0 and quantity is null and price is null and split_ratio is null
      when 'split' then split_ratio > 0 and quantity is null and price is null and amount is null
    end,
    false
  ))
);

create index transactions_user_order on public.transactions (user_id, traded_at, seq, id);
create index transactions_user_symbol on public.transactions (user_id, symbol_id, traded_at);

create trigger transactions_updated_at before update on public.transactions
  for each row execute function public.set_updated_at();

alter table public.transactions enable row level security;
create policy "본인 거래만" on public.transactions
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- ---------------------------------------------------------------------
-- 경제 지도 (관리자가 검증된 자료로 채운다. 사용자는 읽기만)
-- ---------------------------------------------------------------------

create table public.companies (
  id bigint generated always as identity primary key,
  symbol_id text unique check (symbol_id is null or public.is_symbol_id(symbol_id)),
  name text not null,
  industry text not null,
  country text not null check (country in ('KR', 'US')),
  description text not null default ''
);

create table public.company_locations (
  id bigint generated always as identity primary key,
  company_id bigint not null references public.companies (id) on delete cascade,
  kind text not null check (kind in ('hq', 'plant', 'rnd', 'other')),
  label text not null,
  address text not null,
  lat double precision not null check (lat between -90 and 90),
  lng double precision not null check (lng between -180 and 180),
  source_url text not null check (source_url ~ '^https?://'),
  verified_at date not null,
  -- exact: 건물·캠퍼스 단위로 확인한 좌표, approx: 도로·동네 단위 근사 좌표
  precision text not null default 'exact' check (precision in ('exact', 'approx'))
);

create index company_locations_company on public.company_locations (company_id);

alter table public.companies enable row level security;
alter table public.company_locations enable row level security;
create policy "기업 정보 조회" on public.companies for select using (true);
create policy "기업 위치 조회" on public.company_locations for select using (true);
create policy "관리자 기업 관리" on public.companies
  for all using (public.is_admin()) with check (public.is_admin());
create policy "관리자 위치 관리" on public.company_locations
  for all using (public.is_admin()) with check (public.is_admin());

-- ---------------------------------------------------------------------
-- 경제 일정
-- ---------------------------------------------------------------------

create table public.economic_events (
  id bigint generated always as identity primary key,
  country text not null check (country in ('KR', 'US', 'GLOBAL')),
  category text not null check (category in ('rate', 'inflation', 'employment', 'gdp', 'earnings', 'other')),
  title text not null,
  scheduled_at timestamptz not null,
  -- 날짜만 정해지고 시각이 미정인 일정
  time_tbd boolean not null default false,
  symbol_id text check (symbol_id is null or public.is_symbol_id(symbol_id)),
  previous_value text,
  forecast_value text,
  actual_value text,
  source text not null,
  source_url text check (source_url is null or source_url ~ '^https?://'),
  updated_at timestamptz not null default now()
);

create index economic_events_time on public.economic_events (scheduled_at);

create trigger economic_events_updated_at before update on public.economic_events
  for each row execute function public.set_updated_at();

alter table public.economic_events enable row level security;
create policy "경제 일정 조회" on public.economic_events for select using (true);
create policy "관리자 일정 관리" on public.economic_events
  for all using (public.is_admin()) with check (public.is_admin());
