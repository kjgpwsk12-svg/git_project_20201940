// 공급자 선택과 캐시를 묶은 데이터 서비스
import { symbolId } from "../shared/symbols.js";
import { cached } from "./cache.js";
import { demoMarketData, demoNewsProvider } from "./providers/demo.js";
import { createKisProvider, kisConfigFromEnv } from "./providers/kis.js";
import { createFinnhubNewsProvider, createNaverNewsProvider } from "./providers/news.js";

/**
 * 환경 변수에 따라 공급자를 고른다.
 * KIS 키가 없으면 시세·뉴스 모두 데모. 실제 시세에 가짜 뉴스를 섞지 않도록,
 * KIS를 쓰는데 뉴스 키가 없으면 해당 시장 뉴스는 비워 둔다.
 */
export function createMarketService(env = process.env) {
  const kis = kisConfigFromEnv(env);
  const market = kis ? createKisProvider(kis) : demoMarketData;
  const news = kis
    ? {
        KR: env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET
          ? createNaverNewsProvider(env.NAVER_CLIENT_ID, env.NAVER_CLIENT_SECRET)
          : null,
        US: env.FINNHUB_API_KEY ? createFinnhubNewsProvider(env.FINNHUB_API_KEY) : null,
      }
    : { KR: demoNewsProvider, US: demoNewsProvider };

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;

  return {
    status() {
      return {
        isDemo: market.isDemo,
        marketLabel: market.label,
        newsLabel: { KR: news.KR?.label ?? null, US: news.US?.label ?? null },
      };
    },
    getIndices: () => cached("indices", MINUTE, () => market.getIndices()),
    getQuote: (symbol) => cached(`quote:${symbolId(symbol)}`, 30 * SECOND, () => market.getQuote(symbol)),
    getDailyCandles: (symbol) =>
      cached(`candles:${symbolId(symbol)}`, 10 * MINUTE, () => market.getDailyCandles(symbol)),
    /** 뉴스 공급자가 설정되지 않은 시장이면 null */
    getNews(symbol, name) {
      const provider = news[symbol.market];
      if (!provider) return null;
      return cached(`news:${symbolId(symbol)}`, 10 * MINUTE, () => provider.getNews(symbol, name));
    },
  };
}
