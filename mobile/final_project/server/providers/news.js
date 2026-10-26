// 뉴스 공급자. 기사 본문은 가져오지 않고 제목·요약·원문 링크만 제공한다.

const ENTITIES = { "&quot;": '"', "&amp;": "&", "&lt;": "<", "&gt;": ">", "&apos;": "'", "&#39;": "'", "&nbsp;": " " };

/** 네이버 검색 결과의 <b> 강조 태그와 HTML 엔티티 제거 */
export function cleanText(text) {
  return text
    .replace(/<[^>]*>/g, "")
    .replace(/&(quot|amp|lt|gt|apos|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .trim();
}

function hostname(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

/** http(s) 링크만 허용 (javascript: 등 차단) */
function safeUrl(url) {
  try {
    const u = new URL(url);
    return u.protocol === "https:" || u.protocol === "http:" ? u.href : null;
  } catch {
    return null;
  }
}

import { findTopic } from "../../shared/news-topics.js";

/**
 * 네이버 뉴스 검색 접속 정보.
 * - 개발자센터(openapi.naver.com): 2026년 7월 말 신규 발급 종료, 기존 키는 2027년 6월 말까지 사용 가능
 * - NAVER API HUB(naverapihub.apigw.ntruss.com): 새로 받는 키. 주소·헤더가 다르고 종량제 과금이다.
 *   뉴스 경로 /search/v1/news는 네이버 클라우드 이관 가이드(guide.ncloud-docs.com/docs/apihub-migration)에서 확인했다.
 */
export function naverNewsEndpoint(env) {
  if (env.NAVER_HUB_CLIENT_ID && env.NAVER_HUB_CLIENT_SECRET) {
    return {
      url: "https://naverapihub.apigw.ntruss.com/search/v1/news",
      headers: { "X-NCP-APIGW-API-KEY-ID": env.NAVER_HUB_CLIENT_ID, "X-NCP-APIGW-API-KEY": env.NAVER_HUB_CLIENT_SECRET },
    };
  }
  if (env.NAVER_CLIENT_ID && env.NAVER_CLIENT_SECRET) {
    return {
      url: "https://openapi.naver.com/v1/search/news.json",
      headers: { "X-Naver-Client-Id": env.NAVER_CLIENT_ID, "X-Naver-Client-Secret": env.NAVER_CLIENT_SECRET },
    };
  }
  return null;
}

/** 국내 뉴스: 네이버 검색 API(뉴스). endpoint는 naverNewsEndpoint()의 결과 */
export function createNaverNewsProvider(endpoint) {
  async function search(query, display) {
    const url = new URL(endpoint.url);
    url.searchParams.set("query", query);
    url.searchParams.set("display", String(display));
    url.searchParams.set("sort", "date");
    const res = await fetch(url, { headers: endpoint.headers });
    if (!res.ok) throw new Error(`네이버 뉴스 요청 실패 (${res.status})`);
    const body = await res.json();
    return (body.items ?? []).map((item, i) => {
      const link = safeUrl(item.originallink) ?? safeUrl(item.link);
      return {
        id: `${item.link}#${i}`,
        title: cleanText(item.title),
        summary: cleanText(item.description),
        url: link,
        source: (link && hostname(link)) || "네이버 뉴스",
        publishedAt: new Date(item.pubDate).toISOString(),
      };
    });
  }

  return {
    label: "네이버 뉴스 검색",
    // 네이버 검색 API 약관은 검색 결과의 저장·캐싱을 제한하므로 서버에 보관하지 않는다
    noCache: true,
    getNews: (_symbol, name) => search(name, 100),
    /** 시장 뉴스: 주제의 검색어로 찾거나, 사용자가 입력한 검색어로 찾는다 */
    async getMarketNews({ topic = "all", query = "" } = {}) {
      const t = findTopic(topic);
      const items = await search(query || t.query, 30);
      return items.map((n) => ({ ...n, topic: query ? null : t.id, category: query ? null : t.id === "all" ? null : t.label }));
    },
  };
}

/** 미국 종목: Finnhub 회사 뉴스 */
export function createFinnhubNewsProvider(apiKey) {
  return {
    label: "Finnhub",
    async getNews(symbol) {
      const to = new Date();
      const from = new Date(to.getTime() - 120 * 86400_000);
      const url = new URL("https://finnhub.io/api/v1/company-news");
      url.searchParams.set("symbol", symbol.code);
      url.searchParams.set("from", from.toISOString().slice(0, 10));
      url.searchParams.set("to", to.toISOString().slice(0, 10));
      const res = await fetch(url, { headers: { "X-Finnhub-Token": apiKey } });
      if (!res.ok) throw new Error(`Finnhub 뉴스 요청 실패 (${res.status})`);
      const body = await res.json();
      return (Array.isArray(body) ? body : [])
        .filter((n) => n.headline && safeUrl(n.url))
        .map((n) => ({
          id: String(n.id),
          title: n.headline,
          summary: n.summary ?? "",
          url: safeUrl(n.url),
          source: n.source,
          publishedAt: new Date(n.datetime * 1000).toISOString(),
        }))
        .sort((a, b) => b.publishedAt.localeCompare(a.publishedAt));
    },
  };
}
