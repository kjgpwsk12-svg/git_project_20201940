import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearCache, cached } from "../server/cache.js";
import { demoCandles, demoNews, recentWeekdays } from "../server/demo-data.js";
import { createMarketService } from "../server/market.js";
import { createIndicatorsProvider, parseEcosRates, parseFredObservations, summarize, toYoY } from "../server/providers/indicators.js";
import { cleanText, naverNewsEndpoint } from "../server/providers/news.js";
import { formatIndicatorChange, formatIndicatorValue } from "../shared/indicator-format.js";
import { assignNewsToTradingDays, buildNewsMarkers } from "../shared/news-markers.js";
import { formatChange, formatPercent, formatPrice } from "../shared/format.js";
import { marketStatus } from "../shared/market-hours.js";
import { parseSymbolId, searchCatalog, symbolId } from "../shared/symbols.js";

describe("종목 ID", () => {
  it("국내·미국 ID를 오가며 변환한다", () => {
    for (const id of ["KR.005930", "US.NAS.AAPL", "US.AMS.SPY"]) {
      assert.equal(symbolId(parseSymbolId(id)), id);
    }
  });

  it("잘못된 형식은 거부한다", () => {
    for (const id of ["", "KR.5930", "US.AAPL", "US.XXX.AAPL", "JP.7203", "KR.005930.X", "US.NAS.<b>", null]) {
      assert.equal(parseSymbolId(id), null, String(id));
    }
  });

  it("이름과 코드로 검색한다", () => {
    assert.equal(searchCatalog("삼성전자")[0].symbol.code, "005930");
    assert.equal(searchCatalog("aapl")[0].name, "Apple");
    assert.deepEqual(searchCatalog("   "), []);
  });
});

describe("표시 형식", () => {
  it("시장별 가격과 부호", () => {
    assert.equal(formatPrice(71500, "KR"), "71,500원");
    assert.equal(formatPrice(1234.5, "US"), "$1,234.50");
    assert.equal(formatChange(-1500, "KR"), "−1,500");
    assert.equal(formatPercent(2.345), "+2.35%");
    assert.equal(formatPercent(0), "0.00%");
  });
});

describe("데모 데이터", () => {
  const symbol = { market: "KR", code: "005930" };

  it("평일만, 오래된 순으로 만든다", () => {
    const days = recentWeekdays("2026-10-12", 6);
    assert.deepEqual(days, ["2026-10-05", "2026-10-06", "2026-10-07", "2026-10-08", "2026-10-09", "2026-10-12"]);
  });

  it("같은 입력이면 같은 결과", () => {
    assert.deepEqual(demoCandles(symbol, "2026-10-12"), demoCandles(symbol, "2026-10-12"));
  });

  it("일봉 값이 일관된다 (고가 ≥ 시가·종가 ≥ 저가 > 0)", () => {
    for (const c of demoCandles({ market: "US", exchange: "NAS", code: "NVDA" }, "2026-10-12")) {
      assert.ok(c.high >= Math.max(c.open, c.close) && Math.min(c.open, c.close) >= c.low && c.low > 0, c.date);
    }
  });

  it("데모 뉴스가 큰 움직임과 연결된다", () => {
    const candles = demoCandles(symbol, "2026-10-12");
    const news = demoNews(symbol, "삼성전자", "2026-10-12");
    const markers = buildNewsMarkers(candles, assignNewsToTradingDays(news, candles, "KR"));
    assert.ok(markers.filter((m) => m.kind !== "flat").length >= 3);
  });
});

describe("뉴스 정리", () => {
  it("네이버 강조 태그와 엔티티를 제거한다", () => {
    assert.equal(cleanText("<b>삼성전자</b> &quot;실적&quot; &amp; 전망"), '삼성전자 "실적" & 전망');
  });
});

describe("캐시", () => {
  it("유효 시간 안에는 다시 불러오지 않는다", async () => {
    clearCache();
    let calls = 0;
    const load = async () => ++calls;
    await cached("k", 60_000, load);
    const second = await cached("k", 60_000, load);
    assert.equal(calls, 1);
    assert.equal(second.value, 1);
  });

  it("갱신에 실패하면 이전 값을 stale로 돌려준다", async () => {
    clearCache();
    await cached("k", 0, async () => "old");
    const result = await cached("k", 0, async () => {
      throw new Error("down");
    });
    assert.equal(result.value, "old");
    assert.equal(result.stale, true);
  });

  it("이전 값이 없으면 오류를 던진다", async () => {
    clearCache();
    await assert.rejects(
      cached("k", 0, async () => {
        throw new Error("down");
      }),
    );
  });
});

describe("장 운영 상태", () => {
  it("한국: 평일 장중, 개장 전, 마감, 주말", () => {
    assert.equal(marketStatus("KR", new Date("2026-10-12T10:00:00+09:00")).label, "장중");
    assert.equal(marketStatus("KR", new Date("2026-10-12T08:59:00+09:00")).label, "개장 전");
    assert.equal(marketStatus("KR", new Date("2026-10-12T15:30:00+09:00")).label, "장 마감");
    assert.equal(marketStatus("KR", new Date("2026-10-11T10:00:00+09:00")).label, "장 마감");
  });

  it("미국: 뉴욕 시간 기준 (서머타임 반영)", () => {
    // 2026-10-12 09:30 EDT = 13:30 UTC
    assert.equal(marketStatus("US", new Date("2026-10-12T13:30:00Z")).state, "open");
    assert.equal(marketStatus("US", new Date("2026-10-12T13:29:00Z")).state, "closed");
    // 2026-12-01 09:30 EST = 14:30 UTC
    assert.equal(marketStatus("US", new Date("2026-12-01T14:00:00Z")).label, "개장 전");
  });
});

describe("네이버 뉴스 접속 정보", () => {
  it("HUB 키가 있으면 HUB, 아니면 개발자센터, 둘 다 없으면 null", () => {
    assert.equal(naverNewsEndpoint({}), null);
    assert.match(naverNewsEndpoint({ NAVER_CLIENT_ID: "a", NAVER_CLIENT_SECRET: "b" }).url, /openapi\.naver\.com/);
    const hub = naverNewsEndpoint({ NAVER_CLIENT_ID: "a", NAVER_CLIENT_SECRET: "b", NAVER_HUB_CLIENT_ID: "c", NAVER_HUB_CLIENT_SECRET: "d" });
    assert.match(hub.url, /naverapihub/);
    assert.equal(hub.headers["X-NCP-APIGW-API-KEY-ID"], "c");
  });
  it("시세 키 없이 네이버 키만 있어도 시장 뉴스는 실제 기사, 종목 뉴스는 데모 유지", () => {
    const status = createMarketService({ NAVER_CLIENT_ID: "a", NAVER_CLIENT_SECRET: "b" }).status();
    assert.equal(status.marketNewsLabel, "네이버 뉴스 검색");
    assert.equal(status.newsLabel.KR, "데모 뉴스");
    assert.equal(createMarketService({}).status().marketNewsLabel, "데모 뉴스");
    // 네이버 검색 결과는 서버에 캐시하지 않는다 (약관)
    assert.equal(status.marketNewsCached, false);
    assert.equal(createMarketService({}).status().marketNewsCached, true);
  });
});


// 한국은행 ECOS 일별 응답 형식의 예시 (값은 테스트용)
const ecosBody = (rows, item = "한국은행 기준금리") => ({
  StatisticSearch: { list_total_count: rows.length, row: rows.map(([time, v]) => ({ STAT_CODE: "722Y001", ITEM_NAME1: item, TIME: time, DATA_VALUE: v })) },
});

describe("경제 지표 자료 읽기 (공식 API)", () => {
  it("FRED: 결측('.')과 형식이 틀린 값은 버린다", () => {
    const body = { observations: [{ date: "2026-10-08", value: "5.22" }, { date: "2026-10-09", value: "." }, { date: "bad", value: "1" }, { date: "2026-10-10", value: "abc" }, { date: "2026-10-13", value: "5.24" }] };
    assert.deepEqual(parseFredObservations(body), [{ date: "2026-10-08", value: 5.22 }, { date: "2026-10-13", value: 5.24 }]);
    assert.throws(() => parseFredObservations({ error_code: 400, error_message: "Bad Request. The value for variable api_key is not registered." }), /api_key/);
  });

  it("ECOS: 바뀐 날과 마지막 관측일만 남긴다", () => {
    const body = ecosBody([["20250528", "2.75"], ["20250529", "2.5"], ["20250530", "2.5"], ["20260827", "3.0"], ["20261013", "3.0"]]);
    assert.deepEqual(parseEcosRates(body, "기준금리"), [
      { date: "2025-05-28", value: 2.75 },
      { date: "2025-05-29", value: 2.5 },
      { date: "2026-08-27", value: 3 },
      { date: "2026-10-13", value: 3 },
    ]);
  });

  it("ECOS: 기대한 통계(기준금리)가 아니면 숫자를 쓰지 않는다", () => {
    assert.throws(() => parseEcosRates(ecosBody([["20261013", "3.5"]], "콜금리"), "기준금리"), /통계 코드/);
    assert.throws(() => parseEcosRates({ RESULT: { CODE: "INFO-100", MESSAGE: "인증키가 유효하지 않습니다." } }), /인증키/);
    assert.throws(() => parseEcosRates(ecosBody([]), "기준금리"), /자료가 없어요/);
  });

  it("물가지수 → 1년 전 같은 달 대비 상승률, 1년 전 값이 없으면 만들지 않음", () => {
    assert.deepEqual(toYoY([{ date: "2025-01-01", value: 100 }, { date: "2026-01-01", value: 103 }]), [{ date: "2026-01-01", value: 3 }]);
    assert.deepEqual(toYoY([{ date: "2026-01-01", value: 103 }]), []);
  });

  it("정책 금리는 마지막으로 바뀐 값과 비교하고, 변화는 %p로", () => {
    const s = summarize({ id: "KRRATE", unit: "%", compare: "lastChange" }, [
      { date: "2026-07-16", value: 2.75 },
      { date: "2026-08-27", value: 3 },
      { date: "2026-10-13", value: 3 },
    ]);
    assert.equal(s.previous.value, 2.75);
    assert.equal(s.date, "2026-10-13");
    assert.equal(formatIndicatorChange(s), "▲ 0.25%p");
  });

  it("금리차는 음수도 정상 값", () => {
    const s = summarize({ id: "SPREAD", unit: "%p" }, [{ date: "2026-10-09", value: 0.1 }, { date: "2026-10-13", value: -0.2 }]);
    assert.equal(formatIndicatorValue(s), "-0.20%p");
    assert.equal(formatIndicatorChange(s), "▼ 0.30%p");
    assert.equal(formatIndicatorValue({ unit: "원", value: 1342.13 }), "1,342.13원");
    assert.equal(formatIndicatorChange({ unit: "$", change: 0 }), "변동 없음");
  });

  it("키가 없으면 지표를 쓰지 않고, 한쪽 키만 있으면 그쪽 지표만 나온다", async () => {
    assert.equal(createIndicatorsProvider({}).available, false);
    const calls = [];
    const fake = (url) => {
      calls.push(String(url));
      // 30개월치 월별 값 (물가 상승률 계산에 1년 전 값이 필요)
      const observations = Array.from({ length: 30 }, (_, i) => ({ date: `${2024 + Math.floor(i / 12)}-${String((i % 12) + 1).padStart(2, "0")}-01`, value: String(100 + i) }));
      return Promise.resolve(new Response(JSON.stringify({ observations })));
    };
    const provider = createIndicatorsProvider({ fredKey: "k" }, fake);
    const list = await provider.getIndicators();
    assert.match(list.find((i) => i.id === "KRRATE").error, /ECOS/);
    assert.ok(list.filter((i) => i.id !== "KRRATE").every((i) => !i.error));
    // 모든 요청은 공식 API 주소로만 간다
    assert.ok(calls.every((u) => u.startsWith("https://api.stlouisfed.org/fred/series/observations")));
  });
});
