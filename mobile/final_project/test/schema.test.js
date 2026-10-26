// supabase/schema.sql을 내장 PostgreSQL(PGlite)에서 실행해 제약 조건과 RLS 정책을 확인한다.
// Supabase의 auth 스키마, anon/authenticated 역할, auth.uid()는 최소한으로 흉내 낸다.
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { before, describe, it } from "node:test";
import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";

const SUPABASE_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (id uuid primary key, raw_user_meta_data jsonb not null default '{}'::jsonb);
  create function auth.uid() returns uuid language sql stable as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid
  $$;
  grant usage on schema public, auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  -- Supabase는 public 스키마의 새 객체에 anon/authenticated 권한을 기본으로 준다
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on sequences to anon, authenticated;
  alter default privileges in schema public grant execute on functions to anon, authenticated;
`;

const A = "00000000-0000-0000-0000-00000000000a";
const B = "00000000-0000-0000-0000-00000000000b";
const ADMIN = "00000000-0000-0000-0000-0000000000ad";

let db;

/** 특정 사용자(또는 비로그인)로 쿼리 실행. 실패하면 오류 메시지를 담은 객체를 돌려준다. */
async function as(userId, sql, params = []) {
  try {
    return await db.transaction(async (tx) => {
      await tx.query(`set local role ${userId ? "authenticated" : "anon"}`);
      await tx.query("select set_config('request.jwt.claim.sub', $1, true)", [userId ?? ""]);
      return (await tx.query(sql, params)).rows;
    });
  } catch (error) {
    return { error: error.message };
  }
}

/** 도배 제한 테스트 이후 다른 테스트가 글을 쓸 수 있도록 작성 시각을 과거로 돌린다 */
const resetRateLimit = () =>
  db.query("update public.posts set created_at = now() - interval '2 minutes'");

const rejected = (result) => assert.ok(result.error, `거부되어야 함: ${JSON.stringify(result)}`);
const ok = (result) => {
  assert.ok(!result.error, result.error);
  return result;
};

before(async () => {
  db = new PGlite({ extensions: { pg_trgm } });
  await db.exec(SUPABASE_STUB);
  await db.exec(await readFile(new URL("../supabase/schema.sql", import.meta.url), "utf8"));
  // 가입: 닉네임이 겹치는 B, 관리자
  await db.query(`insert into auth.users (id, raw_user_meta_data) values
    ($1, '{"nickname":"개미"}'), ($2, '{"nickname":"개미"}'), ($3, '{"nickname":"운영자"}')`, [A, B, ADMIN]);
  await db.query("update public.profiles set role = 'admin' where id = $1", [ADMIN]);
});

describe("회원 프로필", () => {
  it("가입하면 프로필이 생기고, 겹치는 닉네임은 뒤에 ID가 붙는다", async () => {
    const rows = await as(A, "select id, nickname from profiles order by nickname");
    const nicknames = Object.fromEntries(rows.map((r) => [r.id, r.nickname]));
    assert.equal(nicknames[A], "개미");
    assert.equal(nicknames[B], "개미_0000");
  });

  it("본인 닉네임은 바꿀 수 있지만 권한(role)은 바꿀 수 없다", async () => {
    ok(await as(A, "update profiles set bio = '장기 투자' where id = $1", [A]));
    rejected(await as(A, "update profiles set role = 'admin' where id = $1", [A]));
  });

  it("다른 사람 프로필은 수정되지 않는다", async () => {
    await as(A, "update profiles set bio = '해킹' where id = $1", [B]);
    const [b] = await as(B, "select bio from profiles where id = $1", [B]);
    assert.equal(b.bio, "");
  });
});

describe("게시글", () => {
  it("비로그인은 읽을 수 있지만 쓸 수 없다", async () => {
    ok(await as(null, "select * from posts"));
    rejected(await as(null, "insert into posts (board, title, body) values ('free', '제목', '내용')"));
  });

  it("게시판 글은 제목이 필요하고 SNS 글은 없어도 된다", async () => {
    rejected(await as(A, "insert into posts (board, body) values ('free', '내용')"));
    ok(await as(A, "insert into posts (board, body) values ('sns', '오늘 장 좋네요')"));
  });

  it("다른 사람을 작성자로 쓸 수 없다", async () => {
    rejected(await as(A, "insert into posts (author_id, board, body) values ($1, 'sns', '사칭')", [B]));
  });

  it("작성자가 숨김이나 좋아요 수를 직접 바꿀 수 없다", async () => {
    const [post] = await as(A, "insert into posts (board, title, body) values ('kr', '삼성전자', '분석') returning id");
    rejected(await as(A, "update posts set hidden = true where id = $1", [post.id]));
    rejected(await as(A, "update posts set like_count = 999 where id = $1", [post.id]));
    ok(await as(A, "update posts set body = '수정한 분석' where id = $1", [post.id]));
  });

  it("다른 사람 글은 수정·삭제되지 않는다", async () => {
    const [post] = await as(A, "insert into posts (board, title, body) values ('us', 'AAPL', '원본') returning id");
    await as(B, "update posts set body = '변조' where id = $1", [post.id]);
    await as(B, "delete from posts where id = $1", [post.id]);
    const [row] = await as(A, "select body from posts where id = $1", [post.id]);
    assert.equal(row.body, "원본");
  });

  it("관리자만 숨길 수 있고, 숨긴 글은 다른 사용자에게 보이지 않는다", async () => {
    const [post] = await as(A, "insert into posts (board, title, body) values ('free', '광고', '광고글') returning id");
    rejected(await as(B, "select admin_set_post_hidden($1, true)", [post.id]));
    ok(await as(ADMIN, "select admin_set_post_hidden($1, true)", [post.id]));
    assert.equal((await as(B, "select id from posts where id = $1", [post.id])).length, 0);
    assert.equal((await as(A, "select id from posts where id = $1", [post.id])).length, 1, "작성자 본인은 볼 수 있음");
    // 숨긴 글에는 다른 사용자가 댓글을 달 수 없다
    rejected(await as(B, "insert into comments (post_id, body) values ($1, '댓글')", [post.id]));
  });

  it("1분에 5개를 넘게 쓸 수 없다", async () => {
    const results = [];
    for (let i = 0; i < 6; i++) results.push(await as(B, "insert into posts (board, body) values ('sns', $1)", [`도배 ${i}`]));
    assert.ok(results.slice(0, 5).every((r) => !r.error));
    rejected(results[5]);
  });
});

describe("좋아요·댓글·팔로우", () => {
  it("좋아요와 댓글 수가 자동으로 집계되고 좋아요는 한 번만 된다", async () => {
    const [post] = await as(A, "insert into posts (board, title, body) values ('economy', '금리', '전망') returning id");
    ok(await as(B, "insert into likes (post_id) values ($1)", [post.id]));
    rejected(await as(B, "insert into likes (post_id) values ($1)", [post.id]));
    ok(await as(B, "insert into comments (post_id, body) values ($1, '동의합니다')", [post.id]));
    const [row] = await as(A, "select like_count, comment_count from posts where id = $1", [post.id]);
    assert.deepEqual(row, { like_count: 1, comment_count: 1 });
    ok(await as(B, "delete from likes where post_id = $1", [post.id]));
    const [after] = await as(A, "select like_count from posts where id = $1", [post.id]);
    assert.equal(after.like_count, 0);
  });

  it("자기 자신을 팔로우하거나 남의 팔로우를 만들 수 없다", async () => {
    ok(await as(A, "insert into follows (following_id) values ($1)", [B]));
    rejected(await as(A, "insert into follows (following_id) values ($1)", [A]));
    rejected(await as(A, "insert into follows (follower_id, following_id) values ($1, $2)", [B, A]));
  });
});

describe("투자 거래 원장", () => {
  it("본인 거래만 보이고, 남의 이름으로 기록할 수 없다", async () => {
    ok(
      await as(
        A,
        "insert into transactions (symbol_id, type, traded_at, currency, quantity, price) values ('KR.005930', 'buy', now(), 'KRW', 10, 70000)",
      ),
    );
    assert.equal((await as(A, "select id from transactions")).length, 1);
    assert.equal((await as(B, "select id from transactions")).length, 0);
    assert.equal((await as(null, "select id from transactions")).length, 0);
    rejected(
      await as(
        B,
        "insert into transactions (user_id, symbol_id, type, traded_at, currency, quantity, price) values ($1, 'KR.005930', 'buy', now(), 'KRW', 1, 1)",
        [A],
      ),
    );
  });

  it("다른 사람 거래를 수정·삭제할 수 없다", async () => {
    await as(B, "update transactions set quantity = 999");
    await as(B, "delete from transactions");
    const [row] = await as(A, "select quantity from transactions");
    assert.equal(Number(row.quantity), 10);
  });

  it("유형별 필수 값과 시장·통화 일치를 검사한다", async () => {
    const insert = (values) =>
      as(A, `insert into transactions (symbol_id, type, traded_at, currency, quantity, price, amount, split_ratio, fx_rate)
             values ($1, $2, now(), $3, $4, $5, $6, $7, $8)`, values);
    rejected(await insert(["KR.005930", "buy", "KRW", 10, null, null, null, null]), "가격 없는 매수");
    rejected(await insert(["KR.005930", "sell", "KRW", 0, 70000, null, null, null]), "수량 0");
    rejected(await insert(["KR.005930", "buy", "USD", 1, 1, null, null, null]), "국내 종목을 달러로");
    rejected(await insert(["KR.005930", "buy", "KRW", 1, 1, null, null, 1400]), "원화 거래에 환율");
    rejected(await insert(["US.NAS.AAPL", "dividend", "USD", 1, null, 5, null, null]), "배당에 수량");
    rejected(await insert(["BAD", "buy", "KRW", 1, 1, null, null, null]), "잘못된 종목 ID");
    ok(await insert(["US.NAS.AAPL", "buy", "USD", 2, 230.5, null, null, 1385.2]));
    ok(await insert(["US.NAS.AAPL", "dividend", "USD", null, null, 0.48, null, null]));
    ok(await insert(["US.NAS.NVDA", "split", "USD", null, null, null, 10, null]));
  });
});

describe("사용자 정의 지표·북마크·관심 종목", () => {
  it("공개 지표만 다른 사람에게 보인다", async () => {
    ok(await as(A, "insert into custom_indicators (name, expression) values ('비공개', 'SMA(종가, 5)')"));
    ok(await as(A, "insert into custom_indicators (name, expression, is_public) values ('공개', 'SMA(종가, 20)', true)"));
    const names = (await as(B, "select name from custom_indicators")).map((r) => r.name);
    assert.deepEqual(names, ["공개"]);
  });

  it("북마크와 관심 종목은 본인만 본다", async () => {
    ok(await as(A, "insert into watchlists (symbol_id) values ('KR.005930')"));
    ok(await as(A, "insert into bookmarks (kind, news_url, news_title) values ('news', 'https://example.com/a', '기사')"));
    assert.equal((await as(B, "select * from watchlists")).length, 0);
    assert.equal((await as(B, "select * from bookmarks")).length, 0);
    rejected(await as(A, "insert into bookmarks (kind, news_url, news_title) values ('news', 'javascript:alert(1)', 'x')"));
  });
});

describe("지도·일정 (관리자 관리 데이터)", () => {
  it("일반 사용자는 읽기만 하고 관리자는 추가할 수 있다", async () => {
    rejected(await as(A, "insert into companies (name, industry, country) values ('가짜', '반도체', 'KR')"));
    ok(await as(ADMIN, "insert into companies (symbol_id, name, industry, country) values ('KR.005930', '삼성전자', '반도체', 'KR')"));
    assert.equal((await as(null, "select * from companies")).length, 1);
  });

  it("경제 지도 시드: 두 번 실행해도 회사·본사 위치가 한 번씩만 들어간다", async () => {
    const seed = await readFile(new URL("../supabase/seeds/2026_company_locations.sql", import.meta.url), "utf8");
    await db.exec(seed);
    await db.exec(seed);
    // 위 테스트에서 관리자가 이미 넣은 삼성전자도 본사 위치가 생긴다
    assert.equal((await as(null, "select * from companies")).length, 48);
    const locations = await as(null, "select precision from company_locations where kind = 'hq'");
    assert.equal(locations.length, 48);
    assert.ok(locations.some((l) => l.precision === "approx"));
    rejected(await as(A, "insert into company_locations (company_id, kind, label, address, lat, lng, source_url, verified_at) select id, 'plant', 'x', 'x', 0, 0, 'https://x', current_date from companies limit 1"));
  });

  it("2026 경제 일정 시드: 두 번 실행해도 한 번만 들어가고, 시각이 서울 기준으로 맞다", async () => {
    const seed = await readFile(new URL("../supabase/seeds/2026_economic_events.sql", import.meta.url), "utf8");
    await db.exec(seed);
    await db.exec(seed);
    const rows = await as(null, "select title, scheduled_at from economic_events order by scheduled_at");
    assert.equal(rows.length, 22);
    rejected(await as(A, "insert into economic_events (country, category, title, scheduled_at, source) values ('KR', 'rate', '가짜', now(), 'x')"));
    // FOMC 10월: 미 서머타임 중 14:00 ET → 서울 10월 29일 03:00
    const [{ seoul }] = (
      await db.query("select to_char(scheduled_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as seoul from economic_events where title like 'FOMC%' and scheduled_at > '2026-10-01' and scheduled_at < '2026-11-01'")
    ).rows;
    assert.equal(seoul, "2026-10-29 03:00");
    // CPI 11월 10일: 서머타임이 끝난 뒤라 08:30 ET → 서울 22:30
    const [{ cpi }] = (
      await db.query("select to_char(scheduled_at at time zone 'Asia/Seoul', 'YYYY-MM-DD HH24:MI') as cpi from economic_events where title like '%CPI%10월분'")
    ).rows;
    assert.equal(cpi, "2026-11-10 22:30");
  });
});

describe("신고", () => {
  it("본인 신고만 보이고, 처리는 관리자만 한다", async () => {
    await resetRateLimit();
    const [{ id: target }] = ok(await as(B, "insert into posts (board, title, body) values ('company', '분석', '내용') returning id"));
    const [report] = ok(await as(A, "insert into reports (post_id, reason) values ($1, '스팸') returning id", [target]));
    rejected(await as(A, "insert into reports (post_id, reason) values ($1, '또 신고')", [target]));
    assert.equal((await as(B, "select * from reports")).length, 0);
    await as(A, "update reports set status = 'resolved' where id = $1", [report.id]);
    const [mine] = await as(A, "select status from reports where id = $1", [report.id]);
    assert.equal(mine.status, "open", "신고자가 직접 처리할 수 없음");
    ok(await as(ADMIN, "update reports set status = 'resolved' where id = $1", [report.id]));
  });

  it("본인 글·댓글은 신고할 수 없다", async () => {
    await resetRateLimit();
    const [{ id: own }] = ok(await as(B, "insert into posts (board, title, body) values ('free', '내 글', '내용') returning id"));
    rejected(await as(B, "insert into reports (post_id, reason) values ($1, '스팸')", [own]));
    const [{ id: comment }] = ok(await as(B, "insert into comments (post_id, body) values ($1, '내 댓글') returning id", [own]));
    rejected(await as(B, "insert into reports (comment_id, reason) values ($1, '스팸')", [comment]));
    ok(await as(A, "insert into reports (comment_id, reason) values ($1, '스팸')", [comment]));
  });
});

describe("피드 글", () => {
  it("피드 글은 500자까지, 게시판 글은 더 길게 쓸 수 있다", async () => {
    await resetRateLimit();
    ok(await as(B, "insert into posts (board, body) values ('sns', repeat('a', 500))"));
    rejected(await as(B, "insert into posts (board, body) values ('sns', repeat('a', 501))"));
    ok(await as(B, "insert into posts (board, title, body) values ('free', '긴 글', repeat('a', 2000))"));
  });
});

describe("계정 삭제", () => {
  it("개인 데이터는 지워지고 게시글은 작성자 없이 남는다", async () => {
    await resetRateLimit();
    const [post] = await as(A, "insert into posts (board, title, body) values ('free', '남길 글', '내용') returning id");
    ok(await as(A, "select delete_my_account()"));
    assert.equal((await db.query("select * from public.transactions where user_id = $1", [A])).rows.length, 0);
    assert.equal((await db.query("select * from public.profiles where id = $1", [A])).rows.length, 0);
    const { rows } = await db.query("select author_id from public.posts where id = $1", [post.id]);
    assert.equal(rows[0].author_id, null);
  });

  it("비로그인은 계정 삭제 함수를 실행할 수 없다", async () => {
    rejected(await as(null, "select delete_my_account()"));
  });
});
