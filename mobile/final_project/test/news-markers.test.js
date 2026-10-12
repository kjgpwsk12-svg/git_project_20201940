import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignNewsToTradingDays, buildNewsMarkers, toMarketLocal } from "../shared/news-markers.js";

const candle = (date, close) => ({ date, open: close, high: close, low: close, close, volume: 1 });
const news = (id, publishedAt) => ({ id, title: id, summary: "", url: null, source: "test", publishedAt });
const ids = (list) => list?.map((n) => n.id);

// 2026-10-08(목), 10-09(금), 10-12(월), 10-13(화)
const candles = [candle("2026-10-08", 100), candle("2026-10-09", 100), candle("2026-10-12", 105), candle("2026-10-13", 104)];

describe("toMarketLocal", () => {
  it("UTC 시각을 서울 현지 날짜·분으로 바꾼다", () => {
    assert.deepEqual(toMarketLocal("2026-10-12T15:30:00Z", "KR"), { date: "2026-10-13", minutes: 30 });
  });

  it("뉴욕은 서머타임을 반영한다", () => {
    assert.deepEqual(toMarketLocal("2026-07-01T14:00:00Z", "US"), { date: "2026-07-01", minutes: 600 });
    assert.deepEqual(toMarketLocal("2026-12-01T14:00:00Z", "US"), { date: "2026-12-01", minutes: 540 });
  });
});

describe("assignNewsToTradingDays (국내)", () => {
  it("장중 뉴스는 그 날에 배정한다", () => {
    const map = assignNewsToTradingDays([news("a", "2026-10-12T10:00:00+09:00")], candles, "KR");
    assert.deepEqual([...map.keys()], ["2026-10-12"]);
  });

  it("장 마감(15:30) 이후 뉴스는 다음 거래일에 배정한다", () => {
    const map = assignNewsToTradingDays(
      [news("a", "2026-10-12T15:29:00+09:00"), news("b", "2026-10-12T15:30:00+09:00")],
      candles,
      "KR",
    );
    assert.deepEqual(ids(map.get("2026-10-12")), ["a"]);
    assert.deepEqual(ids(map.get("2026-10-13")), ["b"]);
  });

  it("금요일 저녁과 주말 뉴스는 월요일에 배정한다", () => {
    const map = assignNewsToTradingDays(
      [news("fri", "2026-10-09T20:00:00+09:00"), news("sun", "2026-10-11T09:00:00+09:00")],
      candles,
      "KR",
    );
    assert.deepEqual(ids(map.get("2026-10-12")), ["fri", "sun"]);
  });

  it("마지막 일봉 이후 뉴스는 배정하지 않는다", () => {
    const map = assignNewsToTradingDays([news("late", "2026-10-13T18:00:00+09:00")], candles, "KR");
    assert.equal(map.size, 0);
  });
});

describe("assignNewsToTradingDays (미국)", () => {
  it("뉴욕 현지 날짜 기준으로 배정한다 (한국 시각으로는 밤)", () => {
    // 2026-10-12 10:00 EDT = 한국 시각 10-12 23:00
    const map = assignNewsToTradingDays([news("a", "2026-10-12T14:00:00Z")], candles, "US");
    assert.deepEqual([...map.keys()], ["2026-10-12"]);
  });

  it("16:00 이후 뉴스는 다음 거래일", () => {
    const map = assignNewsToTradingDays([news("a", "2026-10-12T20:30:00Z")], candles, "US");
    assert.deepEqual([...map.keys()], ["2026-10-13"]);
  });
});

describe("buildNewsMarkers", () => {
  it("등락률 기준으로 큰 움직임을 구분한다", () => {
    const byDay = assignNewsToTradingDays(
      [news("a", "2026-10-12T10:00:00+09:00"), news("b", "2026-10-13T10:00:00+09:00")],
      candles,
      "KR",
    );
    const [first, second] = buildNewsMarkers(candles, byDay, 3);
    assert.deepEqual(first, { date: "2026-10-12", newsCount: 1, changePercent: 5, kind: "up" });
    assert.equal(second.date, "2026-10-13");
    assert.equal(second.kind, "flat");
    assert.ok(Math.abs(second.changePercent - -0.952) < 0.001);
  });
});
