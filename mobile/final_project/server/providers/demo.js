import { toMarketLocal } from "../../shared/news-markers.js";
import { findCatalogEntry } from "../../shared/symbols.js";
import { demoCandles, demoNews, generateDemoSeries } from "../demo-data.js";

const todayIn = (market) => toMarketLocal(new Date().toISOString(), market).date;

function lastChange(candles) {
  const last = candles[candles.length - 1];
  const prev = candles[candles.length - 2];
  const change = last.close - prev.close;
  return { last, change, changePercent: (change / prev.close) * 100 };
}

const DEMO_INDICES = [
  { id: "KOSPI", name: "코스피", market: "KR", base: 3400 },
  { id: "KOSDAQ", name: "코스닥", market: "KR", base: 850 },
  { id: "SPX", name: "S&P 500", market: "US", proxy: "SPY", base: 650 },
  { id: "NDX", name: "나스닥 100", market: "US", proxy: "QQQ", base: 580 },
  { id: "DJI", name: "다우존스", market: "US", proxy: "DIA", base: 460 },
];

/** 시세 공급자 형식: { label, isDemo, getQuote, getDailyCandles, getIndices } */
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
      const { candles } = generateDemoSeries(`INDEX.${index.id}`, "US", index.base, todayIn(index.market));
      const { last, change, changePercent } = lastChange(candles);
      return {
        id: index.id,
        name: index.name,
        market: index.market,
        proxy: index.proxy ?? null,
        value: last.close,
        change,
        changePercent,
      };
    });
  },
};

/** 뉴스 공급자 형식: { label, getNews(symbol, name) } */
export const demoNewsProvider = {
  label: "데모 뉴스",
  async getNews(symbol, name) {
    return demoNews(symbol, name, todayIn(symbol.market));
  },
};
