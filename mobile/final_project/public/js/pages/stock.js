// 종목 상세: 시세 배너, 요약 카드, 가격 차트와 뉴스 연결, 종목 정보, 같은 시장 종목, 종목 토론
// 차트의 날짜(또는 큰 움직임 목록)를 고르면 그날 영향을 준 뉴스를 보여준다.
import {
  formatDateLabel,
  formatKoreanDateTime,
  formatPercent,
  formatPrice,
  formatVolume,
  toneOf,
} from "/shared/format.js";
import { assignNewsToTradingDays, buildNewsMarkers, changePercents } from "/shared/news-markers.js";
import { CATALOG, findCatalogEntry, parseSymbolId, symbolId } from "/shared/symbols.js";
import { createPriceChart } from "../components/price-chart.js";
import { api } from "../core/api.js";
import { getSupabase } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";
import { changeText, fetchedText, marketBadge, showMessage, toggleWithToast } from "../core/ui.js";
import { initWatchlist, isWatched, onWatchlistChange, toggleWatchlist } from "../core/watchlist.js";

initShell();

const stockHref = (id) => `/stock?id=${encodeURIComponent(id)}`;
let thumbIndex = 0; // 뉴스 썸네일 색 순환
const symbol = parseSymbolId(new URLSearchParams(location.search).get("id") ?? "");
if (!symbol) {
  showMessage($("stock-error"), "종목 주소가 올바르지 않아요. 예: /stock?id=KR.005930, /stock?id=US.NAS.AAPL");
} else {
  await main(symbol);
}

async function main(symbol) {
  const id = symbolId(symbol);
  let data;
  try {
    data = await api(`/api/stocks/${encodeURIComponent(id)}`);
  } catch (error) {
    showMessage($("stock-error"), error.message);
    return;
  }

  const { quote, candles, news, newsUnavailable, status } = data;
  const q = quote.value;
  const entry = findCatalogEntry(symbol);
  document.title = `${q.name} · ECONOVA`;
  $("stock").hidden = false;

  // 배너
  const logo = $("quote-logo");
  logo.textContent = q.name.slice(0, 1);
  logo.classList.add(symbol.market === "KR" ? "kr" : "us");
  $("quote-id").replaceChildren(
    ...[
      marketBadge(symbol.market),
      el("span", {}, symbol.code),
      symbol.market === "US" ? el("span", {}, `· ${symbol.exchange}`) : entry?.board && el("span", {}, `· ${entry.board === "KOSDAQ" ? "코스닥" : "코스피"}`),
    ].filter(Boolean),
  );
  $("quote-name").textContent = q.name;
  $("quote-price").textContent = formatPrice(q.price, symbol.market);
  $("quote-change").replaceChildren(changeText(q.change, q.changePercent, symbol.market));
  $("quote-time").replaceChildren(fetchedText(quote));
  initWatchToggle(id, q.name);

  renderStats(symbol.market, q, candles.value);
  renderInfo(symbol, entry, candles.value, status);
  loadPeers(symbol, entry, id);
  loadTalk(id);

  $("stock-source").textContent =
    `시세: ${status.marketLabel}` +
    (status.newsLabel[symbol.market] ? ` · 뉴스: ${status.newsLabel[symbol.market]}` : "") +
    " · 장 마감 이후 기사는 다음 거래일에 배정됩니다. 뉴스와 주가의 인과관계를 뜻하지 않습니다.";

  if (candles.value.length < 2) {
    $("chart").replaceWith(el("p", { class: "empty" }, "차트를 그릴 일봉 데이터가 부족해요."));
    return;
  }
  initInsight(symbol.market, candles.value, news, newsUnavailable);
}

async function initWatchToggle(id, name) {
  const button = $("watch-toggle");
  const render = () => {
    const on = isWatched(id);
    button.setAttribute("aria-pressed", String(on));
    button.replaceChildren(icon("star", 15), on ? "관심 종목" : "관심 종목 추가");
    button.setAttribute("aria-label", on ? `${name} 관심 종목에서 삭제` : `${name} 관심 종목에 추가`);
  };
  button.addEventListener("click", () => toggleWithToast(toggleWatchlist, id, name, isWatched).catch((e) => showMessage($("stock-error"), e.message)));
  button.disabled = true;
  render();
  await initWatchlist().catch(() => {});
  button.disabled = false;
  onWatchlistChange(render);
  render();
}

// ----- 요약 카드 -----

function renderStats(market, q, candles) {
  const last = candles.at(-1);
  const avgVolume = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / Math.max(1, Math.min(20, candles.length));
  const stat = (label, value, cls = "") =>
    el("div", { class: "panel kpi" }, el("dt", { class: "kpi-label" }, label), el("dd", { class: `kpi-value ${cls}` }, value));
  $("stats").replaceChildren(
    stat("시가", last ? formatPrice(last.open, market) : "—"),
    stat("고가", last ? formatPrice(last.high, market) : "—", "up"),
    stat("저가", last ? formatPrice(last.low, market) : "—", "down"),
    stat(`${candles.length}일 최고가`, candles.length ? formatPrice(Math.max(...candles.map((c) => c.high)), market) : "—"),
    // 거래량 지표는 뒤쪽에 묶는다
    stat("거래량", formatVolume(q.volume)),
    stat("20일 평균 거래량", candles.length ? formatVolume(Math.round(avgVolume)) : "—"),
  );
}

// ----- 종목 정보 -----

function renderInfo(symbol, entry, candles, status) {
  const low = candles.length ? Math.min(...candles.map((c) => c.low)) : null;
  const first = candles[0];
  const last = candles.at(-1);
  const periodChange = first && last ? ((last.close - first.close) / first.close) * 100 : null;
  const rows = [
    ["시장", symbol.market === "KR" ? (entry?.board === "KOSDAQ" ? "국내 · 코스닥" : "국내 · 코스피") : `미국 · ${{ NAS: "나스닥", NYS: "뉴욕", AMS: "NYSE 아메리칸" }[symbol.exchange]}`],
    ["종목 코드", symbol.code],
    ["거래 통화", symbol.market === "KR" ? "원 (KRW)" : "달러 (USD)"],
    ["기간 최저", low === null ? "—" : formatPrice(low, symbol.market)],
    ["기간 수익률", periodChange === null ? "—" : el("span", { class: toneOf(periodChange) }, formatPercent(periodChange))],
    ["시세 출처", status.marketLabel],
  ];
  $("info").replaceChildren(...rows.flatMap(([k, v]) => [el("dt", {}, k), el("dd", {}, v)]));
}

// ----- 같은 시장 종목 -----

async function loadPeers(symbol, entry, id) {
  const list = $("peers");
  const peers = CATALOG.filter((e) =>
    symbol.market === "US" ? e.symbol.market === "US" : e.symbol.market === "KR" && e.board === (entry?.board ?? "KOSPI"),
  )
    .map((e) => symbolId(e.symbol))
    .filter((x) => x !== id)
    .slice(0, 6);
  const tab = symbol.market === "US" ? "US" : entry?.board ?? "KOSPI";
  $("peers-more").href = `/stocks?tab=${tab}`;
  if (peers.length === 0) {
    list.replaceChildren(el("li", { class: "empty" }, "비교할 종목이 없어요."));
    return;
  }
  let quotes = {};
  try {
    quotes = await fetchQuotes(peers);
  } catch {
    // 시세 없이 이름만 보여준다
  }
  list.replaceChildren(
    ...peers.map((pid) => {
      const p = parseSymbolId(pid);
      const pq = quotes[pid]?.quote;
      const name = pq?.name ?? findCatalogEntry(p)?.name ?? p.code;
      return el(
        "li",
        {},
        el(
          "a",
          { href: stockHref(pid) },
          el("span", { class: `sym-logo ${p.market === "KR" ? "kr" : "us"}`, "aria-hidden": "true" }, name.slice(0, 1)),
          el("span", { class: "rank-name" }, name, el("small", {}, p.code)),
          el("span", { class: "price" }, pq ? formatPrice(pq.price, p.market) : "—", pq && el("small", { class: toneOf(pq.changePercent) }, formatPercent(pq.changePercent))),
        ),
      );
    }),
  );
}

// ----- 종목 토론 (DB) -----

async function loadTalk(id) {
  $("talk-write").href = `/write?stock=${encodeURIComponent(id)}`;
  const list = $("talk");
  const client = await getSupabase();
  if (!client) {
    list.replaceChildren(el("li", { class: "empty" }, "로그인 기능(DB)이 설정되지 않았어요."));
    return;
  }
  const { data, error } = await client
    .from("posts")
    .select("id, title, body, comment_count")
    .eq("stock_symbol", id)
    .neq("board", "sns")
    .order("created_at", { ascending: false })
    .limit(5);
  if (error || !data?.length) {
    list.replaceChildren(el("li", { class: "empty" }, error ? "게시글을 불러오지 못했어요." : "아직 이 종목에 대한 글이 없어요."));
    return;
  }
  list.replaceChildren(
    ...data.map((p) => el("li", {}, el("a", { class: "title", href: `/post?id=${p.id}` }, p.title), el("span", { class: "count" }, icon("board", 13), String(p.comment_count)))),
  );
}

// ----- 차트와 뉴스 -----

function initInsight(market, candles, news, newsUnavailable) {
  const newsByDay = assignNewsToTradingDays(news, candles, market);
  const markers = buildNewsMarkers(candles, newsByDay);
  const changes = changePercents(candles);
  const bigMoves = markers.filter((m) => m.kind !== "flat").reverse();
  let selected = null;

  const chart = createPriceChart($("chart"), { candles, market, onSelectDate: (date) => select(date) });
  chart.setMarkers(markers);
  chart.setRange("3M");

  const rangeButtons = [...document.querySelectorAll("#range button")];
  rangeButtons.forEach((button) =>
    button.addEventListener("click", () => {
      rangeButtons.forEach((b) => b.setAttribute("aria-pressed", String(b === button)));
      chart.setRange(button.dataset.range);
    }),
  );

  // 큰 움직임 목록: 차트를 쓰기 어려운 키보드·스크린리더 사용자도 같은 기능을 쓸 수 있다
  const renderMoves = () => {
    if (bigMoves.length === 0) {
      $("moves").replaceChildren(
        el("li", { class: "sm muted" }, newsUnavailable ? "뉴스를 불러오지 못해 표시할 수 없어요." : "이 기간에 뉴스와 겹친 큰 움직임이 없어요."),
      );
      return;
    }
    $("moves").replaceChildren(
      ...bigMoves.map((m) =>
        el(
          "li",
          {},
          el(
            "button",
            { class: "chip", type: "button", "aria-pressed": String(selected === m.date), onclick: () => select(m.date) },
            m.date.slice(2).replaceAll("-", "."),
            el("span", { class: m.kind }, formatPercent(m.changePercent)),
          ),
        ),
      ),
    );
  };

  const renderNews = () => {
    $("news-reset").hidden = !selected;
    const info = $("day-info");
    if (selected) {
      $("news-title").textContent = formatDateLabel(selected);
      const candle = candles.find((c) => c.date === selected);
      const change = changes.get(selected) ?? 0;
      info.hidden = !candle;
      if (candle) {
        info.replaceChildren(
          `종가 ${formatPrice(candle.close, market)}  `,
          el("span", { class: toneOf(change) }, formatPercent(change)),
          `  ·  거래량 ${formatVolume(candle.volume)}`,
        );
      }
    } else {
      $("news-title").textContent = "관련 뉴스";
      info.hidden = true;
    }

    if (newsUnavailable) {
      $("news").replaceChildren(el("li", { class: "empty" }, newsUnavailable));
      return;
    }
    const items = selected ? newsByDay.get(selected) ?? [] : news.slice(0, 30);
    $("news").replaceChildren(
      ...(items.length
        ? items.map(newsItem)
        : [el("li", { class: "empty" }, selected ? "이 날 영향을 준 것으로 분류된 뉴스가 없어요." : "최근 뉴스가 없어요.")]),
    );
  };

  const select = (date) => {
    selected = date;
    chart.setSelected(date);
    renderMoves();
    renderNews();
  };

  $("news-reset").addEventListener("click", () => select(null));
  renderMoves();
  renderNews();
}


function newsItem(item) {
  const body = [
    el("span", { class: `news-thumb c${thumbIndex++ % 4}`, "aria-hidden": "true" }, icon("news", 20)),
    el(
      "span",
      {},
      el("span", { class: "news-row-title" }, item.title),
      el("span", { class: "news-row-meta" }, `${item.source} · ${formatKoreanDateTime(item.publishedAt)}`),
    ),
  ];
  // 데모 기사는 링크가 없다. 실제 기사는 원문을 새 창으로 연다.
  return el(
    "li",
    {},
    item.url
      ? el("a", { class: "news-row", href: item.url, target: "_blank", rel: "noopener noreferrer" }, ...body)
      : el("div", { class: "news-row" }, ...body),
  );
}
