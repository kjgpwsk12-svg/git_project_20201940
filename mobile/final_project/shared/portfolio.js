// 투자 기록 계산: 보유 수량, 평균단가(이동평균법), 실현손익, 배당.
// 브라우저와 테스트가 함께 쓴다. DB의 transactions 행을 그대로 받는다.

export const TX_TYPES = {
  buy: "매수",
  sell: "매도",
  dividend: "배당",
  split: "분할·병합",
};

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

/** 거래 순서: 거래 시각 → 같은 시각 안의 순서 → 입력 순서 */
export function sortTransactions(rows) {
  return [...rows].sort(
    (a, b) => new Date(a.traded_at) - new Date(b.traded_at) || (a.seq ?? 0) - (b.seq ?? 0) || a.id - b.id,
  );
}

/**
 * 종목별 보유 현황을 계산한다.
 * - 매수: 수량을 더하고, (수량×가격 + 수수료 + 세금)을 원가에 더한다.
 * - 매도: 평균단가만큼 원가를 빼고, (매도금액 - 수수료 - 세금 - 빠진 원가)를 실현손익에 더한다.
 * - 배당: 입금액을 배당 합계에 더한다.
 * - 분할·병합: 수량에 비율을 곱한다 (원가는 그대로이므로 평균단가가 바뀐다).
 * 가진 수량보다 많이 팔면 경고를 남기고 가진 수량까지만 판 것으로 계산한다.
 * 원화 기준 값(costKrw, realizedKrw, dividendsKrw)은 달러 거래에 거래 당시 환율(fx_rate)이 모두 있을 때만 계산하고,
 * 하나라도 없으면 null로 두어 화면에서 현재 환율로 환산한다.
 * @returns {{ holdings: Holding[], warnings: { id: number, message: string }[] }}
 */
export function computeHoldings(rows) {
  const bySymbol = new Map();
  const warnings = [];
  for (const tx of sortTransactions(rows)) {
    let h = bySymbol.get(tx.symbol_id);
    if (!h) {
      const krw = tx.currency === "KRW";
      h = {
        symbolId: tx.symbol_id,
        currency: tx.currency,
        quantity: 0,
        cost: 0,
        realized: 0,
        dividends: 0,
        fees: 0,
        invested: 0,
        costKrw: 0,
        realizedKrw: 0,
        dividendsKrw: 0,
        fxKnown: { cost: true, realized: true, dividends: true },
        krw,
      };
      bySymbol.set(tx.symbol_id, h);
    }
    const quantity = num(tx.quantity);
    const price = num(tx.price);
    const fee = num(tx.fee) ?? 0;
    const tax = num(tx.tax) ?? 0;
    h.fees += fee + tax;
    // 원화로 바꾸는 비율: 원화 거래는 1, 달러 거래는 거래 당시 환율 (없으면 null)
    const fx = h.krw ? 1 : num(tx.fx_rate);
    if (tx.type === "buy") {
      h.quantity += quantity;
      h.cost += quantity * price + fee + tax;
      h.invested += quantity * price + fee + tax;
      if (fx === null) h.fxKnown.cost = false;
      else h.costKrw += (quantity * price + fee + tax) * fx;
    } else if (tx.type === "sell") {
      let sold = quantity;
      if (sold > h.quantity + 1e-9) {
        warnings.push({ id: tx.id, message: `보유 수량(${round(h.quantity)})보다 많이 팔았어요. 손익은 ${round(h.quantity)}주까지만 계산했어요. 이전 매수 기록이 빠졌는지 확인해 주세요.` });
        sold = h.quantity;
      }
      if (sold <= 0) continue;
      const costOut = h.quantity > 0 ? (h.cost / h.quantity) * sold : 0;
      const costOutKrw = h.quantity > 0 ? (h.costKrw / h.quantity) * sold : 0;
      // 매도 금액은 실제로 판 수량 기준 (초과분은 계산하지 않음)
      const proceeds = sold * price - (fee + tax) * (sold / quantity);
      h.realized += proceeds - costOut;
      if (fx === null || !h.fxKnown.cost) h.fxKnown.realized = false;
      else h.realizedKrw += proceeds * fx - costOutKrw;
      h.cost -= costOut;
      h.costKrw -= costOutKrw;
      h.quantity -= sold;
    } else if (tx.type === "dividend") {
      h.dividends += num(tx.amount);
      if (fx === null) h.fxKnown.dividends = false;
      else h.dividendsKrw += num(tx.amount) * fx;
    } else if (tx.type === "split") {
      h.quantity *= num(tx.split_ratio);
    }
    // 부동소수점 찌꺼기 정리: 다 팔았으면 원가도 0
    if (Math.abs(h.quantity) < 1e-9) {
      h.quantity = 0;
      h.cost = 0;
      h.costKrw = 0;
    }
  }
  const holdings = [...bySymbol.values()].map(({ fxKnown, krw, ...h }) => ({
    ...h,
    avgPrice: h.quantity > 0 ? h.cost / h.quantity : 0,
    costKrw: fxKnown.cost ? h.costKrw : null,
    realizedKrw: fxKnown.realized ? h.realizedKrw : null,
    dividendsKrw: fxKnown.dividends ? h.dividendsKrw : null,
  }));
  return { holdings, warnings };
}

/**
 * 현재가를 붙여 평가금액·평가손익을 계산한다. 원화 합계는 USD에 환율을 곱한다.
 * @param {ReturnType<typeof computeHoldings>["holdings"]} holdings
 * @param {Record<string, number | undefined>} prices 종목 ID → 현재가
 * @param {number | null} usdKrw 원/달러 환율. 없으면 달러 자산은 원화 합계에서 빠진다.
 */
export function valuePortfolio(holdings, prices, usdKrw) {
  const toKrw = (value, currency) => (currency === "KRW" ? value : usdKrw ? value * usdKrw : null);
  const rows = holdings
    .filter((h) => h.quantity > 0)
    .map((h) => {
      const price = prices[h.symbolId];
      const value = price === undefined ? null : price * h.quantity;
      const profit = value === null ? null : value - h.cost;
      return {
        ...h,
        price: price ?? null,
        value,
        profit,
        profitRate: profit === null || h.cost === 0 ? null : (profit / h.cost) * 100,
        valueKrw: value === null ? null : toKrw(value, h.currency),
        // 거래 당시 환율이 모두 있으면 그 원가, 아니면 현재 환율로 환산
        costKrw: h.costKrw ?? toKrw(h.cost, h.currency),
        fxFromTrades: h.currency === "USD" && h.costKrw !== null,
      };
    });
  const known = rows.filter((r) => r.valueKrw !== null && r.costKrw !== null);
  const totalValue = known.reduce((s, r) => s + r.valueKrw, 0);
  const totalCost = known.reduce((s, r) => s + r.costKrw, 0);
  const realizedKrw = holdings.reduce((s, h) => s + (h.realizedKrw ?? toKrw(h.realized, h.currency) ?? 0), 0);
  const dividendsKrw = holdings.reduce((s, h) => s + (h.dividendsKrw ?? toKrw(h.dividends, h.currency) ?? 0), 0);
  for (const r of rows) r.weight = r.valueKrw !== null && totalValue > 0 ? (r.valueKrw / totalValue) * 100 : null;
  return {
    rows: rows.sort((a, b) => (b.valueKrw ?? -1) - (a.valueKrw ?? -1)),
    totalValue,
    totalCost,
    totalProfit: totalValue - totalCost,
    totalRate: totalCost > 0 ? ((totalValue - totalCost) / totalCost) * 100 : null,
    realizedKrw,
    dividendsKrw,
    // 현재가나 환율이 없어 합계에서 빠진 종목 수
    missing: rows.length - known.length,
  };
}

/** 거래 한 건의 금액 (표시용): 매수·매도는 수량×가격, 배당은 입금액 */
export function transactionAmount(tx) {
  if (tx.type === "buy" || tx.type === "sell") return num(tx.quantity) * num(tx.price);
  if (tx.type === "dividend") return num(tx.amount);
  return null;
}

/**
 * 입력 검증. DB CHECK 제약(supabase/schema.sql)과 같은 기준.
 * @returns {Record<string, string>} 필드 이름 → 오류 문장 (비어 있으면 통과)
 */
export function validateTransaction(input) {
  const errors = {};
  const positive = (v) => v !== null && Number.isFinite(v) && v > 0;
  const nonNegative = (v) => v !== null && Number.isFinite(v) && v >= 0;
  if (!TX_TYPES[input.type]) errors.type = "거래 유형을 골라 주세요.";
  if (!input.symbol_id) errors.symbol_id = "종목을 골라 주세요.";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date ?? "")) errors.date = "거래일을 입력해 주세요.";
  else if (new Date(`${input.date}T00:00:00+09:00`) > new Date()) errors.date = "미래 날짜는 입력할 수 없어요.";
  const quantity = num(input.quantity);
  const price = num(input.price);
  if (input.type === "buy" || input.type === "sell") {
    if (!positive(quantity)) errors.quantity = "수량은 0보다 커야 해요.";
    if (!nonNegative(price)) errors.price = "가격을 입력해 주세요.";
  }
  if (input.type === "dividend" && !positive(num(input.amount))) errors.amount = "입금액은 0보다 커야 해요.";
  if (input.type === "split" && !positive(num(input.split_ratio))) errors.split_ratio = "비율은 0보다 커야 해요. (예: 1주→4주면 4)";
  for (const key of ["fee", "tax"]) {
    const v = num(input[key]);
    if (v !== null && !nonNegative(v)) errors[key] = "0 이상으로 입력해 주세요.";
  }
  const fx = num(input.fx_rate);
  if (fx !== null && !positive(fx)) errors.fx_rate = "환율은 0보다 커야 해요.";
  if ((input.memo ?? "").length > 500) errors.memo = "메모는 500자 이하로 써 주세요.";
  return errors;
}

/** 서울 시간 기준 날짜 문자열 (YYYY-MM-DD) */
export function seoulDate(iso) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul" }).format(new Date(iso));
}

/** 달력: 해당 월의 날짜 칸 (앞뒤 빈칸 포함, 일요일 시작) */
export function monthGrid(year, month) {
  const first = new Date(Date.UTC(year, month - 1, 1)).getUTCDay();
  const days = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const cells = Array.from({ length: first }, () => null);
  for (let d = 1; d <= days; d++) cells.push(`${year}-${String(month).padStart(2, "0")}-${String(d).padStart(2, "0")}`);
  while (cells.length % 7) cells.push(null);
  return cells;
}

const round = (v) => Math.round(v * 1e6) / 1e6;
