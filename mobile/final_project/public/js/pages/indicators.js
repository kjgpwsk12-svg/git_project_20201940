// 경제지표: 공식 자료(FRED·한국은행) 지표 카드와 선택한 지표의 장기 추이 차트
import { ColorType, LineSeries, createChart } from "/vendor/lightweight-charts.mjs";
import { formatIndicatorChange, formatIndicatorDate, formatIndicatorValue } from "/shared/indicator-format.js";
import { toneOf } from "/shared/format.js";
import { api, getStatus } from "../core/api.js";
import { $, el, icon } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

const GROUP_ORDER = ["금리", "물가·고용", "환율·원자재"];
const params = new URLSearchParams(location.search);
const state = { items: [], selected: params.get("id") ?? "KRRATE", years: [1, 3, 5, 10].includes(Number(params.get("years"))) ? Number(params.get("years")) : 5, history: {} };

// ----- 지표 카드 -----

async function load() {
  $("groups").replaceChildren(el("p", { class: "empty panel" }, "공식 자료에서 지표를 불러오는 중…"));
  try {
    const data = await api("/api/indicators");
    if (!data.available) {
      showKeyGuide();
      return;
    }
    state.items = data.value;
    if (!state.items.some((i) => i.id === state.selected)) state.selected = state.items[0]?.id;
    renderCards(data);
    selectIndicator(state.selected);
  } catch (error) {
    showMessage($("page-error"), `경제 지표를 불러오지 못했어요. ${error.message}`);
    $("groups").replaceChildren();
  }
}

/** 키가 없을 때: 지어낸 숫자 대신 무엇이 필요한지 알려 준다 */
function showKeyGuide() {
  $("groups").replaceChildren(
    el(
      "section",
      { class: "panel ind-guide" },
      el("h2", { class: "panel-title" }, "공식 지표를 보려면 무료 API 키가 필요해요"),
      el("p", { class: "sm muted" }, "FRED와 한국은행은 자료를 공식 API로만 받도록 정하고 있어요. 키를 서버 .env에 넣고 다시 실행하면 이 화면과 홈 화면에 실제 지표가 나와요."),
      el(
        "ol",
        { class: "ind-guide-steps" },
        el("li", {}, el("strong", {}, "FRED_API_KEY"), " — 미국 금리·물가·고용·환율·유가 ", el("a", { class: "link", href: "https://fred.stlouisfed.org/docs/api/api_key.html", target: "_blank", rel: "noopener noreferrer" }, "발급 안내", el("span", { class: "sr-only" }, " (새 창)"))),
        el("li", {}, el("strong", {}, "ECOS_API_KEY"), " — 한국 기준금리 ", el("a", { class: "link", href: "https://ecos.bok.or.kr/api/", target: "_blank", rel: "noopener noreferrer" }, "한국은행 ECOS", el("span", { class: "sr-only" }, " (새 창)"))),
      ),
    ),
  );
  $("chart").closest("section").hidden = true;
}

function renderCards(data) {
  const fetched = new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
  $("groups").replaceChildren(
    ...GROUP_ORDER.map((group) => {
      const items = state.items.filter((i) => i.group === group);
      return el(
        "section",
        { class: "ind-group", "aria-label": group },
        el("h2", { class: "ind-group-title" }, group, group === GROUP_ORDER[0] && el("span", { class: "ind-fetched" }, data.stale ? `갱신 실패 · ${fetched} 자료` : `${fetched} 확인`)),
        el("div", { class: "ind-cards" }, ...items.map(card)),
      );
    }),
  );
}

function card(ind) {
  return el(
    "button",
    {
      type: "button",
      class: "panel ind-card",
      "aria-pressed": String(ind.id === state.selected),
      dataset: { id: ind.id },
      onclick: () => selectIndicator(ind.id, true),
    },
    el("span", { class: "ind-name" }, ind.name),
    ind.error
      ? [el("span", { class: "ind-value muted" }, "—"), el("span", { class: "ind-change muted" }, "자료를 불러오지 못했어요")]
      : [
          el("span", { class: "ind-value num" }, formatIndicatorValue(ind)),
          el("span", { class: `ind-change ${ind.change ? toneOf(ind.change) : "muted"}` }, formatIndicatorChange(ind), ind.previous && el("small", { class: "muted" }, ` (직전 ${formatIndicatorValue(ind, ind.previous.value)})`)),
          el("span", { class: "ind-date" }, `${formatIndicatorDate(ind.date)} 기준 · ${ind.freq}`),
        ],
  );
}

// ----- 차트 -----

let chart = null;
let series = null;

function palette() {
  const style = getComputedStyle($("chart"));
  const v = (name) => style.getPropertyValue(name).trim();
  return { text: v("--muted"), grid: v("--line"), accent: v("--accent"), crosshair: v("--line-strong") };
}

function ensureChart() {
  if (chart) return;
  const colors = palette();
  chart = createChart($("chart"), {
    autoSize: true,
    layout: { background: { type: ColorType.Solid, color: "transparent" }, textColor: colors.text, fontFamily: getComputedStyle(document.body).fontFamily, fontSize: 12 },
    grid: { vertLines: { visible: false }, horzLines: { color: colors.grid } },
    rightPriceScale: { borderVisible: false, minimumWidth: 64 },
    timeScale: { borderVisible: false, fixLeftEdge: true, fixRightEdge: true },
    handleScroll: false,
    handleScale: false,
    crosshair: { vertLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair }, horzLine: { color: colors.crosshair, labelBackgroundColor: colors.crosshair } },
    localization: { locale: "ko-KR" },
  });
  series = chart.addSeries(LineSeries, { color: colors.accent, lineWidth: 2, priceLineVisible: false });
  // 테마가 바뀌면 색을 다시 읽는다
  window.addEventListener("themechange", () => {
    const c = palette();
    chart.applyOptions({ layout: { textColor: c.text }, grid: { horzLines: { color: c.grid } } });
    series.applyOptions({ color: c.accent });
  });
}

async function selectIndicator(id, userAction = false) {
  state.selected = id;
  document.querySelectorAll(".ind-card").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.id === id)));
  syncUrl();
  const ind = state.items.find((i) => i.id === id);
  if (!ind) return;
  $("chart-title").textContent = ind.name;
  $("chart-sub").textContent = ind.error ? "자료를 불러오지 못했어요" : `${formatIndicatorValue(ind)} · ${formatIndicatorDate(ind.date)} 기준`;
  $("about").replaceChildren(
    el("p", { class: "ind-about-text" }, ind.about),
    el("p", { class: "sm muted" }, `발표 주기: ${ind.freq}`),
    ind.citation && el("p", { class: "ind-cite" }, `출처: ${ind.citation}`),
    ind.sourceUrl &&
      el("a", { class: "link sm", href: ind.sourceUrl, target: "_blank", rel: "noopener noreferrer" }, `${ind.source}에서 보기`, icon("external", 12), el("span", { class: "sr-only" }, " (새 창)")),
  );
  if (userAction) $("chart").closest("section").scrollIntoView({ behavior: "smooth", block: "nearest" });
  await drawHistory(ind);
}

async function drawHistory(ind) {
  ensureChart();
  const box = $("chart");
  box.dataset.state = "loading";
  try {
    state.history[ind.id] ??= (await api(`/api/indicators/${ind.id}/history`)).value;
    const all = state.history[ind.id];
    const from = new Date();
    from.setFullYear(from.getFullYear() - state.years);
    const cutoff = from.toISOString().slice(0, 10);
    // 한국 기준금리는 '바뀐 날'만 있어서, 차트가 날짜 간격을 고르게 보여 주도록 매월 1일 값으로 채운다
    const data = ind.id === "KRRATE" ? monthlyFill(all, cutoff) : all.filter((p) => p.date >= cutoff);
    series.setData(data.map((p) => ({ time: p.date, value: p.value })));
    series.applyOptions({ lineType: ind.id === "KRRATE" || ind.id === "FEDRATE" ? 1 : 0 }); // 정책 금리는 계단 모양
    chart.timeScale().fitContent();
    if (data.length) {
      const fmt = (d) => d.slice(0, 7).replace("-", ".");
      $("chart-sub").textContent = `${formatIndicatorValue(ind)} · ${fmt(data[0].date)} ~ ${fmt(data.at(-1).date)} · 마지막 발표 ${formatIndicatorDate(ind.date)}`;
    }
    box.setAttribute("aria-label", `${ind.name} ${state.years}년 추이 차트, 최근 값 ${formatIndicatorValue(ind)}`);
    box.dataset.state = "ready";
  } catch (error) {
    series.setData([]);
    box.dataset.state = "error";
    $("chart-sub").textContent = `추이를 불러오지 못했어요. ${error.message}`;
  }
}

/** 변경 시점 목록 → 기간 시작부터 이번 달까지 매월 1일의 값 (그 시점에 적용되던 값) */
function monthlyFill(changes, cutoff) {
  const out = [];
  const d = new Date(`${cutoff.slice(0, 7)}-01T00:00:00Z`);
  const end = new Date();
  while (d <= end) {
    const date = d.toISOString().slice(0, 10);
    const current = changes.filter((p) => p.date <= date).at(-1);
    if (current) out.push({ date, value: current.value });
    d.setUTCMonth(d.getUTCMonth() + 1);
  }
  return out;
}

const rangeButtons = [...document.querySelectorAll("#range button")];
rangeButtons.forEach((b) =>
  b.addEventListener("click", () => {
    state.years = Number(b.dataset.years);
    syncUrl();
    const ind = state.items.find((i) => i.id === state.selected);
    if (ind) drawHistory(ind);
  }),
);

function syncUrl() {
  rangeButtons.forEach((b) => b.setAttribute("aria-pressed", String(Number(b.dataset.years) === state.years)));
  const url = new URL(location.href);
  url.searchParams.set("id", state.selected);
  if (state.years === 5) url.searchParams.delete("years");
  else url.searchParams.set("years", String(state.years));
  history.replaceState(null, "", url);
}

// FRED API를 쓰면 FRED가 요구하는 문구를 그대로 보여 준다
getStatus().then((s) => {
  if (s?.indicatorsUseFred) $("fred-notice").hidden = false;
});

load();
