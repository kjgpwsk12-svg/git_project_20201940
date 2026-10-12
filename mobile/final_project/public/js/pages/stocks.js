// 주식: 국내·미국 주요 종목 시세 표, 정렬·찾기, 관심 종목 관리
import { formatPrice, formatVolume } from "/shared/format.js";
import { CATALOG, findCatalogEntry, parseSymbolId, symbolId } from "/shared/symbols.js";
import { $, el, icon } from "../core/dom.js";
import { everyVisible, fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";
import { changePill, fetchedText, marketBadge, showMessage } from "../core/ui.js";
import { initWatchlist, isWatched, onWatchlistChange, toggleWatchlist, watchlistIds } from "../core/watchlist.js";

initShell();

const rowsEl = $("rows");
const errorEl = $("list-error");
const filterInput = $("filter");
const tabButtons = [...document.querySelectorAll("#tabs button")];
const sortButtons = [...document.querySelectorAll(".th-sort")];

const params = new URLSearchParams(location.search);
let tab = ["KR", "US", "WATCH"].includes(params.get("tab")) ? params.get("tab") : "KR";
let sort = { key: "change", dir: -1 };
let quotes = {};

const nameOf = (id) => quotes[id]?.quote?.name ?? findCatalogEntry(parseSymbolId(id))?.name ?? parseSymbolId(id).code;

function currentIds() {
  if (tab === "WATCH") return watchlistIds();
  return CATALOG.filter((e) => e.symbol.market === tab).map((e) => symbolId(e.symbol));
}

function sortValue(id) {
  const q = quotes[id]?.quote;
  switch (sort.key) {
    case "name":
      return nameOf(id);
    case "price":
      return q?.price ?? -Infinity;
    case "volume":
      return q?.volume ?? -Infinity;
    default:
      return q?.changePercent ?? -Infinity;
  }
}

function render() {
  const query = filterInput.value.trim().toLowerCase();
  let ids = currentIds().filter((id) => !query || nameOf(id).toLowerCase().includes(query) || id.toLowerCase().includes(query));
  ids = ids.sort((a, b) => {
    const va = sortValue(a);
    const vb = sortValue(b);
    return (typeof va === "string" ? va.localeCompare(vb, "ko") : va - vb) * sort.dir;
  });

  sortButtons.forEach((b) => {
    const active = b.dataset.sort === sort.key;
    b.closest("th").setAttribute("aria-sort", active ? (sort.dir > 0 ? "ascending" : "descending") : "none");
    b.querySelector("svg")?.remove();
    if (active) b.append(icon(sort.dir > 0 ? "sortUp" : "sortDown", 12));
  });

  $("list-meta").textContent = `${ids.length}개 종목`;
  const any = Object.values(quotes).find((r) => r.fetchedAt);
  if (any) $("list-meta").append(" · ", fetchedText(any));

  if (ids.length === 0) {
    rowsEl.replaceChildren(
      el(
        "tr",
        {},
        el("td", { colspan: 5, class: "empty" }, tab === "WATCH" && !query ? "관심 종목이 없어요. 국내·미국 탭에서 ☆를 눌러 추가하세요." : "조건에 맞는 종목이 없어요."),
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
  const href = `/stock?id=${encodeURIComponent(id)}`;
  return el(
    "tr",
    { onclick: (e) => !e.target.closest("button, a") && (location.href = href) },
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
          onclick: () => toggleWatchlist(id).catch((e) => showMessage(errorEl, e.message)),
        },
        icon("star", 15),
      ),
    ),
    el(
      "td",
      {},
      el(
        "a",
        { class: "sym", href },
        marketBadge(symbol.market),
        el("span", {}, el("span", { class: "sym-name" }, name), el("span", { class: "sym-code" }, symbol.code)),
      ),
    ),
    el("td", { class: "right mono" }, q ? formatPrice(q.price, symbol.market) : result ? "—" : el("span", { class: "skeleton", style: "width:60px" })),
    el("td", { class: "right" }, q ? changePill(q.changePercent) : ""),
    el("td", { class: "right mono muted hide-sm" }, q ? formatVolume(q.volume) : ""),
  );
}

async function load() {
  const ids = currentIds();
  if (ids.length === 0) return render();
  try {
    quotes = { ...quotes, ...(await fetchQuotes(ids)) };
    errorEl.hidden = true;
  } catch (e) {
    showMessage(errorEl, `시세를 불러오지 못했어요. ${e.message}`);
  }
  render();
}

function selectTab(next) {
  tab = next;
  tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  const url = new URL(location.href);
  url.searchParams.set("tab", tab);
  history.replaceState(null, "", url);
  render();
  load();
}

tabButtons.forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
sortButtons.forEach((b) =>
  b.addEventListener("click", () => {
    sort = sort.key === b.dataset.sort ? { key: sort.key, dir: -sort.dir } : { key: b.dataset.sort, dir: b.dataset.sort === "name" ? 1 : -1 };
    render();
  }),
);
filterInput.addEventListener("input", render);

try {
  await initWatchlist();
} catch (e) {
  showMessage(errorEl, e.message);
}
onWatchlistChange(() => {
  render();
  if (tab === "WATCH") load();
});
selectTab(tab);
everyVisible(60_000, load);
