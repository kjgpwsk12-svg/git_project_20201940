// 경제 홈: 주요 지수, 관심 종목, 주요 종목 등락
import { formatIndexValue, formatPrice, formatVolume, toneOf } from "/shared/format.js";
import { CATALOG, findCatalogEntry, parseSymbolId, symbolId } from "/shared/symbols.js";
import { api } from "../core/api.js";
import { $, el, icon } from "../core/dom.js";
import { everyVisible, fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";
import { changePill, changeText, fetchedText, marketBadge, showMessage, skeletonRows } from "../core/ui.js";
import {
  initWatchlist,
  onWatchlistChange,
  removeFromWatchlist,
  watchlistIds,
  watchlistMode,
} from "../core/watchlist.js";

const REFRESH_MS = 60_000;
const stockHref = (id) => `/stock?id=${encodeURIComponent(id)}`;

initShell();
loadIndices();
initWatchPanel();
initMovers();

// ----- 주요 지수 -----

async function loadIndices() {
  const list = $("indices");
  list.replaceChildren(
    ...Array.from({ length: 5 }, () =>
      el("li", { class: "panel kpi" }, el("span", { class: "skeleton", style: "width:50%" }), el("p", { class: "kpi-value" }, el("span", { class: "skeleton", style: "width:70%;height:18px" }))),
    ),
  );
  try {
    const data = await api("/api/indices");
    $("indices-time").replaceChildren(fetchedText(data));
    list.replaceChildren(
      ...data.value.map((index) =>
        el(
          "li",
          { class: `panel kpi ${toneOf(index.change)}` },
          el(
            "p",
            { class: "kpi-label" },
            marketBadge(index.market),
            index.name,
            index.proxy && el("span", { class: "badge neutral", title: `${index.proxy} ETF 가격으로 대신 표시` }, index.proxy),
          ),
          el("p", { class: "kpi-value mono" }, index.proxy ? formatPrice(index.value, "US") : formatIndexValue(index.value)),
          el("p", { class: "kpi-change" }, changeText(index.change, index.changePercent, index.proxy ? "US" : "index")),
        ),
      ),
    );
  } catch (error) {
    list.replaceChildren(el("li", { class: "alert error", role: "alert" }, error.message));
  }
}

// ----- 관심 종목 -----

async function initWatchPanel() {
  const body = $("watch-body");
  const error = $("watch-error");
  const refresh = $("watch-refresh");
  const filterButtons = [...document.querySelectorAll("#watch-filter button")];
  refresh.append(icon("refresh", 15));

  let filter = "ALL";
  let quotes = {};
  let loading = false;

  const render = () => {
    const ids = watchlistIds().filter((id) => filter === "ALL" || id.startsWith(`${filter}.`));
    $("watch-mode").textContent = watchlistMode() === "db" ? "내 계정에 저장" : "이 브라우저에 저장";
    if (ids.length === 0) {
      body.replaceChildren(
        el(
          "tr",
          {},
          el(
            "td",
            { colspan: 5, class: "empty" },
            watchlistIds().length === 0 ? "관심 종목이 없어요. 상단 검색이나 주식 메뉴에서 ☆를 눌러 추가하세요." : "이 시장의 관심 종목이 없어요.",
          ),
        ),
      );
      return;
    }
    body.replaceChildren(...ids.map((id) => row(id, quotes[id])));
  };

  const row = (id, result) => {
    const symbol = parseSymbolId(id);
    const q = result?.quote;
    const name = q?.name ?? findCatalogEntry(symbol)?.name ?? symbol.code;
    const tr = el(
      "tr",
      { onclick: (e) => !e.target.closest("button") && (location.href = stockHref(id)) },
      el(
        "td",
        {},
        el(
          "a",
          { class: "sym", href: stockHref(id) },
          marketBadge(symbol.market),
          el("span", {}, el("span", { class: "sym-name" }, name), el("span", { class: "sym-code" }, symbol.code)),
        ),
      ),
      el("td", { class: "right mono" }, q ? formatPrice(q.price, symbol.market) : result ? "—" : el("span", { class: "skeleton", style: "width:60px" })),
      el("td", { class: "right" }, q ? changePill(q.changePercent) : ""),
      el("td", { class: "right mono muted hide-sm" }, q ? formatVolume(q.volume) : ""),
      el(
        "td",
        { class: "right", style: "width:44px" },
        el(
          "button",
          {
            class: "icon-btn",
            type: "button",
            "aria-label": `${name} 관심 종목에서 삭제`,
            onclick: () => removeFromWatchlist(id).catch((e) => showMessage(error, e.message)),
          },
          icon("x", 14),
        ),
      ),
    );
    return tr;
  };

  const load = async () => {
    const ids = watchlistIds();
    if (loading || ids.length === 0) return render();
    loading = true;
    refresh.firstChild.classList.add("spin");
    try {
      quotes = await fetchQuotes(ids);
      error.hidden = true;
    } catch (e) {
      showMessage(error, `시세를 불러오지 못했어요. ${e.message}`);
    } finally {
      loading = false;
      refresh.firstChild.classList.remove("spin");
      render();
    }
  };

  filterButtons.forEach((button) =>
    button.addEventListener("click", () => {
      filter = button.dataset.filter;
      filterButtons.forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      render();
    }),
  );
  refresh.addEventListener("click", load);

  body.replaceChildren(...skeletonRows(3, 5));
  try {
    await initWatchlist();
  } catch (e) {
    showMessage(error, e.message);
  }
  onWatchlistChange((ids) => {
    render();
    if (ids.some((id) => !quotes[id])) load();
  });
  render();
  load();
  everyVisible(REFRESH_MS, load);
}

// ----- 주요 종목 등락 -----

function initMovers() {
  const box = $("movers");
  const buttons = [...document.querySelectorAll("#movers-market button")];
  let market = "KR";
  let cache = {};

  const column = (title, items) =>
    el(
      "div",
      {},
      el("p", { class: "movers-head" }, title),
      items.length === 0
        ? el("p", { class: "empty", style: "padding:16px" }, "해당 종목 없음")
        : el(
            "ul",
            {},
            ...items.map(({ id, quote }) =>
              el(
                "li",
                {},
                el(
                  "a",
                  { class: "mover", href: stockHref(id) },
                  el("span", { class: "sym-name" }, quote.name),
                  el("span", { class: "mono muted sm" }, formatPrice(quote.price, quote.symbol.market)),
                  changePill(quote.changePercent),
                ),
              ),
            ),
          ),
    );

  const render = () => {
    const ids = CATALOG.filter((e) => e.symbol.market === market).map((e) => symbolId(e.symbol));
    const quotes = ids.map((id) => ({ id, quote: cache[id]?.quote })).filter((x) => x.quote);
    if (quotes.length === 0) {
      box.replaceChildren(el("p", { class: "empty", style: "grid-column:1/-1" }, "불러오는 중…"));
      return;
    }
    const sorted = [...quotes].sort((a, b) => b.quote.changePercent - a.quote.changePercent);
    const gainers = sorted.filter((x) => x.quote.changePercent > 0).slice(0, 6);
    const losers = sorted.filter((x) => x.quote.changePercent < 0).reverse().slice(0, 6);
    box.replaceChildren(column("상승 상위", gainers), column("하락 상위", losers));
    const first = Object.values(cache).find((r) => r.fetchedAt);
    if (first) $("movers-time").replaceChildren(fetchedText(first));
  };

  const load = async () => {
    const ids = CATALOG.filter((e) => e.symbol.market === market).map((e) => symbolId(e.symbol));
    try {
      cache = { ...cache, ...(await fetchQuotes(ids)) };
    } catch (e) {
      box.replaceChildren(el("p", { class: "alert error", style: "margin:16px;grid-column:1/-1" }, e.message));
      return;
    }
    render();
  };

  buttons.forEach((button) =>
    button.addEventListener("click", () => {
      market = button.dataset.market;
      buttons.forEach((b) => b.setAttribute("aria-selected", String(b === button)));
      render();
      load();
    }),
  );

  render();
  load();
  everyVisible(REFRESH_MS, load);
}
