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

/** 국내 종목: 네이버 검색 API(뉴스) */
export function createNaverNewsProvider(clientId, clientSecret) {
  return {
    label: "네이버 뉴스 검색",
    async getNews(_symbol, name) {
      const url = new URL("https://openapi.naver.com/v1/search/news.json");
      url.searchParams.set("query", name);
      url.searchParams.set("display", "100");
      url.searchParams.set("sort", "date");
      const res = await fetch(url, {
        headers: { "X-Naver-Client-Id": clientId, "X-Naver-Client-Secret": clientSecret },
      });
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
