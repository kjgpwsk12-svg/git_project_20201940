// 공급자 선택과 캐시를 묶은 데이터 서비스
import { symbolId } from "../shared/symbols.js";
import { cached, deduped } from "./cache.js";
import { demoMarketData, demoNewsProvider } from "./providers/demo.js";
import { createKisProvider, kisConfigFromEnv } from "./providers/kis.js";
import { createIndicatorsProvider } from "./providers/indicators.js";
import { createFinnhubNewsProvider, createNaverNewsProvider, naverNewsEndpoint } from "./providers/news.js";

/**
 * 환경 변수에 따라 공급자를 고른다.
 * KIS 키가 없으면 시세·뉴스 모두 데모. 실제 시세에 가짜 뉴스를 섞지 않도록,
 * KIS를 쓰는데 뉴스 키가 없으면 해당 시장 뉴스는 비워 둔다.
 */
export function createMarketService(env = process.env) {
  const kis = kisConfigFromEnv(env);
  const market = kis ? createKisProvider(kis) : demoMarketData;
  const naver = naverNewsEndpoint(env);
  const naverNews = naver ? createNaverNewsProvider(naver) : null;
  const news = kis
    ? {
        KR: naverNews,
        US: env.FINNHUB_API_KEY ? createFinnhubNewsProvider(env.FINNHUB_API_KEY) : null,
      }
    : { KR: demoNewsProvider, US: demoNewsProvider };
  // 시장 뉴스(뉴스 화면·홈): 시세와 묶이지 않으므로 네이버 키만 있으면 실제 기사를 쓴다
  const marketNews = naverNews ?? (kis ? null : demoNewsProvider);

  // 경제 지표: FRED API·한국은행 ECOS API (무료 키). 테스트에서는 env.indicators로 바꿔 끼울 수 있다
  const indicators = env.indicators ?? createIndicatorsProvider({ fredKey: env.FRED_API_KEY, ecosKey: env.ECOS_API_KEY });

  const SECOND = 1000;
  const MINUTE = 60 * SECOND;

  /** 캐시하지 않는 공급자(네이버 검색)는 매번 새로 불러오고, 실패해도 이전 결과를 쓰지 않는다 */
  const newsCached = (provider, key, load) =>
    provider.noCache ? load().then((value) => ({ value, fetchedAt: new Date().toISOString(), stale: false })) : cached(key, 10 * MINUTE, load);

  return {
    status() {
      return {
        isDemo: market.isDemo,
        marketLabel: market.label,
        indicatorsLabel: indicators.available ? indicators.label : null,
        // FRED API를 쓰면 화면에 FRED가 요구하는 비보증 문구를 표시해야 한다
        indicatorsUseFred: Boolean(indicators.usesFred),
        newsLabel: { KR: news.KR?.label ?? null, US: news.US?.label ?? null },
        // 뉴스 화면·홈의 시장 뉴스 출처 (종목 뉴스와 다를 수 있음)
        marketNewsLabel: marketNews?.label ?? null,
        marketNewsCached: Boolean(marketNews && !marketNews.noCache),
      };
    },
    getIndices: () => cached("indices", MINUTE, () => market.getIndices()),
    /** 지수 일봉. 공급자가 지원하지 않으면 null */
    getIndexCandles(id) {
      if (!market.getIndexCandles) return null;
      return cached(`index-candles:${id}`, 10 * MINUTE, () => market.getIndexCandles(id));
    },
    /** 경제 지표 요약 (FRED·한국은행). FRED 이용 약관이 저장·캐싱을 금지하므로 보관하지 않는다 */
    getIndicators() {
      if (!indicators.available) return null;
      return deduped("indicators", () => indicators.getIndicators());
    },
    /** 지표 하나의 10년 기록. 알 수 없는 지표면 null */
    getIndicatorHistory(id) {
      return deduped(`indicator-history:${id}`, async () => {
        const points = await indicators.getIndicatorHistory(id);
        if (!points) throw Object.assign(new Error("알 수 없는 지표예요"), { status: 404 });
        return points;
      });
    },
    /** 시장 뉴스. 국내 뉴스 공급자를 쓴다. topic: shared/news-topics.js의 id, query: 검색어 */
    getMarketNews({ topic = "all", query = "" } = {}) {
      const provider = marketNews;
      if (!provider?.getMarketNews) return null;
      return newsCached(provider, `market-news:${topic}:${query}`, () => provider.getMarketNews({ topic, query }));
    },
    getQuote: (symbol) => cached(`quote:${symbolId(symbol)}`, 30 * SECOND, () => market.getQuote(symbol)),
    getDailyCandles: (symbol) =>
      cached(`candles:${symbolId(symbol)}`, 10 * MINUTE, () => market.getDailyCandles(symbol)),
    /** 뉴스 공급자가 설정되지 않은 시장이면 null */
    getNews(symbol, name) {
      const provider = news[symbol.market];
      if (!provider) return null;
      return newsCached(provider, `news:${symbolId(symbol)}`, () => provider.getNews(symbol, name));
    },
  };
}
