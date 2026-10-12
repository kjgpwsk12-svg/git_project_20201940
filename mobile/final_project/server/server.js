// 이코노바 서버: 정적 파일 제공 + 시세·뉴스 API + 공개 설정
// API 키는 서버에만 두고, 브라우저는 이 서버의 /api만 호출한다.
import { timingSafeEqual } from "node:crypto";
import { fileURLToPath } from "node:url";
import express from "express";
import { parseSymbolId, symbolId } from "../shared/symbols.js";
import { createMarketService } from "./market.js";

const root = (path) => fileURLToPath(new URL(path, import.meta.url));
const MAX_QUOTE_IDS = 60;

/**
 * 배포 시 접근 제한. SITE_PASSWORD가 있으면 HTTP 기본 인증을 요구한다.
 * 시세 API 키가 개인 증권 계좌에 묶여 있어, 공개해 두면 다른 사람이 호출 한도를 쓸 수 있다.
 */
function basicAuth(password) {
  const expected = Buffer.from(password);
  return (req, res, next) => {
    const header = req.get("authorization") ?? "";
    if (header.startsWith("Basic ")) {
      const decoded = Buffer.from(header.slice(6), "base64").toString();
      const given = Buffer.from(decoded.slice(decoded.indexOf(":") + 1));
      if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
    }
    res.set("WWW-Authenticate", 'Basic realm="econova", charset="UTF-8"').status(401).send("인증이 필요합니다");
  };
}

/** Supabase 공개 설정. anon 키는 공개용이며 데이터 보호는 RLS가 담당한다. service_role 키는 절대 내보내지 않는다. */
export function supabaseConfigFromEnv(env = process.env) {
  if (!env.SUPABASE_URL || !env.SUPABASE_ANON_KEY) return null;
  try {
    return { url: new URL(env.SUPABASE_URL).origin, anonKey: env.SUPABASE_ANON_KEY };
  } catch {
    console.error("SUPABASE_URL 형식이 올바르지 않습니다:", env.SUPABASE_URL);
    return null;
  }
}

export function createApp(service = createMarketService(), env = process.env) {
  const app = express();
  app.disable("x-powered-by");
  const supabase = supabaseConfigFromEnv(env);
  const supabaseConnect = supabase ? ` ${supabase.url} ${supabase.url.replace(/^http/, "ws")}` : "";

  if (env.SITE_PASSWORD) app.use(basicAuth(env.SITE_PASSWORD));

  app.use((req, res, next) => {
    res.set({
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin",
      "Content-Security-Policy":
        `default-src 'self'; img-src 'self' data: https://*.tile.openstreetmap.org; style-src 'self' 'unsafe-inline'; script-src 'self'; connect-src 'self'${supabaseConnect}; frame-ancestors 'none'`,
    });
    next();
  });

  // 정적 파일: 화면(public), 공용 모듈(shared), 차트 라이브러리
  app.use(express.static(root("../public"), { extensions: ["html"] }));
  app.use("/shared", express.static(root("../shared")));
  const vendor = {
    "lightweight-charts.mjs": "../node_modules/lightweight-charts/dist/lightweight-charts.standalone.production.mjs",
    "supabase.js": "../node_modules/@supabase/supabase-js/dist/umd/supabase.js",
  };
  app.get("/vendor/:file", (req, res, next) => {
    const path = vendor[req.params.file];
    if (!path) return next();
    res.type("text/javascript").sendFile(root(path));
  });

  app.get("/api/status", (req, res) => {
    res.json(service.status());
  });

  app.get("/api/config", (req, res) => {
    res.json({ supabase });
  });

  app.get("/api/indices", async (req, res) => {
    try {
      res.json(await service.getIndices());
    } catch (error) {
      console.error("[api/indices]", error.message);
      res.status(502).json({ error: "주요 지수를 불러오지 못했어요." });
    }
  });

  /** GET /api/quotes?ids=KR.005930,US.NAS.AAPL */
  app.get("/api/quotes", async (req, res) => {
    const symbols = String(req.query.ids ?? "")
      .split(",")
      .map((id) => parseSymbolId(id.trim()))
      .filter(Boolean)
      .slice(0, MAX_QUOTE_IDS);

    // 시세 API의 초당 호출 제한 때문에 순차로 조회한다. 결과는 서버 캐시에 남는다.
    const results = [];
    for (const symbol of symbols) {
      const id = symbolId(symbol);
      try {
        const { value, fetchedAt, stale } = await service.getQuote(symbol);
        results.push({ id, quote: value, fetchedAt, stale });
      } catch (error) {
        console.error(`[api/quotes] ${id}`, error.message);
        results.push({ id, quote: null, fetchedAt: null, stale: false });
      }
    }
    res.json({ results });
  });

  /** 종목 상세: 시세, 일봉, 뉴스 */
  app.get("/api/stocks/:id", async (req, res) => {
    const symbol = parseSymbolId(req.params.id);
    if (!symbol) return res.status(404).json({ error: "종목 주소가 올바르지 않아요." });

    let quote, candles;
    try {
      [quote, candles] = await Promise.all([service.getQuote(symbol), service.getDailyCandles(symbol)]);
    } catch (error) {
      console.error(`[api/stocks] ${symbolId(symbol)}`, error.message);
      return res.status(502).json({ error: `${symbol.code} 시세를 불러오지 못했어요. 종목 코드를 확인하거나 잠시 후 다시 시도해 주세요.` });
    }

    let news = [];
    let newsUnavailable = null;
    const newsRequest = service.getNews(symbol, quote.value.name);
    if (!newsRequest) {
      newsUnavailable = `${symbol.market === "KR" ? "네이버 검색" : "Finnhub"} API 키가 설정되지 않아 뉴스를 표시하지 않아요.`;
    } else {
      try {
        news = (await newsRequest).value;
      } catch (error) {
        console.error(`[api/stocks] ${symbolId(symbol)} 뉴스`, error.message);
        newsUnavailable = "뉴스를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.";
      }
    }

    res.json({ symbol, quote, candles, news, newsUnavailable, status: service.status() });
  });

  app.use("/api", (req, res) => res.status(404).json({ error: "없는 API입니다." }));
  app.use((req, res) => res.status(404).sendFile(root("../public/404.html")));

  return app;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.PORT) || 3000;
  const service = createMarketService();
  createApp(service).listen(port, (error) => {
    // Express 5는 포트 사용 중 같은 오류를 콜백으로 넘긴다
    if (error) {
      console.error(`서버를 시작하지 못했습니다 (포트 ${port}): ${error.message}`);
      process.exit(1);
    }
    const { isDemo, marketLabel } = service.status();
    console.log(`이코노바 실행 중: http://localhost:${port}`);
    console.log(`  시세: ${marketLabel}${isDemo ? " (API 키 없음)" : ""}`);
    console.log(`  로그인: ${supabaseConfigFromEnv() ? "Supabase 연결됨" : "미설정 (SUPABASE_URL, SUPABASE_ANON_KEY 필요)"}`);
  });
}
