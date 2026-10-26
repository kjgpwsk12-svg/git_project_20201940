// 주식: 시장 지수, 종목 시세 표(코스피·코스닥·해외·관심), 오늘의 급등락, 관심 종목
import { formatChange, formatIndexValue, formatPercent, formatPrice, formatVolume, toneOf } from "/shared/format.js";
import { CATALOG, findCatalogEntry, parseSymbolId, symbolId } from "/shared/symbols.js";
import { sparkline } from "../components/sparkline.js";
import { api } from "../core/api.js";
import { $, el, icon } from "../core/dom.js";
import { everyVisible, fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";
import { changeText, fetchedText, showMessage, toggleWithToast } from "../core/ui.js";
import {
  initWatchlist,
  isWatched,
  onWatchlistChange,
  toggleWatchlist,
  watchlistIds,
  watchlistMode,
} from "../core/watchlist.js";

initShell();

const TABS = ["KOSPI", "KOSDAQ", "US", "WATCH"];
const TAB_LABEL = { KOSPI: "코스피", KOSDAQ: "코스닥", US: "해외", WATCH: "관심 종목" };
const rowsEl = $("rows");
const errorEl = $("list-error");
const filterInput = $("filter");
const tabButtons = [...document.querySelectorAll("#tabs button")];
const sortButtons = [...document.querySelectorAll(".th-sort")];
const dirButtons = [...document.querySelectorAll("#movers-dir button")];

const params = new URLSearchParams(location.search);
const legacy = { KR: "KOSPI" }; // 예전 주소 호환
let tab = TABS.includes(params.get("tab")) ? params.get("tab") : legacy[params.get("tab")] ?? "KOSPI";
let sort = { key: "volume", dir: -1 };
let moverDir = "up";
let quotes = {};

const stockHref = (id) => `/stock?id=${encodeURIComponent(id)}`;
const entryOf = (id) => findCatalogEntry(parseSymbolId(id));
const nameOf = (id) => quotes[id]?.quote?.name ?? entryOf(id)?.name ?? parseSymbolId(id).code;

function idsFor(t) {
  if (t === "WATCH") return watchlistIds();
  return CATALOG.filter((e) => (t === "US" ? e.symbol.market === "US" : e.symbol.market === "KR" && e.board === t)).map((e) =>
    symbolId(e.symbol),
  );
}

/** 종목 로고 자리: 이름 첫 글자 */
function logo(id) {
  const symbol = parseSymbolId(id);
  return el("span", { class: `sym-logo ${symbol.market === "KR" ? "kr" : "us"}`, "aria-hidden": "true" }, nameOf(id).slice(0, 1));
}

// ----- 시장 지수 -----

async function loadIndices() {
  const list = $("indices");
  try {
    const data = await api("/api/indices");
    const shown = ["KOSPI", "KOSDAQ", "SPX", "NDX"].map((id) => data.value.find((i) => i.id === id)).filter(Boolean);
    list.replaceChildren(
      ...shown.map((index) =>
        el(
          "li",
          { class: "panel kpi" },
          el("p", { class: "kpi-label" }, index.name, index.proxy && el("span", { class: "badge neutral", title: `${index.proxy} ETF 가격으로 대신 표시` }, index.proxy)),
          el("p", { class: "kpi-value mono" }, index.proxy ? formatPrice(index.value, "US") : formatIndexValue(index.value)),
          el("p", { class: "kpi-change" }, changeText(index.change, index.changePercent, index.proxy ? "US" : "index")),
          sparkline(index.spark, toneOf(index.change)),
        ),
      ),
    );
  } catch (error) {
    list.replaceChildren(el("li", { class: "panel alert error" }, error.message));
  }
}

// ----- 종목 표 -----

function sortValue(id) {
  const q = quotes[id]?.quote;
  switch (sort.key) {
    case "name":
      return nameOf(id);
    case "price":
      return q?.price ?? -Infinity;
    case "diff":
      return q?.change ?? -Infinity;
    case "change":
      return q?.changePercent ?? -Infinity;
    default:
      return q?.volume ?? -Infinity;
  }
}

function renderTable() {
  const query = filterInput.value.trim().toLowerCase();
  const ids = idsFor(tab)
    .filter((id) => !query || nameOf(id).toLowerCase().includes(query) || id.toLowerCase().includes(query))
    .sort((a, b) => {
      const va = sortValue(a);
      const vb = sortValue(b);
      return (typeof va === "string" ? va.localeCompare(vb, "ko") : va - vb) * sort.dir;
    });

  sortButtons.forEach((b) => {
    const active = b.dataset.sort === sort.key;
    b.closest("th").setAttribute("aria-sort", active ? (sort.dir > 0 ? "ascending" : "descending") : "none");
    b.querySelector("svg")?.remove();
    // 정렬 중인 열은 방향 아이콘, 나머지는 흐린 아이콘으로 "정렬 가능"을 알린다
    const mark = icon(active && sort.dir > 0 ? "sortUp" : "sortDown", 12);
    if (!active) mark.classList.add("sort-idle");
    b.append(mark);
  });

  $("list-count").textContent = `${TAB_LABEL[tab]} · ${ids.length}개 종목`;
  const any = Object.values(quotes).find((r) => r.fetchedAt);
  if (any) $("list-time").replaceChildren(fetchedText(any));

  if (ids.length === 0) {
    rowsEl.replaceChildren(
      el(
        "tr",
        {},
        el("td", { colspan: 6, class: "empty" }, tab === "WATCH" && !query ? "관심 종목이 없어요. ☆를 눌러 추가하세요." : "조건에 맞는 종목이 없어요."),
      ),
    );
    return;
  }
  rowsEl.replaceChildren(...ids.map(row));
}

function row(id) {
  const symbol = parseSymbolId(id);
  const result = quotes[id];
  const q = result?.quote;
  const name = nameOf(id);
  const watched = isWatched(id);
  const tone = q ? toneOf(q.change) : "flat";
  const arrow = tone === "up" ? "▲ " : tone === "down" ? "▼ " : "";
  return el(
    "tr",
    { onclick: (e) => !e.target.closest("button, a") && (location.href = stockHref(id)) },
    el(
      "td",
      {},
      el(
        "button",
        {
          class: "icon-btn star-btn",
          type: "button",
          "aria-pressed": String(watched),
          "aria-label": watched ? `${name} 관심 종목에서 삭제` : `${name} 관심 종목에 추가`,
          onclick: () => toggleWithToast(toggleWatchlist, id, name, isWatched).catch((e) => showMessage(errorEl, e.message)),
        },
        icon("star", 16),
      ),
    ),
    el(
      "td",
      {},
      el(
        "a",
        { class: "sym", href: stockHref(id) },
        logo(id),
        el("span", {}, el("span", { class: "sym-name" }, name), el("span", { class: "sym-code" }, symbol.market === "US" ? `${symbol.exchange} · ${symbol.code}` : symbol.code)),
      ),
    ),
    el("td", { class: "right num", style: "font-weight:700" }, q ? formatPrice(q.price, symbol.market) : result ? "—" : el("span", { class: "skeleton", style: "width:70px" })),
    el("td", { class: `right num diff hide-sm ${tone}` }, q ? `${arrow}${formatChange(Math.abs(q.change), symbol.market).replace("+", "")}` : ""),
    el("td", { class: `right num rate ${tone}` }, q ? formatPercent(q.changePercent) : ""),
    el("td", { class: "right num muted hide-sm" }, q ? formatVolume(q.volume) : ""),
  );
}

// ----- 오늘의 급등락 -----

function renderMovers() {
  const scope = tab === "WATCH" ? "KOSPI" : tab;
  $("movers-scope").textContent = `${TAB_LABEL[scope]} 주요 종목 · 등락률 기준`;
  const list = idsFor(scope)
    .map((id) => ({ id, q: quotes[id]?.quote }))
    .filter((x) => x.q && (moverDir === "up" ? x.q.changePercent > 0 : x.q.changePercent < 0))
    .sort((a, b) => (moverDir === "up" ? b.q.changePercent - a.q.changePercent : a.q.changePercent - b.q.changePercent))
    .slice(0, 5);
  if (list.length === 0) {
    $("movers").replaceChildren(el("li", { class: "empty" }, Object.keys(quotes).length ? "해당 종목이 없어요." : "불러오는 중…"));
    return;
  }
  $("movers").replaceChildren(
    ...list.map(({ id, q }, i) =>
      el(
        "li",
        {},
        el(
          "a",
          { href: stockHref(id) },
          el("span", { class: "rank-no" }, String(i + 1)),
          el("span", { class: "rank-name" }, q.name, el("small", {}, formatPrice(q.price, q.symbol.market))),
          el("span", { class: `rank-rate ${toneOf(q.changePercent)}` }, formatPercent(q.changePercent)),
        ),
      ),
    ),
  );
}

// ----- 관심 종목 -----

function renderWatch() {
  $("watch-mode").textContent = watchlistMode() === "db" ? "내 계정" : "이 브라우저";
  const ids = watchlistIds();
  if (ids.length === 0) {
    $("watch-mini").replaceChildren(el("li", { class: "empty" }, "☆를 눌러 관심 종목을 추가하세요."));
    return;
  }
  $("watch-mini").replaceChildren(
    ...ids.slice(0, 8).map((id) => {
      const q = quotes[id]?.quote;
      const symbol = parseSymbolId(id);
      return el(
        "li",
        {},
        el(
          "a",
          { href: stockHref(id) },
          logo(id),
          el("span", { class: "rank-name" }, nameOf(id), el("small", {}, symbol.code)),
          el(
            "span",
            { class: "price" },
            q ? formatPrice(q.price, symbol.market) : "—",
            q && el("small", { class: toneOf(q.changePercent) }, formatPercent(q.changePercent)),
          ),
        ),
      );
    }),
  );
}

// ----- 불러오기와 이벤트 -----

function renderAll() {
  renderTable();
  renderMovers();
  renderWatch();
}

async function load() {
  const ids = [...new Set([...idsFor(tab === "WATCH" ? "KOSPI" : tab), ...watchlistIds()])];
  try {
    quotes = { ...quotes, ...(await fetchQuotes(ids)) };
    errorEl.hidden = true;
  } catch (e) {
    showMessage(errorEl, `시세를 불러오지 못했어요. ${e.message}`);
  }
  renderAll();
}

function selectTab(next) {
  tab = next;
  tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  const url = new URL(location.href);
  url.searchParams.set("tab", tab);
  history.replaceState(null, "", url);
  renderAll();
  load();
}

tabButtons.forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
$("watch-all").addEventListener("click", () => {
  selectTab("WATCH");
  $("list-title").scrollIntoView({ behavior: "smooth", block: "start" });
});
sortButtons.forEach((b) =>
  b.addEventListener("click", () => {
    sort =
      sort.key === b.dataset.sort ? { key: sort.key, dir: -sort.dir } : { key: b.dataset.sort, dir: b.dataset.sort === "name" ? 1 : -1 };
    renderTable();
  }),
);
dirButtons.forEach((b) =>
  b.addEventListener("click", () => {
    moverDir = b.dataset.dir;
    dirButtons.forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    renderMovers();
  }),
);
filterInput.addEventListener("input", renderTable);

loadIndices();
try {
  await initWatchlist();
} catch (e) {
  showMessage(errorEl, e.message);
}
onWatchlistChange(() => {
  renderAll();
  load();
});
selectTab(tab);
everyVisible(60_000, () => {
  load();
  loadIndices();
});
