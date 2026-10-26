import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeHoldings, monthGrid, seoulDate, validateTransaction, valuePortfolio } from "../shared/portfolio.js";

let nextId = 1;
const tx = (type, fields) => ({
  id: nextId++,
  symbol_id: "KR.005930",
  currency: "KRW",
  type,
  traded_at: "2026-01-01T00:00:00+09:00",
  seq: 0,
  quantity: null,
  price: null,
  amount: null,
  split_ratio: null,
  fee: 0,
  tax: 0,
  ...fields,
});

const close = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-6, `${actual} ≠ ${expected}`);

describe("투자 기록 계산", () => {
  it("매수를 여러 번 하면 이동평균 단가가 된다 (수수료 포함)", () => {
    const { holdings } = computeHoldings([
      tx("buy", { quantity: 10, price: 70000, fee: 100, traded_at: "2026-01-02T00:00:00+09:00" }),
      tx("buy", { quantity: 10, price: 80000, fee: 100, traded_at: "2026-01-03T00:00:00+09:00" }),
    ]);
    const [h] = holdings;
    assert.equal(h.quantity, 20);
    close(h.cost, 1_500_200);
    close(h.avgPrice, 75_010);
  });

  it("매도하면 평균단가 기준으로 실현손익을 계산하고, 평균단가는 그대로다", () => {
    const { holdings } = computeHoldings([
      tx("buy", { quantity: 10, price: 70000, traded_at: "2026-01-02T00:00:00+09:00" }),
      tx("sell", { quantity: 4, price: 80000, fee: 200, tax: 600, traded_at: "2026-01-05T00:00:00+09:00" }),
    ]);
    const [h] = holdings;
    assert.equal(h.quantity, 6);
    close(h.avgPrice, 70000);
    close(h.realized, 4 * 80000 - 800 - 4 * 70000);
  });

  it("입력 순서와 관계없이 거래일 순서로 계산한다", () => {
    const { holdings, warnings } = computeHoldings([
      tx("sell", { quantity: 5, price: 90000, traded_at: "2026-02-01T00:00:00+09:00" }),
      tx("buy", { quantity: 5, price: 70000, traded_at: "2026-01-01T00:00:00+09:00" }),
    ]);
    assert.equal(warnings.length, 0);
    assert.equal(holdings[0].quantity, 0);
    close(holdings[0].realized, 100000);
  });

  it("가진 것보다 많이 팔면 경고하고 가진 수량까지만 계산한다", () => {
    const sell = tx("sell", { quantity: 15, price: 80000, traded_at: "2026-01-05T00:00:00+09:00" });
    const { holdings, warnings } = computeHoldings([tx("buy", { quantity: 10, price: 70000 }), sell]);
    assert.equal(warnings.length, 1);
    assert.equal(warnings[0].id, sell.id);
    assert.equal(holdings[0].quantity, 0);
    close(holdings[0].realized, 10 * 10000);
  });

  it("분할하면 수량이 늘고 평균단가가 줄며, 배당은 따로 모은다", () => {
    const { holdings } = computeHoldings([
      tx("buy", { quantity: 10, price: 400 }),
      tx("split", { split_ratio: 4, traded_at: "2026-03-01T00:00:00+09:00" }),
      tx("dividend", { amount: 1234, traded_at: "2026-04-01T00:00:00+09:00" }),
    ]);
    const [h] = holdings;
    assert.equal(h.quantity, 40);
    close(h.avgPrice, 100);
    close(h.dividends, 1234);
  });

  it("평가: 원화 합계에 달러 자산은 환율을 곱하고, 비중을 계산한다", () => {
    const { holdings } = computeHoldings([
      tx("buy", { quantity: 10, price: 70000 }),
      tx("buy", { symbol_id: "US.NAS.AAPL", currency: "USD", quantity: 2, price: 200 }),
    ]);
    const result = valuePortfolio(holdings, { "KR.005930": 77000, "US.NAS.AAPL": 250 }, 1400);
    close(result.totalValue, 770000 + 2 * 250 * 1400);
    close(result.totalCost, 700000 + 2 * 200 * 1400);
    close(result.totalProfit, 70000 + 2 * 50 * 1400);
    const aapl = result.rows.find((r) => r.symbolId === "US.NAS.AAPL");
    close(aapl.profitRate, 25);
    close(result.rows.reduce((s, r) => s + r.weight, 0), 100);
  });

  it("달러 거래에 당시 환율이 있으면 원화 원가는 그 환율로, 없으면 현재 환율로", () => {
    const withFx = computeHoldings([tx("buy", { symbol_id: "US.NAS.AAPL", currency: "USD", quantity: 2, price: 200, fx_rate: 1300 })]);
    const a = valuePortfolio(withFx.holdings, { "US.NAS.AAPL": 200 }, 1400);
    close(a.totalCost, 2 * 200 * 1300);
    close(a.totalProfit, 2 * 200 * 100); // 주가는 그대로, 환율 상승분만큼 이익
    const noFx = computeHoldings([tx("buy", { symbol_id: "US.NAS.AAPL", currency: "USD", quantity: 2, price: 200 })]);
    close(valuePortfolio(noFx.holdings, { "US.NAS.AAPL": 200 }, 1400).totalProfit, 0);
  });

  it("현재가나 환율이 없으면 합계에서 빼고 개수를 알려준다", () => {
    const { holdings } = computeHoldings([
      tx("buy", { quantity: 1, price: 100 }),
      tx("buy", { symbol_id: "US.NAS.AAPL", currency: "USD", quantity: 1, price: 1 }),
    ]);
    const result = valuePortfolio(holdings, { "KR.005930": 110, "US.NAS.AAPL": 2 }, null);
    assert.equal(result.missing, 1);
    close(result.totalValue, 110);
  });
});

describe("거래 입력 검증", () => {
  const base = { type: "buy", symbol_id: "KR.005930", date: "2026-01-02", quantity: "10", price: "70000" };
  it("정상 입력은 통과", () => assert.deepEqual(validateTransaction(base), {}));
  it("유형별 필수 값", () => {
    assert.ok(validateTransaction({ ...base, quantity: "0" }).quantity);
    assert.ok(validateTransaction({ ...base, price: "" }).price);
    assert.ok(validateTransaction({ ...base, type: "dividend", amount: "" }).amount);
    assert.ok(validateTransaction({ ...base, type: "split", split_ratio: "-1" }).split_ratio);
    assert.ok(validateTransaction({ ...base, fee: "-1" }).fee);
    assert.ok(validateTransaction({ ...base, symbol_id: null }).symbol_id);
  });
  it("미래 날짜는 거부", () => assert.ok(validateTransaction({ ...base, date: "2999-01-01" }).date));
});

describe("달력", () => {
  it("2026년 10월은 목요일에 시작하고 31일까지", () => {
    const cells = monthGrid(2026, 10);
    assert.equal(cells.indexOf("2026-10-01"), 4);
    assert.ok(cells.includes("2026-10-31"));
    assert.equal(cells.length % 7, 0);
  });
  it("서울 날짜", () => assert.equal(seoulDate("2026-10-13T16:00:00Z"), "2026-10-14"));
});
