import assert from "node:assert/strict";
import { after, before, describe, it } from "node:test";
import { createMarketService } from "../server/market.js";
import { createIndicatorsProvider } from "../server/providers/indicators.js";
import { createApp } from "../server/server.js";

/** 테스트는 실제 FRED·ECOS에 접속하지 않는다: 같은 형식의 가짜 응답 */
function fakeFetch(url) {
  const u = String(url);
  // 2024-01부터 30개월치 월별 값 (물가 상승률 계산에 1년 전 값이 필요)
  const months = Array.from({ length: 30 }, (_, i) => ({ date: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value: String(100 + i) }));
  const body = u.includes("ecos.bok.or.kr")
    ? { StatisticSearch: { row: [["20250529", "2.5"], ["20260827", "3.0"]].map(([TIME, DATA_VALUE]) => ({ ITEM_NAME1: "한국은행 기준금리", TIME, DATA_VALUE })) } }
    : { observations: months };
  return Promise.resolve(new Response(JSON.stringify(body), { status: 200 }));
}

/** 데모 모드(키 없음)로 서버를 띄워 API를 확인한다 */
function startServer(env = {}) {
  env = { indicators: createIndicatorsProvider({ fredKey: "test", ecosKey: "test" }, fakeFetch), ...env };
  const app = createApp(createMarketService(env), env);
  return new Promise((resolve) => {
    const server = app.listen(0, () => resolve({ server, base: `http://localhost:${server.address().port}` }));
  });
}

describe("API (데모 모드)", () => {
  let server, base;
  before(async () => ({ server, base } = await startServer()));
  after(() => server.close());

  it("상태: 데모 표시", async () => {
    const body = await (await fetch(`${base}/api/status`)).json();
    assert.equal(body.isDemo, true);
  });

  it("주요 지수·환율과 추이 데이터", async () => {
    const body = await (await fetch(`${base}/api/indices`)).json();
    assert.deepEqual(body.value.map((i) => i.id), ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW", "DJI"]);
    assert.ok(body.value.every((i) => i.spark.length === 30));
    assert.equal(body.stale, false);
  });

  it("지수 차트, 경제 지표, 시장 뉴스", async () => {
    const candles = await (await fetch(`${base}/api/indices/KOSPI/candles`)).json();
    assert.ok(candles.value.length > 100);
    assert.equal((await fetch(`${base}/api/indices/NOPE/candles`)).status, 404);
    const indicators = await (await fetch(`${base}/api/indicators`)).json();
    assert.equal(indicators.available, true);
    assert.ok(indicators.value.length >= 5);
    assert.ok(indicators.value.every((i) => !i.error), JSON.stringify(indicators.value.find((i) => i.error)));
    const kr = indicators.value.find((i) => i.id === "KRRATE");
    assert.equal(kr.value, 3);
    assert.equal(kr.previous.value, 2.5);
    const history = await (await fetch(`${base}/api/indicators/CPI/history`)).json();
    assert.ok(history.value.length > 0);
    assert.equal((await fetch(`${base}/api/indicators/NOPE/history`)).status, 404);
    const news = await (await fetch(`${base}/api/market-news`)).json();
    assert.equal(news.available, true);
    assert.ok(news.value.every((n) => n.title.startsWith("[데모]")));
  });

  it("관심 종목 시세: 잘못된 ID는 건너뛴다", async () => {
    const body = await (await fetch(`${base}/api/quotes?ids=KR.005930,bad,US.NAS.AAPL`)).json();
    assert.deepEqual(
      body.results.map((r) => r.id),
      ["KR.005930", "US.NAS.AAPL"],
    );
    assert.ok(body.results.every((r) => r.quote.price > 0));
  });

  it("종목 상세: 시세·일봉·뉴스", async () => {
    const body = await (await fetch(`${base}/api/stocks/US.NAS.NVDA`)).json();
    assert.equal(body.quote.value.name, "NVIDIA");
    assert.ok(body.candles.value.length > 100);
    assert.ok(body.news.length > 0);
    assert.equal(body.newsUnavailable, null);
  });

  it("없는 종목 주소는 404", async () => {
    const res = await fetch(`${base}/api/stocks/nope`);
    assert.equal(res.status, 404);
  });

  it("화면과 공용 모듈, 차트 라이브러리를 제공한다", async () => {
    for (const path of [
      "/", "/stocks", "/stock", "/login", "/signup", "/forgot", "/reset", "/mypage", "/terms", "/privacy",
      "/css/app.css", "/css/pages.css", "/js/theme-init.js", "/js/pages/stock.js", "/js/core/shell.js", "/shared/symbols.js", "/vendor/lightweight-charts.mjs", "/vendor/supabase.js", "/vendor/PretendardVariable.woff2", "/vendor/leaflet.mjs", "/vendor/leaflet.css", "/images/logo.webp", "/images/favicon.png",
    ]) {
      const res = await fetch(`${base}${path}`);
      assert.equal(res.status, 200, path);
    }
    assert.match((await fetch(`${base}/vendor/lightweight-charts.mjs`)).headers.get("content-type"), /javascript/);
  });
});

describe("Supabase 공개 설정", () => {
  it("설정이 없으면 null", async () => {
    const { server, base } = await startServer();
    const body = await (await fetch(`${base}/api/config`)).json();
    server.close();
    assert.equal(body.supabase, null);
  });

  it("URL과 공개 키만 내보내고 CSP에 Supabase 주소를 허용한다", async () => {
    const env = {
      SUPABASE_URL: "https://abc.supabase.co/rest/v1/",
      SUPABASE_ANON_KEY: "sb_publishable_test",
      SUPABASE_SERVICE_ROLE_KEY: "must-not-leak",
    };
    const { server, base } = await startServer(env);
    const res = await fetch(`${base}/api/config`);
    const text = await res.text();
    server.close();
    assert.deepEqual(JSON.parse(text).supabase, { url: "https://abc.supabase.co", anonKey: "sb_publishable_test" });
    assert.ok(!text.includes("must-not-leak"));
    assert.match(res.headers.get("content-security-policy"), /connect-src 'self' https:\/\/abc\.supabase\.co wss:\/\/abc\.supabase\.co/);
  });
});

describe("접근 비밀번호", () => {
  let server, base;
  before(async () => ({ server, base } = await startServer({ SITE_PASSWORD: "secret" })));
  after(() => server.close());

  it("비밀번호 없이는 401", async () => {
    assert.equal((await fetch(`${base}/`)).status, 401);
  });

  it("맞는 비밀번호면 통과", async () => {
    const auth = `Basic ${Buffer.from("me:secret").toString("base64")}`;
    assert.equal((await fetch(`${base}/`, { headers: { authorization: auth } })).status, 200);
  });

  it("틀린 비밀번호는 401", async () => {
    const auth = `Basic ${Buffer.from("me:nope").toString("base64")}`;
    assert.equal((await fetch(`${base}/`, { headers: { authorization: auth } })).status, 401);
  });
});

describe("시장 뉴스 주제·검색", () => {
  it("주제와 검색어로 거른다 (데모)", async () => {
    const { server, base } = await startServer();
    try {
      const fx = await (await fetch(`${base}/api/market-news?topic=fx`)).json();
      assert.ok(fx.value.length > 0 && fx.value.every((n) => n.topic === "fx"));
      const search = await (await fetch(`${base}/api/market-news?q=${encodeURIComponent("금값")}`)).json();
      assert.ok(search.value.length >= 1 && search.value.every((n) => n.title.includes("금값") || n.category.includes("금값")));
      // 모르는 주제는 전체로
      const all = await (await fetch(`${base}/api/market-news?topic=nope`)).json();
      assert.ok(all.value.length >= 18);
    } finally {
      server.close();
    }
  });
});
