// 한국투자증권 KIS Developers Open API (https://apiportal.koreainvestment.com)
// 국내·해외 주식 시세를 같은 인증으로 조회한다.
import { findCatalogEntry } from "../../shared/symbols.js";

const BASE_URLS = {
  real: "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:29443",
};

export function kisConfigFromEnv(env = process.env) {
  if (!env.KIS_APP_KEY || !env.KIS_APP_SECRET) return null;
  return {
    appKey: env.KIS_APP_KEY,
    appSecret: env.KIS_APP_SECRET,
    baseUrl: env.KIS_ENV === "paper" ? BASE_URLS.paper : BASE_URLS.real,
  };
}

const num = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) throw new Error(`KIS 응답 숫자 형식 오류: ${String(value)}`);
  return n;
};

/** KIS의 전일 대비 부호 코드: 4=하한, 5=하락 */
const signed = (value, sign) => (sign === "4" || sign === "5" ? -Math.abs(num(value)) : num(value));

const ymd = (d) => d.toISOString().slice(0, 10).replaceAll("-", "");
const isoDate = (s) => `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}`;
const rows = (value) => (Array.isArray(value) ? value : []);
const byDate = (a, b) => a.date.localeCompare(b.date);

export function createKisProvider(config) {
  // 접근 토큰은 발급 횟수 제한이 있으므로 만료 직전까지 재사용한다.
  let token = null;
  let tokenRequest = null;

  async function getToken() {
    if (token && Date.now() < token.expiresAt - 5 * 60_000) return token.value;
    if (tokenRequest) return tokenRequest;
    tokenRequest = (async () => {
      const res = await fetch(`${config.baseUrl}/oauth2/tokenP`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          grant_type: "client_credentials",
          appkey: config.appKey,
          appsecret: config.appSecret,
        }),
      });
      if (!res.ok) throw new Error(`KIS 토큰 발급 실패 (${res.status})`);
      const body = await res.json();
      if (!body.access_token) throw new Error("KIS 토큰 응답에 access_token이 없습니다");
      token = { value: body.access_token, expiresAt: Date.now() + (body.expires_in ?? 86400) * 1000 };
      return token.value;
    })().finally(() => {
      tokenRequest = null;
    });
    return tokenRequest;
  }

  async function kisGet(path, trId, params) {
    const url = new URL(path, config.baseUrl);
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
    const res = await fetch(url, {
      headers: {
        "content-type": "application/json; charset=utf-8",
        authorization: `Bearer ${await getToken()}`,
        appkey: config.appKey,
        appsecret: config.appSecret,
        tr_id: trId,
        custtype: "P",
      },
    });
    if (!res.ok) throw new Error(`KIS ${trId} 요청 실패 (${res.status})`);
    const body = await res.json();
    if (body.rt_cd !== "0") throw new Error(`KIS ${trId} 오류: ${body.msg1 ?? "알 수 없음"}`);
    return body;
  }

  async function getQuote(symbol) {
    const name = findCatalogEntry(symbol)?.name ?? symbol.code;
    if (symbol.market === "KR") {
      const { output: o } = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-price", "FHKST01010100", {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: symbol.code,
      });
      return {
        symbol,
        name,
        price: num(o.stck_prpr),
        change: signed(o.prdy_vrss, o.prdy_vrss_sign),
        changePercent: num(o.prdy_ctrt),
        volume: num(o.acml_vol),
      };
    }
    const { output: o } = await kisGet("/uapi/overseas-price/v1/quotations/price", "HHDFS00000300", {
      AUTH: "",
      EXCD: symbol.exchange,
      SYMB: symbol.code,
    });
    return {
      symbol,
      name,
      price: num(o.last),
      change: signed(o.diff, o.sign),
      changePercent: num(o.rate),
      volume: num(o.tvol),
    };
  }

  async function getDailyCandles(symbol) {
    if (symbol.market === "KR") {
      // 한 번에 최대 100개 영업일
      const end = new Date();
      const start = new Date(end.getTime() - 150 * 86400_000);
      const body = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-daily-itemchartprice", "FHKST03010100", {
        FID_COND_MRKT_DIV_CODE: "J",
        FID_INPUT_ISCD: symbol.code,
        FID_INPUT_DATE_1: ymd(start),
        FID_INPUT_DATE_2: ymd(end),
        FID_PERIOD_DIV_CODE: "D",
        FID_ORG_ADJ_PRC: "0",
      });
      return rows(body.output2)
        .filter((r) => r.stck_bsop_date)
        .map((r) => ({
          date: isoDate(r.stck_bsop_date),
          open: num(r.stck_oprc),
          high: num(r.stck_hgpr),
          low: num(r.stck_lwpr),
          close: num(r.stck_clpr),
          volume: num(r.acml_vol),
        }))
        .sort(byDate);
    }
    const body = await kisGet("/uapi/overseas-price/v1/quotations/dailyprice", "HHDFS76240000", {
      AUTH: "",
      EXCD: symbol.exchange,
      SYMB: symbol.code,
      GUBN: "0",
      BYMD: "",
      MODP: "1",
    });
    return rows(body.output2)
      .filter((r) => r.xymd)
      .map((r) => ({
        date: isoDate(r.xymd),
        open: num(r.open),
        high: num(r.high),
        low: num(r.low),
        close: num(r.clos),
        volume: num(r.tvol),
      }))
      .sort(byDate);
  }

  async function getIndices() {
    const domestic = async (id, name, code) => {
      const { output: o } = await kisGet("/uapi/domestic-stock/v1/quotations/inquire-index-price", "FHPUP02100000", {
        FID_COND_MRKT_DIV_CODE: "U",
        FID_INPUT_ISCD: code,
      });
      return {
        id,
        name,
        market: "KR",
        proxy: null,
        value: num(o.bstp_nmix_prpr),
        change: signed(o.bstp_nmix_prdy_vrss, o.prdy_vrss_sign),
        changePercent: num(o.bstp_nmix_prdy_ctrt),
      };
    };
    // 미국 지수는 대표 ETF 시세로 대신한다.
    const proxy = async (id, name, exchange, code) => {
      const q = await getQuote({ market: "US", exchange, code });
      return { id, name, market: "US", proxy: code, value: q.price, change: q.change, changePercent: q.changePercent };
    };
    // KIS는 초당 호출 수 제한이 있어 순차로 요청한다.
    return [
      await domestic("KOSPI", "코스피", "0001"),
      await domestic("KOSDAQ", "코스닥", "1001"),
      await proxy("SPX", "S&P 500", "AMS", "SPY"),
      await proxy("NDX", "나스닥 100", "NAS", "QQQ"),
      await proxy("DJI", "다우존스", "AMS", "DIA"),
    ];
  }

  return { label: "한국투자증권", isDemo: false, getQuote, getDailyCandles, getIndices };
}
