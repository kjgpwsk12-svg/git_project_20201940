// 홈: 인사, 지수·환율, 코스피 차트, 경제 지표, 뉴스, 인기 종목, 포트폴리오, 일정, 커뮤니티
import { formatIndexValue, formatPercent, formatPrice, formatVolume, toneOf } from "/shared/format.js";
import { formatIndicatorChange, formatIndicatorDate, formatIndicatorValue } from "/shared/indicator-format.js";
import { computeHoldings, valuePortfolio } from "/shared/portfolio.js";
import { CATALOG, findCatalogEntry, parseSymbolId, symbolId } from "/shared/symbols.js";
import { DONUT_COLORS, donut } from "../components/donut.js";
import { createPriceChart } from "../components/price-chart.js";
import { api } from "../core/api.js";
import { getMyProfile, getSupabase, getUser } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { everyVisible, fetchQuotes } from "../core/quotes.js";
import { initShell, logoImage } from "../core/shell.js";
import { changeText } from "../core/ui.js";

const REFRESH_MS = 60_000;
const KPI_ORDER = ["KOSPI", "KOSDAQ", "SPX", "NDX", "USDKRW", "DJI"];
// 경제 지표(FRED·한국은행 실제 자료)는 한 번만 불러와 여러 카드가 함께 쓴다
const indicatorsRequest = api("/api/indicators").catch((error) => ({ error }));
const realUsdKrw = () => indicatorsRequest.then((d) => d.value?.find((i) => i.id === "USDKRW" && !i.error) ?? null);
const stockHref = (id) => `/stock?id=${encodeURIComponent(id)}`;

initShell();
$("hero-logo").replaceChildren(logoImage(26));
greet();
loadIndices();
loadChart();
loadIndicators();
loadNews();
initPopular();
loadSchedule();
loadCommunity();
loadPortfolio();
everyVisible(REFRESH_MS, loadIndices);

// ----- 인사 -----

async function greet() {
  const profile = await getMyProfile().catch(() => null);
  if (profile) $("greeting").textContent = `안녕하세요, ${profile.nickname}님`;
}

// ----- 지수·환율 카드 -----

function formatIndex(index) {
  if (index.proxy) return formatPrice(index.value, "US");
  return formatIndexValue(index.value);
}

function indexCard(index) {
  return el(
    "li",
    { class: "panel kpi" },
    el("p", { class: "kpi-label" }, index.name, index.proxy && el("span", { class: "badge neutral", title: `${index.proxy} ETF 가격으로 대신 표시` }, index.proxy)),
    el("p", { class: "kpi-value mono" }, formatIndex(index)),
    el("p", { class: "kpi-change" }, changeText(index.change, index.changePercent, index.proxy ? "US" : "index")),
  );
}

/** 원/달러 카드. fx가 undefined면 불러오는 중, null이면 실패 (데모 값은 보여 주지 않는다) */
function fxCard(fx) {
  return el(
    "li",
    { class: "panel kpi", dataset: { fx: "" } },
    el("p", { class: "kpi-label" }, "원/달러", fx && el("span", { class: "badge neutral", title: "FRED(미 연준 H.10) 자료, 약 1주 지연" }, formatIndicatorDate(fx.date))),
    fx
      ? [el("p", { class: "kpi-value mono" }, formatIndicatorValue(fx).replace("원", "")), el("p", { class: "kpi-change" }, changeText(fx.change, fx.changePercent, "index"))]
      : fx === null
        ? [el("p", { class: "kpi-value mono muted" }, "—"), el("p", { class: "kpi-change muted" }, "실제 환율 없음")]
        : el("p", { class: "kpi-value" }, el("span", { class: "skeleton", style: "width:90px;height:18px" })),
  );
}

async function loadIndices() {
  const list = $("indices");
  if (!list.hasChildNodes()) {
    list.replaceChildren(
      ...Array.from({ length: 5 }, () =>
        el("li", { class: "panel kpi" }, el("span", { class: "kpi-label" }, el("span", { class: "skeleton", style: "width:60px" })), el("span", { class: "kpi-value" }, el("span", { class: "skeleton", style: "width:90px;height:18px" }))),
      ),
    );
  }
  try {
    const data = await api("/api/indices");
    const byId = Object.fromEntries(data.value.map((i) => [i.id, i]));
    const shown = KPI_ORDER.map((id) => byId[id]).filter(Boolean).slice(0, 5);
    list.replaceChildren(
      // 홈 지수 카드는 좁게 쓰므로 작은 그래프 없이 숫자만 보여 준다
      ...shown.map((index) => (index.id === "USDKRW" ? fxCard(undefined) : indexCard(index))),
    );
    // 환율 카드는 데모 시세 대신 실제 자료(FRED)를 쓴다 (지표 화면과 숫자가 어긋나지 않게). 도착하면 바꿔 끼운다
    realUsdKrw().then((fx) => list.querySelector("[data-fx]")?.replaceWith(fxCard(fx)));
  } catch (error) {
    list.replaceChildren(el("li", { class: "panel alert error", role: "alert" }, error.message));
  }
}

// ----- 코스피 차트 -----

async function loadChart() {
  const box = $("chart");
  try {
    const { value: candles } = await api("/api/indices/KOSPI/candles");
    const last = candles.at(-1);
    const prev = candles.at(-2);
    $("chart-price").textContent = formatIndexValue(last.close);
    $("chart-change").replaceChildren(changeText(last.close - prev.close, ((last.close - prev.close) / prev.close) * 100, "index"));

    const chart = createPriceChart(box, { candles, market: "US", onSelectDate: () => {} });
    chart.setRange("3M");
    const buttons = [...document.querySelectorAll("#chart-range button")];
    buttons.forEach((button) =>
      button.addEventListener("click", () => {
        buttons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
        chart.setRange(button.dataset.range);
      }),
    );
  } catch (error) {
    box.replaceChildren(el("p", { class: "empty" }, error.message));
  }
}

// ----- 경제 지표 -----


async function loadIndicators() {
  const list = $("indicators");
  try {
    const data = await indicatorsRequest;
    if (data.error) throw data.error;
    if (!data.available) {
      list.replaceChildren(el("li", { class: "empty", style: "display:block" }, "FRED·한국은행 ECOS API 키를 넣으면 실제 경제 지표가 표시돼요."));
      return;
    }
    $("indi-meta").textContent = data.stale ? "갱신 실패 · 이전 데이터" : "FRED · 한국은행";
    // 홈에는 주요 6개만 (전체는 경제지표 화면에서)
    const HOME_IDS = ["FEDRATE", "KRRATE", "US10Y", "CPI", "USDKRW", "WTI"];
    const shown = HOME_IDS.map((id) => data.value.find((i) => i.id === id)).filter(Boolean);
    list.replaceChildren(
      ...shown.map((ind) =>
        el(
          "li",
          {},
          el("span", { class: "name" }, ind.name, ind.date && el("small", { class: "muted" }, ` ${formatIndicatorDate(ind.date)}`)),
          ind.error
            ? el("span", { class: "value muted" }, "불러오지 못함")
            : el("span", { class: "value" }, formatIndicatorValue(ind)),
          ind.error
            ? el("span", { class: "delta muted" }, "")
            : el("span", { class: `delta ${ind.change ? toneOf(ind.change) : "muted"}` }, formatIndicatorChange(ind)),
        ),
      ),
    );
  } catch (error) {
    list.replaceChildren(el("li", { class: "empty", style: "display:block" }, error.message));
  }
}

// ----- 최신 뉴스 -----

const NEWS_ICON = { "국내 증시": "candles", "해외 증시": "chart", "경제 지표": "clock", 기업: "briefcase", 외환: "refresh", 원자재: "logo" };

function relativeTime(iso) {
  const minutes = Math.max(1, Math.round((Date.now() - new Date(iso)) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  if (minutes < 60 * 24) return `${Math.round(minutes / 60)}시간 전`;
  return `${Math.round(minutes / 60 / 24)}일 전`;
}

async function loadNews() {
  const list = $("market-news");
  try {
    const data = await api("/api/market-news");
    if (!data.available) {
      list.replaceChildren(el("li", { class: "empty" }, "뉴스 API 키를 설정하면 최신 뉴스가 표시돼요."));
      return;
    }
    const items = data.value.slice(0, 5);
    if (items.length === 0) {
      list.replaceChildren(el("li", { class: "empty" }, "최근 뉴스가 없어요."));
      return;
    }
    list.replaceChildren(
      ...items.map((item, i) => {
        const body = [
          el("span", { class: `news-thumb c${i % 4}`, "aria-hidden": "true" }, icon(NEWS_ICON[item.category] ?? "news", 20)),
          el(
            "span",
            {},
            el("span", { class: "news-row-title" }, item.title),
            el("span", { class: "news-row-meta" }, `${relativeTime(item.publishedAt)} · ${item.category ?? item.source}`),
          ),
        ];
        return el(
          "li",
          {},
          item.url
            ? el("a", { class: "news-row", href: item.url, target: "_blank", rel: "noopener noreferrer" }, ...body)
            : el("div", { class: "news-row" }, ...body),
        );
      }),
    );
  } catch (error) {
    list.replaceChildren(el("li", { class: "empty" }, error.message));
  }
}

// ----- 인기 종목 (거래량 순) -----

function initPopular() {
  const body = $("pop-body");
  const tabs = [...document.querySelectorAll("#pop-tabs button")];
  let tab = "KOSPI";
  let quotes = {};

  const idsFor = (t) =>
    CATALOG.filter((e) => (t === "US" ? e.symbol.market === "US" : e.symbol.market === "KR" && e.board === t)).map((e) => symbolId(e.symbol));

  const render = () => {
    const rows = idsFor(tab)
      .map((id) => ({ id, q: quotes[id]?.quote }))
      .filter((r) => r.q)
      .sort((a, b) => b.q.volume - a.q.volume)
      .slice(0, 5);
    if (rows.length === 0) {
      body.replaceChildren(el("tr", {}, el("td", { colspan: 4, class: "empty" }, "불러오는 중…")));
      return;
    }
    body.replaceChildren(
      ...rows.map(({ id, q }) =>
        el(
          "tr",
          { onclick: () => (location.href = stockHref(id)) },
          el("td", {}, el("a", { href: stockHref(id), class: "sym-name" }, q.name)),
          el("td", { class: "right num" }, formatPrice(q.price, q.symbol.market).replace("원", "")),
          el("td", { class: `right num ${toneOf(q.changePercent)}`, style: "font-weight:700" }, `${q.changePercent > 0 ? "▲" : q.changePercent < 0 ? "▼" : ""} ${formatPercent(Math.abs(q.changePercent)).replace("+", "")}`),
          el("td", { class: "right num muted vol" }, formatVolume(q.volume)),
        ),
      ),
    );
  };

  const load = async () => {
    try {
      quotes = { ...quotes, ...(await fetchQuotes(idsFor(tab))) };
    } catch (error) {
      body.replaceChildren(el("tr", {}, el("td", { colspan: 4, class: "empty" }, error.message)));
      return;
    }
    render();
  };

  tabs.forEach((button) =>
    button.addEventListener("click", () => {
      tab = button.dataset.tab;
      tabs.forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      render();
      load();
    }),
  );
  render();
  load();
  everyVisible(REFRESH_MS, load);
}

// ----- 경제 일정 (DB) -----

async function loadSchedule() {
  const list = $("schedule");
  const client = await getSupabase();
  if (!client) {
    list.replaceChildren(el("li", { class: "empty" }, "로그인 기능(DB)이 설정되지 않았어요."));
    return;
  }
  const start = new Date();
  start.setHours(0, 0, 0, 0);
  const end = new Date(start.getTime() + 7 * 86400_000);
  const { data, error } = await client
    .from("economic_events")
    .select("id, country, title, scheduled_at, time_tbd")
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at")
    .limit(5);
  if (error || !data?.length) {
    list.replaceChildren(el("li", { class: "empty" }, error ? "일정을 불러오지 못했어요." : "이번 주 등록된 일정이 없어요."));
    return;
  }
  const fmt = new Intl.DateTimeFormat("ko-KR", { month: "2-digit", day: "2-digit", timeZone: "Asia/Seoul" });
  const time = new Intl.DateTimeFormat("ko-KR", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: "Asia/Seoul" });
  list.replaceChildren(
    ...data.map((e) =>
      el(
        "li",
        {},
        el("span", { class: "when" }, fmt.format(new Date(e.scheduled_at)).replace(/\s/g, "").replace(/\.$/, "")),
        el("span", {}, `${e.country === "KR" ? "한국" : e.country === "US" ? "미국" : ""} ${e.title}`, e.time_tbd ? "" : el("span", { class: "muted" }, ` (${time.format(new Date(e.scheduled_at))})`)),
      ),
    ),
  );
}

// ----- 커뮤니티 인기글 (DB) -----

async function loadCommunity() {
  const list = $("community");
  const client = await getSupabase();
  if (!client) {
    list.replaceChildren(el("li", { class: "empty" }, "로그인 기능(DB)이 설정되지 않았어요."));
    return;
  }
  const { data, error } = await client
    .from("posts")
    .select("id, title, body, like_count, comment_count")
    .neq("board", "sns")
    .order("like_count", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(4);
  if (error || !data?.length) {
    list.replaceChildren(el("li", { class: "empty" }, error ? "게시글을 불러오지 못했어요." : "아직 게시글이 없어요."));
    return;
  }
  list.replaceChildren(
    ...data.map((p) =>
      el("li", {}, el("a", { class: "title", href: `/post?id=${p.id}` }, p.title ?? p.body), el("span", { class: "count" }, icon("board", 13), String(p.comment_count))),
    ),
  );
}

// ----- 내 포트폴리오 요약 (로그인했을 때만) -----

async function loadPortfolio() {
  const client = await getSupabase();
  const user = await getUser();
  const note = $("port-note");
  if (!client || !user) {
    note.replaceChildren(el("a", { class: "link", href: "/login?next=%2Fportfolio" }, "로그인"), "하고 투자 기록을 입력하면 자산과 손익이 표시돼요.");
    return;
  }
  const { data, error } = await client.from("transactions").select("*").limit(5000);
  if (error) {
    note.textContent = "투자 기록을 불러오지 못했어요.";
    return;
  }
  if (!data.length) {
    note.replaceChildren(el("a", { class: "link", href: "/portfolio" }, "첫 거래를 기록"), "하면 자산과 손익이 표시돼요.");
    return;
  }
  const { holdings } = computeHoldings(data);
  const held = holdings.filter((h) => h.quantity > 0).map((h) => h.symbolId);
  const [quotes, indices] = await Promise.all([fetchQuotes(held.slice(0, 60)).catch(() => ({})), api("/api/indices").catch(() => null)]);
  const prices = Object.fromEntries(Object.entries(quotes).filter(([, r]) => r.quote).map(([id, r]) => [id, r.quote.price]));
  // 달러 자산 환산은 실제 환율(FRED)을 쓰고, 없을 때만 지수 목록의 값을 쓴다
  const usdKrw = (await realUsdKrw())?.value ?? indices?.value?.find((i) => i.id === "USDKRW")?.value ?? null;
  const result = valuePortfolio(holdings, prices, usdKrw);

  $("port-value").textContent = formatPrice(result.totalValue, "KR");
  const sign = result.totalProfit > 0 ? "+" : result.totalProfit < 0 ? "-" : "";
  note.replaceChildren(
    el("span", { class: toneOf(result.totalProfit) }, `${sign}${formatPrice(Math.abs(result.totalProfit), "KR")}${result.totalRate === null ? "" : ` (${formatPercent(result.totalRate)})`}`),
    ` · 보유 ${result.rows.length}종목`,
  );
  const known = result.rows.filter((r) => r.weight !== null);
  const segments = known.slice(0, 7).map((r, i) => ({
    label: findCatalogEntry(parseSymbolId(r.symbolId))?.name ?? r.symbolId,
    value: r.valueKrw,
    color: DONUT_COLORS[i],
  }));
  const rest = known.slice(7).reduce((sum, r) => sum + r.valueKrw, 0);
  if (rest > 0) segments.push({ label: "기타", value: rest, color: DONUT_COLORS[7] });
  const total = segments.reduce((sum, x) => sum + x.value, 0) || 1;
  document.querySelector(".area-port .donut").replaceWith(
    donut(segments, { size: 110, label: `자산 구성: ${segments.map((x) => `${x.label} ${((x.value / total) * 100).toFixed(1)}%`).join(", ")}` }),
  );
}
