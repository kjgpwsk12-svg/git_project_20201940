// 종목 상세: 시세, 기간 통계, 가격 차트와 뉴스 연결
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
import { parseSymbolId, symbolId } from "/shared/symbols.js";
import { createPriceChart } from "../components/price-chart.js";
import { api } from "../core/api.js";
import { $, el, icon } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { changeText, fetchedText, marketBadge, showMessage } from "../core/ui.js";
import { initWatchlist, isWatched, onWatchlistChange, toggleWatchlist } from "../core/watchlist.js";

initShell();

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
  document.title = `${q.name} · 이코노바`;
  $("stock").hidden = false;

  // 머리말
  $("quote-id").replaceChildren(
    ...[
      marketBadge(symbol.market),
      el("span", { class: "mono" }, symbol.code),
      symbol.market === "US" && el("span", {}, `· ${symbol.exchange}`),
      el("span", {}, symbol.market === "KR" ? "· KRW" : "· USD"),
    ].filter(Boolean),
  );
  $("quote-name").textContent = q.name;
  $("quote-price").textContent = formatPrice(q.price, symbol.market);
  $("quote-change").replaceChildren(changeText(q.change, q.changePercent, symbol.market));
  $("quote-time").replaceChildren(fetchedText(quote));
  initWatchToggle(id, q.name);

  renderStats(symbol.market, q, candles.value);

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
  button.addEventListener("click", () => toggleWatchlist(id).catch((e) => showMessage($("stock-error"), e.message)));
  button.disabled = true;
  render();
  await initWatchlist().catch(() => {});
  button.disabled = false;
  onWatchlistChange(render);
  render();
}

function renderStats(market, q, candles) {
  const last = candles.at(-1);
  const highs = candles.map((c) => c.high);
  const avgVolume = candles.slice(-20).reduce((s, c) => s + c.volume, 0) / Math.min(20, candles.length);
  const stat = (label, value, cls = "") => el("div", { class: "stat" }, el("dt", {}, label), el("dd", { class: cls }, value));
  $("stats").replaceChildren(
    stat("시가", last ? formatPrice(last.open, market) : "—"),
    stat("고가", last ? formatPrice(last.high, market) : "—", "up"),
    stat("저가", last ? formatPrice(last.low, market) : "—", "down"),
    stat("거래량", formatVolume(q.volume)),
    stat(`기간 최고 (${candles.length}일)`, candles.length ? formatPrice(Math.max(...highs), market) : "—"),
    stat("20일 평균 거래량", candles.length ? formatVolume(Math.round(avgVolume)) : "—"),
  );
}

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
      $("news-title").textContent = "최신 뉴스";
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
  const children = [
    el("p", { class: "news-title" }, item.title),
    item.summary && el("p", { class: "news-summary" }, item.summary),
    el(
      "p",
      { class: "news-meta" },
      el("span", {}, item.source),
      el("span", {}, "·"),
      el("span", { class: "mono" }, formatKoreanDateTime(item.publishedAt)),
      item.url && icon("external", 12),
    ),
  ];
  // 데모 기사는 링크가 없다. 실제 기사는 원문을 새 창으로 연다.
  return el(
    "li",
    {},
    item.url
      ? el("a", { class: "news-item", href: item.url, target: "_blank", rel: "noopener noreferrer" }, ...children)
      : el("div", { class: "news-item" }, ...children),
  );
}
