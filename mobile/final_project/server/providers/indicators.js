// 경제 지표: 공식 API에서 가져온다 (둘 다 무료 키 발급)
// - 미국 지표: 세인트루이스 연준 FRED API (https://fred.stlouisfed.org/docs/api/fred/)
// - 한국 기준금리: 한국은행 ECOS Open API (https://ecos.bok.or.kr/api/)
//
// 원칙
// - 값을 지어내지 않는다. 가져오지 못하면 그 지표만 오류로 알린다.
// - FRED 이용 약관(https://fred.stlouisfed.org/legal/): 데이터 수집은 API로만, 저장·캐싱 금지, 출처와 비보증 문구 표시.
//   그래서 서버는 받은 값을 보관하지 않고(캐시 없음), 화면에 FRED가 요구하는 문구를 보여 준다.

/** FRED API를 쓰는 제품이 표시해야 하는 문구 (FRED API 이용 약관) */
export const FRED_NOTICE = "This product uses the FRED® API but is not endorsed or certified by the Federal Reserve Bank of St. Louis.";

const fredUrl = (series) => `https://fred.stlouisfed.org/series/${series}`;
const ECOS_PAGE = "https://ecos.bok.or.kr/";

/**
 * 지표 정의
 * kind: level = 값 그대로, yoy = 1년 전 대비 변화율(%)로 바꿔 보여 준다 (물가지수 등)
 * compare: lastChange = 직전 관측이 아니라 마지막으로 값이 바뀐 시점과 비교 (정책 금리)
 */
export const INDICATORS = [
  { id: "KRRATE", ecos: { stat: "722Y001", item: "0101000", expect: "기준금리" }, name: "한국 기준금리", unit: "%", group: "금리", kind: "level", compare: "lastChange", freq: "결정 시",
    source: "한국은행 ECOS", sourceUrl: ECOS_PAGE, citation: "한국은행 경제통계시스템(ECOS), 한국은행 기준금리",
    about: "한국은행 금융통화위원회가 정하는 정책 금리예요. 예금·대출 금리와 원화 가치에 영향을 줘요." },
  { id: "FEDRATE", series: "DFEDTARU", owner: "Board of Governors of the Federal Reserve System (US)", name: "미국 기준금리(상단)", unit: "%", group: "금리", kind: "level", compare: "lastChange", freq: "매일",
    about: "미 연준(FOMC)이 정하는 연방기금금리 목표 범위의 상단이에요. 세계 금융시장의 기준이 되는 금리예요." },
  { id: "US10Y", series: "DGS10", owner: "Board of Governors of the Federal Reserve System (US)", name: "미국 10년 국채 금리", unit: "%", group: "금리", kind: "level", freq: "매일",
    about: "장기 금리의 대표 지표예요. 오르면 성장주 주가와 채권 가격에 부담이 되는 경우가 많아요." },
  { id: "SPREAD", series: "T10Y2Y", owner: "Federal Reserve Bank of St. Louis", name: "장단기 금리차 (10년−2년)", unit: "%p", group: "금리", kind: "level", freq: "매일",
    about: "10년 국채 금리에서 2년 국채 금리를 뺀 값이에요. 마이너스(역전)는 경기 둔화 신호로 자주 해석돼요." },
  { id: "CPI", series: "CPIAUCSL", owner: "U.S. Bureau of Labor Statistics", name: "미국 소비자물가 상승률", unit: "%", group: "물가·고용", kind: "yoy", freq: "매월",
    about: "소비자물가지수(CPI)의 1년 전 같은 달 대비 상승률이에요. 연준 금리 결정의 핵심 근거예요." },
  { id: "UNRATE", series: "UNRATE", owner: "U.S. Bureau of Labor Statistics", name: "미국 실업률", unit: "%", group: "물가·고용", kind: "level", freq: "매월",
    about: "경제활동인구 중 실업자 비율이에요. 고용 시장이 얼마나 뜨겁거나 식었는지 보여 줘요." },
  { id: "USDKRW", series: "DEXKOUS", owner: "Board of Governors of the Federal Reserve System (US)", name: "원/달러 환율", unit: "원", group: "환율·원자재", kind: "level", freq: "매일(약 1주 지연)",
    about: "1달러에 대한 원화 값이에요. 미 연준 H.10 자료(뉴욕 정오 매입 기준)라 국내 고시 환율이나 실제 환전 가격과 다를 수 있어요." },
  { id: "DOLLAR", series: "DTWEXBGS", owner: "Board of Governors of the Federal Reserve System (US)", name: "달러 가치 지수 (광의)", unit: "", group: "환율·원자재", kind: "level", freq: "매일(약 1주 지연)",
    about: "주요 교역국 통화 대비 달러 가치를 나타낸 미 연준 지수예요. 흔히 보는 달러 인덱스(DXY)와는 다른 지수예요." },
  { id: "WTI", series: "DCOILWTICO", owner: "U.S. Energy Information Administration", name: "WTI 원유", unit: "$", group: "환율·원자재", kind: "level", freq: "매일",
    about: "미국 서부 텍사스산 원유의 배럴당 현물 가격이에요. 물가와 에너지 기업 실적에 영향을 줘요." },
].map((i) =>
  i.series
    ? { source: "FRED (세인트루이스 연준)", sourceUrl: fredUrl(i.series), citation: `${i.owner}, ${i.series}, retrieved from FRED, Federal Reserve Bank of St. Louis`, ...i }
    : i,
);

/** FRED API 응답 → [{ date, value }]. 결측('.')과 형식이 맞지 않는 값은 버린다 */
export function parseFredObservations(body) {
  if (!Array.isArray(body?.observations)) throw new Error(body?.error_message ?? "FRED 응답 형식이 예상과 달라요");
  return body.observations
    .map((o) => ({ date: o.date, value: Number(o.value) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value));
}

/**
 * ECOS 일별 응답 → 값이 바뀐 날(과 마지막 관측일)만 [{ date, value }].
 * 기대한 통계(예: '기준금리')가 아니면 숫자를 쓰지 않고 실패한다 (통계 코드가 바뀌었을 때 엉뚱한 값을 보여 주지 않도록).
 */
export function parseEcosRates(body, expect) {
  const rows = body?.StatisticSearch?.row;
  if (!Array.isArray(rows)) throw new Error(body?.RESULT?.MESSAGE ?? "ECOS 응답 형식이 예상과 달라요");
  if (!rows.length) throw new Error("ECOS에 해당 기간 자료가 없어요");
  if (expect && !rows.every((r) => String(r.ITEM_NAME1 ?? "").includes(expect))) {
    throw new Error(`ECOS 통계 항목이 '${expect}'가 아니에요. 통계 코드를 확인해 주세요`);
  }
  const points = rows
    .map((r) => ({ date: `${String(r.TIME).slice(0, 4)}-${String(r.TIME).slice(4, 6)}-${String(r.TIME).slice(6, 8)}`, value: Number(r.DATA_VALUE) }))
    .filter((p) => /^\d{4}-\d{2}-\d{2}$/.test(p.date) && Number.isFinite(p.value))
    .sort((a, b) => a.date.localeCompare(b.date));
  const changes = points.filter((p, i) => i === 0 || p.value !== points[i - 1].value);
  // 마지막 관측일도 남겨 '기준일'로 쓴다 (값은 직전 변경과 같음)
  const last = points.at(-1);
  if (last && changes.at(-1)?.date !== last.date) changes.push(last);
  return changes;
}

/** 1년 전 같은 달 대비 변화율 (월별 지수) */
export function toYoY(points) {
  const byDate = new Map(points.map((p) => [p.date, p.value]));
  return points
    .map((p) => {
      const d = new Date(`${p.date}T00:00:00Z`);
      d.setUTCFullYear(d.getUTCFullYear() - 1);
      const prev = byDate.get(d.toISOString().slice(0, 10));
      return prev ? { date: p.date, value: Math.round(((p.value / prev - 1) * 100) * 100) / 100 } : null;
    })
    .filter(Boolean);
}

/**
 * 최신 값과 직전 값 비교.
 * 정책 금리처럼 가끔 바뀌는 값(compare: lastChange)은 마지막으로 값이 달라졌던 시점과 비교한다.
 */
export function summarize(def, points) {
  const last = points.at(-1);
  const prev = def.compare === "lastChange" ? points.findLast((p) => p.value !== last.value) : points.at(-2);
  const change = prev ? last.value - prev.value : 0;
  return {
    id: def.id,
    name: def.name,
    unit: def.unit,
    group: def.group,
    value: last.value,
    date: last.date,
    previous: prev ? { value: prev.value, date: prev.date } : null,
    change,
    changePercent: prev && prev.value !== 0 ? (change / Math.abs(prev.value)) * 100 : 0,
    source: def.source,
    sourceUrl: def.sourceUrl,
    citation: def.citation,
    freq: def.freq,
    about: def.about,
  };
}

const ymd = (d) => d.toISOString().slice(0, 10);

/**
 * @param {{ fredKey?: string, ecosKey?: string }} keys
 */
export function createIndicatorsProvider({ fredKey, ecosKey } = {}, fetchImpl = (...args) => fetch(...args)) {
  async function fetchJson(url) {
    const res = await fetchImpl(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error(`요청 실패 (${res.status})`);
    return res.json();
  }

  /** 지표 하나의 기록 (years년) */
  async function history(def, years) {
    const start = new Date();
    start.setUTCFullYear(start.getUTCFullYear() - years - (def.kind === "yoy" ? 1 : 0));
    if (def.ecos) {
      if (!ecosKey) throw new Error("한국은행 ECOS API 키가 설정되지 않았어요");
      const { stat, item, expect } = def.ecos;
      const from = ymd(start).replaceAll("-", "");
      const to = ymd(new Date()).replaceAll("-", "");
      const body = await fetchJson(`https://ecos.bok.or.kr/api/StatisticSearch/${encodeURIComponent(ecosKey)}/json/kr/1/10000/${stat}/D/${from}/${to}/${item}`);
      return parseEcosRates(body, expect);
    }
    if (!fredKey) throw new Error("FRED API 키가 설정되지 않았어요");
    const url = new URL("https://api.stlouisfed.org/fred/series/observations");
    url.searchParams.set("series_id", def.series);
    url.searchParams.set("api_key", fredKey);
    url.searchParams.set("file_type", "json");
    url.searchParams.set("observation_start", ymd(start));
    const points = parseFredObservations(await fetchJson(url));
    return def.kind === "yoy" ? toYoY(points) : points;
  }

  return {
    label: "FRED · 한국은행 ECOS",
    /** 키가 하나도 없으면 지표를 보여 줄 수 없다 */
    available: Boolean(fredKey || ecosKey),
    usesFred: Boolean(fredKey),
    /** 모든 지표 요약. 하나가 실패해도 나머지는 보여 주고, 실패한 지표는 error로 표시한다 */
    async getIndicators() {
      // 공개 서버에 부담을 주지 않도록 동시에 3개까지만 요청한다
      const one = async (def) => {
        try {
          return summarize(def, await history(def, def.compare === "lastChange" ? 10 : 2));
        } catch (error) {
          return { id: def.id, name: def.name, unit: def.unit, group: def.group, error: error.message, source: def.source, sourceUrl: def.sourceUrl, citation: def.citation, about: def.about, freq: def.freq };
        }
      };
      const results = [];
      for (let i = 0; i < INDICATORS.length; i += 3) results.push(...(await Promise.all(INDICATORS.slice(i, i + 3).map(one))));
      return results;
    },
    async getIndicatorHistory(id) {
      const def = INDICATORS.find((i) => i.id === id);
      if (!def) return null;
      return history(def, 10);
    },
  };
}
