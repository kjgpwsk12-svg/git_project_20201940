// API 키 없이 화면을 확인하기 위한 데모 데이터.
// 같은 종목·같은 날짜면 항상 같은 결과가 나오도록 시드 난수를 쓴다.
// 실제 시세가 아니며, 화면에는 항상 데모 표시가 함께 나온다.
import { findCatalogEntry, symbolId } from "../shared/symbols.js";

export const DEMO_TRADING_DAYS = 160;

function hashString(text) {
  let h = 2166136261;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

/** mulberry32 시드 난수: 0 이상 1 미만 */
export function seededRandom(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shiftDate(date, days) {
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

function isWeekend(date) {
  const day = new Date(`${date}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
}

/** endDate(포함) 이전의 평일 count개, 오래된 순. 데모라 공휴일은 고려하지 않는다. */
export function recentWeekdays(endDate, count) {
  const days = [];
  let d = endDate;
  while (days.length < count) {
    if (!isWeekend(d)) days.push(d);
    d = shiftDate(d, -1);
  }
  return days.reverse();
}

function roundPrice(value, market) {
  return market === "US" ? Math.round(value * 100) / 100 : Math.round(value);
}

function basePriceOf(symbol) {
  return findCatalogEntry(symbol)?.basePrice ?? (symbol.market === "KR" ? 50000 : 100);
}

/** 무작위 보행 일봉. 며칠은 일부러 크게 움직이는 날(shock)로 만든다. */
export function generateDemoSeries(key, market, basePrice, endDate, count = DEMO_TRADING_DAYS) {
  const rand = seededRandom(hashString(key));
  const gaussian = () => (rand() + rand() + rand() + rand() - 2) * 1.2; // 근사 정규분포
  const dates = recentWeekdays(endDate, count);

  const shockDays = new Set();
  const shockCount = 5 + Math.floor(rand() * 3);
  while (shockDays.size < shockCount) {
    shockDays.add(dates[5 + Math.floor(rand() * (dates.length - 5))]);
  }

  const candles = [];
  let close = basePrice;
  for (const date of dates) {
    const open = close * (1 + gaussian() * 0.004);
    let ret = gaussian() * 0.014 + 0.0003;
    if (shockDays.has(date)) ret = (rand() < 0.5 ? -1 : 1) * (0.045 + rand() * 0.05);
    const next = open * (1 + ret);
    const high = Math.max(open, next) * (1 + rand() * 0.012);
    const low = Math.min(open, next) * (1 - rand() * 0.012);
    const volumeBase = market === "KR" ? 2_000_000 : 30_000_000;
    candles.push({
      date,
      open: roundPrice(open, market),
      high: roundPrice(high, market),
      low: roundPrice(low, market),
      close: roundPrice(next, market),
      volume: Math.round(volumeBase * (0.6 + rand()) * (shockDays.has(date) ? 2.5 : 1)),
    });
    close = next;
  }
  return { candles, shockDays };
}

export function demoCandles(symbol, endDate) {
  return generateDemoSeries(symbolId(symbol), symbol.market, basePriceOf(symbol), endDate).candles;
}

const UP_HEADLINES = [
  "{name}, 시장 예상 웃돈 분기 실적 발표",
  "{name} 대규모 공급 계약 체결 소식에 매수세 몰려",
  "증권가 {name} 목표주가 일제히 상향",
  "{name}, 신제품 공개 후 기대감 확산",
];
const DOWN_HEADLINES = [
  "{name}, 분기 실적 기대치 하회",
  "{name} 핵심 사업 규제 리스크 부각",
  "외국인 대량 매도에 {name} 약세",
  "{name}, 주요 고객사 주문 축소 우려",
];
const ROUTINE_HEADLINES = [
  "{name} 주주총회 일정 공시",
  "{name}, 업계 컨퍼런스 참가 예정",
  "{name} 관련 업종 동향 점검",
  "{name} 신규 채용·투자 계획 발표",
];

/**
 * 데모 뉴스(최신순). 급등락일에는 원인처럼 보이는 기사를, 평소에는 일상 기사를 만든다.
 * 일부는 전날 장 마감 이후 기사로 만들어 거래일 배정 규칙을 확인할 수 있게 한다.
 */
export function demoNews(symbol, name, endDate) {
  const id = symbolId(symbol);
  const { candles, shockDays } = generateDemoSeries(id, symbol.market, basePriceOf(symbol), endDate);
  const rand = seededRandom(hashString(`${id}:news`));
  const offset = symbol.market === "KR" ? "+09:00" : "-05:00"; // 데모라 서머타임은 무시
  const pick = (list) => list[Math.floor(rand() * list.length)].replace("{name}", name);

  const items = [];
  candles.forEach((candle, i) => {
    const prev = candles[i - 1];
    if (shockDays.has(candle.date) && prev) {
      const up = candle.close > prev.close;
      const eveningBefore = rand() < 0.4;
      const date = eveningBefore ? prev.date : candle.date;
      const time = eveningBefore ? "18:20" : "10:05";
      items.push({
        id: `${id}-${candle.date}-a`,
        title: pick(up ? UP_HEADLINES : DOWN_HEADLINES),
        summary: `[데모 기사] ${name} 주가가 ${up ? "크게 올랐습니다" : "크게 내렸습니다"}. 실제 기사가 아닌 예시입니다.`,
        url: null,
        source: "데모 뉴스",
        publishedAt: new Date(`${date}T${time}:00${offset}`).toISOString(),
      });
    } else if (i % 9 === 4) {
      items.push({
        id: `${id}-${candle.date}-r`,
        title: pick(ROUTINE_HEADLINES),
        summary: "[데모 기사] 실제 기사가 아닌 예시입니다.",
        url: null,
        source: "데모 뉴스",
        publishedAt: new Date(`${candle.date}T11:30:00${offset}`).toISOString(),
      });
    }
  });
  return items.reverse();
}
