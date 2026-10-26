// 종목 식별과 주요 종목 목록. 서버와 브라우저가 함께 쓰는 모듈이다.

/**
 * 종목
 * @typedef {{ market: "KR", code: string } | { market: "US", code: string, exchange: "NAS" | "NYS" | "AMS" }} StockSymbol
 */

const US_EXCHANGES = ["NAS", "NYS", "AMS"];

/** URL과 저장소에 쓰는 문자열 ID. 예: "KR.005930", "US.NAS.AAPL" */
export function symbolId(symbol) {
  return symbol.market === "KR" ? `KR.${symbol.code}` : `US.${symbol.exchange}.${symbol.code}`;
}

/** @returns {StockSymbol | null} */
export function parseSymbolId(id) {
  if (typeof id !== "string") return null;
  const parts = id.split(".");
  if (parts[0] === "KR" && parts.length === 2 && /^[0-9A-Z]{6}$/.test(parts[1])) {
    return { market: "KR", code: parts[1] };
  }
  if (
    parts[0] === "US" &&
    parts.length === 3 &&
    US_EXCHANGES.includes(parts[1]) &&
    /^[A-Z][A-Z0-9/-]{0,9}$/.test(parts[2])
  ) {
    return { market: "US", exchange: parts[1], code: parts[2] };
  }
  return null;
}

const kr = (code, name, basePrice, board = "KOSPI") => ({ symbol: { market: "KR", code }, name, basePrice, board });
const us = (exchange, code, name, basePrice, aliases = "") => ({
  symbol: { market: "US", exchange, code },
  name,
  basePrice,
  aliases,
});

/**
 * 검색용 주요 종목 목록. 여기 없는 종목도 주소로 직접 열 수 있다.
 * basePrice는 데모 데이터의 시작 가격 근사값, board는 국내 시장 구분(KOSPI/KOSDAQ), aliases는 한글 검색어다.
 */
export const CATALOG = [
  kr("005930", "삼성전자", 70000),
  kr("000660", "SK하이닉스", 200000),
  kr("373220", "LG에너지솔루션", 380000),
  kr("207940", "삼성바이오로직스", 950000),
  kr("005380", "현대차", 220000),
  kr("000270", "기아", 100000),
  kr("035420", "NAVER", 200000),
  kr("035720", "카카오", 45000),
  kr("068270", "셀트리온", 180000),
  kr("005490", "POSCO홀딩스", 300000),
  kr("051910", "LG화학", 300000),
  kr("006400", "삼성SDI", 250000),
  kr("105560", "KB금융", 90000),
  kr("055550", "신한지주", 55000),
  kr("012330", "현대모비스", 260000),
  kr("066570", "LG전자", 80000),
  kr("017670", "SK텔레콤", 55000),
  kr("259960", "크래프톤", 350000),
  kr("352820", "하이브", 250000),
  kr("012450", "한화에어로스페이스", 800000),
  kr("329180", "HD현대중공업", 400000),
  kr("034020", "두산에너빌리티", 60000),
  kr("323410", "카카오뱅크", 25000),
  kr("247540", "에코프로비엠", 120000, "KOSDAQ"),
  kr("196170", "알테오젠", 400000, "KOSDAQ"),
  kr("086520", "에코프로", 60000, "KOSDAQ"),
  kr("028300", "HLB", 70000, "KOSDAQ"),
  kr("263750", "펄어비스", 40000, "KOSDAQ"),
  kr("293490", "카카오게임즈", 18000, "KOSDAQ"),
  kr("035900", "JYP Ent.", 70000, "KOSDAQ"),
  us("NAS", "AAPL", "Apple", 230, "애플"),
  us("NAS", "MSFT", "Microsoft", 450, "마이크로소프트"),
  us("NAS", "NVDA", "NVIDIA", 180, "엔비디아"),
  us("NAS", "GOOGL", "Alphabet", 230, "알파벳 구글"),
  us("NAS", "AMZN", "Amazon", 220, "아마존"),
  us("NAS", "META", "Meta Platforms", 700, "메타 페이스북"),
  us("NAS", "TSLA", "Tesla", 400, "테슬라"),
  us("NAS", "AVGO", "Broadcom", 330, "브로드컴"),
  us("NAS", "NFLX", "Netflix", 1100, "넷플릭스"),
  us("NAS", "AMD", "AMD", 160, "에이엠디"),
  us("NAS", "PLTR", "Palantir", 170, "팔란티어"),
  us("NAS", "COST", "Costco", 950, "코스트코"),
  us("NYS", "JPM", "JPMorgan Chase", 300, "제이피모건 JP모건"),
  us("NYS", "V", "Visa", 340, "비자"),
  us("NYS", "LLY", "Eli Lilly", 800, "일라이릴리"),
  us("NYS", "XOM", "Exxon Mobil", 110, "엑슨모빌"),
  us("NYS", "KO", "Coca-Cola", 70, "코카콜라"),
  us("NYS", "DIS", "Disney", 115, "디즈니"),
  us("NYS", "ORCL", "Oracle", 250, "오라클"),
  us("AMS", "SPY", "SPDR S&P 500 ETF", 650, "S&P500 에스앤피"),
  us("NAS", "QQQ", "Invesco QQQ", 580, "나스닥100"),
];

export function findCatalogEntry(symbol) {
  const id = symbolId(symbol);
  return CATALOG.find((e) => symbolId(e.symbol) === id);
}

export function searchCatalog(query, limit = 8) {
  const q = query.trim().toLowerCase();
  if (!q) return [];
  return CATALOG.filter(
    (e) =>
      e.name.toLowerCase().includes(q) ||
      e.symbol.code.toLowerCase().includes(q) ||
      (e.aliases ?? "").toLowerCase().includes(q),
  ).slice(0, limit);
}

export const MARKET_TIMEZONE = { KR: "Asia/Seoul", US: "America/New_York" };

/** 정규장 마감 시각(현지, 자정 이후 분). 이후 발표된 뉴스는 다음 거래일 움직임에 반영된다고 본다. */
export const MARKET_CLOSE_MINUTES = { KR: 15 * 60 + 30, US: 16 * 60 };
