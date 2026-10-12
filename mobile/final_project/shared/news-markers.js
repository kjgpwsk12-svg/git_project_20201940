// 뉴스를 거래일에 배정하고 차트 표시를 만든다. 서버와 브라우저가 함께 쓰는 모듈이다.
import { MARKET_CLOSE_MINUTES, MARKET_TIMEZONE } from "./symbols.js";

/** 큰 움직임으로 보는 등락률 기준(%) */
export const BIG_MOVE_PERCENT = 3;

const formatters = new Map();

function formatterFor(timeZone) {
  let f = formatters.get(timeZone);
  if (!f) {
    f = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    });
    formatters.set(timeZone, f);
  }
  return f;
}

/** ISO 시각을 시장 현지 날짜(YYYY-MM-DD)와 자정 이후 분으로 변환 */
export function toMarketLocal(iso, market) {
  const parts = formatterFor(MARKET_TIMEZONE[market]).formatToParts(new Date(iso));
  const get = (type) => parts.find((p) => p.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    minutes: Number(get("hour")) * 60 + Number(get("minute")),
  };
}

/** 정렬된 날짜 배열에서 target 이상(strict면 초과)인 첫 날짜 */
function firstDateFrom(sortedDates, target, strict) {
  let lo = 0;
  let hi = sortedDates.length;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    const d = sortedDates[mid];
    if (d < target || (strict && d === target)) lo = mid + 1;
    else hi = mid;
  }
  return lo < sortedDates.length ? sortedDates[lo] : null;
}

/**
 * 뉴스를 영향을 준 거래일에 배정한다.
 * - 장 마감 전 뉴스: 그 날(휴장일이면 다음 거래일)
 * - 장 마감 후 뉴스: 다음 거래일
 * 거래일 목록은 일봉 날짜를 그대로 써서 주말·공휴일이 자동으로 처리된다.
 * 마지막 일봉 이후 뉴스는 배정하지 않는다.
 * @returns {Map<string, object[]>} 날짜 → 뉴스 목록
 */
export function assignNewsToTradingDays(news, candles, market) {
  const dates = candles.map((c) => c.date).sort();
  const result = new Map();
  for (const item of news) {
    const local = toMarketLocal(item.publishedAt, market);
    const afterClose = local.minutes >= MARKET_CLOSE_MINUTES[market];
    const day = firstDateFrom(dates, local.date, afterClose);
    if (!day) continue;
    if (result.has(day)) result.get(day).push(item);
    else result.set(day, [item]);
  }
  return result;
}

/** 날짜 → 전일 대비 등락률(%) */
export function changePercents(candles) {
  const result = new Map();
  for (let i = 1; i < candles.length; i++) {
    const prev = candles[i - 1].close;
    if (prev > 0) result.set(candles[i].date, ((candles[i].close - prev) / prev) * 100);
  }
  return result;
}

/**
 * 뉴스가 있는 날의 차트 표시. kind는 큰 상승(up), 큰 하락(down), 그 외(flat).
 * @returns {{ date: string, newsCount: number, changePercent: number, kind: "up" | "down" | "flat" }[]}
 */
export function buildNewsMarkers(candles, newsByDay, threshold = BIG_MOVE_PERCENT) {
  const changes = changePercents(candles);
  return candles
    .filter((c) => newsByDay.has(c.date))
    .map((c) => {
      const changePercent = changes.get(c.date) ?? 0;
      const kind = changePercent >= threshold ? "up" : changePercent <= -threshold ? "down" : "flat";
      return { date: c.date, newsCount: newsByDay.get(c.date).length, changePercent, kind };
    });
}
