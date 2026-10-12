import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clearCache, cached } from "../server/cache.js";
import { demoCandles, demoNews, recentWeekdays } from "../server/demo-data.js";
import { cleanText } from "../server/providers/news.js";
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
