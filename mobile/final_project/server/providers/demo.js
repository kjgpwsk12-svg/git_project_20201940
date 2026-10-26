import { toMarketLocal } from "../../shared/news-markers.js";
import { findCatalogEntry } from "../../shared/symbols.js";
import { demoCandles, demoNews, generateDemoSeries, seededRandom } from "../demo-data.js";

const todayIn = (market) => toMarketLocal(new Date().toISOString(), market === "KR" ? "KR" : "US").date;

function lastChange(candles) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last.close - prev.close;
  return { last, change, changePercent: (change / prev.close) * 100 };
}

/** 지수·환율. market "FX"는 환율 */
const DEMO_INDICES = [
  { id: "KOSPI", name: "코스피", market: "KR", base: 2600 },
  { id: "KOSDAQ", name: "코스닥", market: "KR", base: 850 },
  { id: "SPX", name: "S&P 500", market: "US", proxy: "SPY", base: 650 },
  { id: "NDX", name: "나스닥 100", market: "US", proxy: "QQQ", base: 580 },
  { id: "USDKRW", name: "USD/KRW", market: "FX", base: 1380 },
  { id: "DJI", name: "다우존스", market: "US", proxy: "DIA", base: 460 },
];

const indexSeries = (index) =>
  generateDemoSeries(`INDEX.${index.id}`, "US", index.base, todayIn(index.market)).candles;

/** 경제 지표 (데모). rate는 변동 없는 정책 금리 */
const DEMO_INDICATORS = [
  { id: "FED", name: "미국 기준금리", unit: "%", rate: 4.5 },
  { id: "BOK", name: "한국 기준금리", unit: "%", rate: 2.5 },
  { id: "DXY", name: "달러 인덱스", unit: "", base: 100 },
  { id: "WTI", name: "WTI 원유", unit: "$", base: 65 },
  { id: "GOLD", name: "금", unit: "$", base: 2600 },
  { id: "BTC", name: "비트코인", unit: "$", base: 62000 },
];

// [주제 id, 주제 이름, 제목] — 실제 기사가 아닌 예시
const NEWS_TEMPLATES = [
  ["kr", "국내 증시", "코스피, 외국인 매매 동향에 혼조세 마감"],
  ["us", "해외 증시", "뉴욕증시, 금리 경로 주목하며 주요 지수 엇갈려"],
  ["macro", "경제 지표", "이번 주 발표될 물가 지표에 시장 관심 집중"],
  ["company", "기업", "반도체 업종, 업황 회복 기대와 재고 우려 공존"],
  ["fx", "외환", "원·달러 환율, 달러 강세 흐름 속 좁은 범위 등락"],
  ["commodity", "원자재", "국제유가, 공급 전망 변화에 변동성 확대"],
  ["kr", "국내 증시", "코스닥, 2차전지 업종 중심으로 등락 반복"],
  ["us", "해외 증시", "나스닥, 대형 기술주 실적 발표 앞두고 관망"],
  ["macro", "경제 지표", "고용 지표 발표 앞두고 금리 인하 기대 엇갈려"],
  ["company", "기업", "주요 기업 분기 실적 시즌 시작, 시장 눈높이 점검"],
  ["fx", "외환", "엔화 약세 이어지며 아시아 통화 동반 약세"],
  ["commodity", "원자재", "금값, 안전자산 수요에 사상 최고치 근처 유지"],
  ["kr", "국내 증시", "개인 투자자 순매수 이어지며 거래대금 증가"],
  ["us", "해외 증시", "S&P500, 경기 지표 해석 엇갈리며 보합권"],
  ["macro", "경제 지표", "소비자심리지수 소폭 반등, 내수 회복 기대"],
  ["company", "기업", "바이오 업종, 임상 결과 발표 일정에 관심"],
  ["fx", "외환", "달러 인덱스, 연준 위원 발언에 소폭 상승"],
  ["commodity", "원자재", "구리 가격, 중국 수요 기대에 강세"],
];

/** 시세 공급자 형식: { label, isDemo, getQuote, getDailyCandles, getIndices, getIndexCandles, getIndicators } */
export const demoMarketData = {
  label: "데모 데이터",
  isDemo: true,

  async getQuote(symbol) {
    const { last, change, changePercent } = lastChange(demoCandles(symbol, todayIn(symbol.market)));
    return {
      symbol,
      name: findCatalogEntry(symbol)?.name ?? symbol.code,
      price: last.close,
      change,
      changePercent,
      volume: last.volume,
    };
  },

  async getDailyCandles(symbol) {
    return demoCandles(symbol, todayIn(symbol.market));
  },

  async getIndices() {
    return DEMO_INDICES.map((index) => {
      const candles = indexSeries(index);
      const { last, change, changePercent } = lastChange(candles);
      return {
        id: index.id,
        name: index.name,
        market: index.market,
        proxy: index.proxy ?? null,
        value: last.close,
        change,
        changePercent,
        // 카드의 작은 추이 그래프용 최근 30일 종가
        spark: candles.slice(-30).map((c) => c.close),
      };
    });
  },

  async getIndexCandles(id) {
    const index = DEMO_INDICES.find((i) => i.id === id);
    if (!index) return null;
    return indexSeries(index);
  },

  async getIndicators() {
    return DEMO_INDICATORS.map((ind) => {
      if (ind.rate !== undefined) {
        return { id: ind.id, name: ind.name, unit: ind.unit, value: ind.rate, change: 0, changePercent: 0 };
      }
      const candles = generateDemoSeries(`IND.${ind.id}`, "US", ind.base, todayIn("US")).candles;
      const { last, change, changePercent } = lastChange(candles);
      return { id: ind.id, name: ind.name, unit: ind.unit, value: last.close, change, changePercent };
    });
  },
};

/** 뉴스 공급자 형식: { label, getNews(symbol, name), getMarketNews() } */
export const demoNewsProvider = {
  label: "데모 뉴스",
  async getNews(symbol, name) {
    return demoNews(symbol, name, todayIn(symbol.market));
  },
  /** @param {{ topic?: string, query?: string }} [options] */
  async getMarketNews({ topic = "all", query = "" } = {}) {
    const rand = seededRandom(Number(todayIn("KR").replaceAll("-", "")));
    const now = Date.now();
    return NEWS_TEMPLATES.map(([topicId, category, title], i) => ({
      id: `market-${i}`,
      topic: topicId,
      title: `[데모] ${title}`,
      summary: "실제 기사가 아닌 예시입니다.",
      url: null,
      source: "데모 뉴스",
      category,
      publishedAt: new Date(now - (i * 70 + Math.floor(rand() * 50)) * 60_000).toISOString(),
    }))
      .filter((n) => topic === "all" || n.topic === topic)
      .filter((n) => !query || n.title.includes(query) || n.category.includes(query));
  },
};
