// 포트폴리오: 보유 종목·손익, 거래 기록(추가·수정·삭제), 투자 캘린더
import { formatPercent, formatPrice, toneOf } from "/shared/format.js";
import {
  TX_TYPES,
  computeHoldings,
  monthGrid,
  seoulDate,
  transactionAmount,
  validateTransaction,
  valuePortfolio,
} from "/shared/portfolio.js";
import { findCatalogEntry, parseSymbolId } from "/shared/symbols.js";
import { DONUT_COLORS, donut } from "../components/donut.js";
import { createStockPicker } from "../components/stock-picker.js";
import { api } from "../core/api.js";
import { getSupabase, koreanError, requireUser } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { setFieldError } from "../core/form.js";
import { fetchQuotes } from "../core/quotes.js";
import { initShell } from "../core/shell.js";
import { fetchedText, showMessage, showToast } from "../core/ui.js";

initShell();

const VIEWS = ["holdings", "history", "calendar"];
const params = new URLSearchParams(location.search);
const state = {
  view: VIEWS.includes(params.get("view")) ? params.get("view") : "holdings",
  txs: [],
  warnings: new Map(), // 거래 ID → 경고 문장
  prices: {},
  names: {},
  usdKrw: null,
  historySymbol: "all",
  historyType: "all",
  month: seoulDate(new Date().toISOString()).slice(0, 7), // YYYY-MM
  day: null,
};


// ----- 표시 도우미 -----

const marketOf = (currency) => (currency === "KRW" ? "KR" : "US");
const money = (value, currency) => formatPrice(value, marketOf(currency));
const krw = (value) => formatPrice(value, "KR");
const signedKrw = (value) => `${value > 0 ? "+" : value < 0 ? "-" : ""}${krw(Math.abs(value))}`;
const qtyFormat = new Intl.NumberFormat("ko-KR", { maximumFractionDigits: 6 });
const qty = (value) => qtyFormat.format(value);

function nameOf(id) {
  return state.names[id] ?? findCatalogEntry(parseSymbolId(id))?.name ?? parseSymbolId(id)?.code ?? id;
}

function symbolCell(id) {
  const symbol = parseSymbolId(id);
  return el(
    "a",
    { class: "sym", href: `/stock?id=${encodeURIComponent(id)}` },
    el("span", { class: `sym-logo ${symbol.market === "KR" ? "kr" : "us"}`, "aria-hidden": "true" }, nameOf(id).slice(0, 1)),
    el("span", {}, el("span", { class: "sym-name" }, nameOf(id)), el("span", { class: "sym-code" }, symbol.market === "US" ? `${symbol.exchange} · ${symbol.code}` : symbol.code)),
  );
}

function typeBadge(type) {
  return el("span", { class: `tx-badge t-${type}` }, TX_TYPES[type]);
}

// ----- 시작 -----

async function init() {
  $("content").hidden = false;
  document.querySelectorAll("#port-tabs button").forEach((b) => b.addEventListener("click", () => selectView(b.dataset.view)));
  $("add-btn").addEventListener("click", () => openDialog());
  setupHistoryFilters();
  setupCalendarNav();
  setupDialog();
  await reload();
  selectView(state.view);
}

function selectView(view) {
  state.view = view;
  document.querySelectorAll("#port-tabs button").forEach((b) => b.setAttribute("aria-selected", String(b.dataset.view === view)));
  for (const v of VIEWS) $(`view-${v}`).hidden = v !== view;
  const url = new URL(location.href);
  if (view === "holdings") url.searchParams.delete("view");
  else url.searchParams.set("view", view);
  history.replaceState(null, "", url);
}

/** 거래를 다시 읽고 계산·시세·화면을 모두 갱신한다 */
async function reload() {
  const { data, error } = await client
    .from("transactions")
    .select("*")
    .order("traded_at", { ascending: true })
    .order("seq", { ascending: true })
    .order("id", { ascending: true })
    .limit(5000);
  if (error) {
    showMessage($("page-message"), `투자 기록을 불러오지 못했어요. ${koreanError(error)}`);
    return;
  }
  state.txs = data;
  const { holdings, warnings } = computeHoldings(data);
  state.holdings = holdings;
  state.warnings = new Map(warnings.map((w) => [w.id, w.message]));

  const heldIds = holdings.filter((h) => h.quantity > 0).map((h) => h.symbolId);
  const [quotes, indices] = await Promise.all([
    fetchQuotes(heldIds.slice(0, 60)).catch(() => ({})),
    api("/api/indices").catch(() => null),
  ]);
  state.prices = {};
  for (const [id, r] of Object.entries(quotes)) {
    if (r.quote) {
      state.prices[id] = r.quote.price;
      state.names[id] = r.quote.name;
    }
  }
  // 달러 자산 환산은 실제 환율(FRED, 약 1주 지연)을 쓰고, 불러오지 못하면 지수 목록의 값을 쓴다
  const indicators = await api("/api/indicators").catch(() => null);
  const fx = indicators?.value?.find((i) => i.id === "USDKRW" && !i.error);
  state.usdKrw = fx?.value ?? indices?.value?.find((i) => i.id === "USDKRW")?.value ?? null;
  state.usdKrwDate = fx?.date ?? null;
  const any = Object.values(quotes).find((r) => r.fetchedAt);
  $("price-time").replaceChildren(any ? fetchedText(any) : "");

  renderSummary();
  renderWarnings();
  renderHoldings();
  renderHistory();
  renderCalendar();
}

// ----- 요약 -----

function renderSummary() {
  const result = valuePortfolio(state.holdings, state.prices, state.usdKrw);
  state.valued = result;
  const empty = state.txs.length === 0;
  $("sum-value").textContent = empty ? "-" : krw(result.totalValue);
  const notes = [];
  const usdRows = result.rows.filter((r) => r.currency === "USD");
  if (usdRows.length) {
    if (!state.usdKrw) notes.push("환율을 불러오지 못해 달러 자산은 빠졌어요");
    else {
      // 평가는 현재 환율, 원가는 거래 당시 환율을 모두 입력한 종목만 그 환율
      const allFx = usdRows.every((r) => r.fxFromTrades);
      // 실제 환율(FRED)이 없으면 데모 시세의 환율이라는 사실을 숨기지 않는다
      const fxDate = state.usdKrwDate ? `(${state.usdKrwDate.slice(5).replace("-", ".")} FRED 참고 환율)` : "(데모 환율)";
      notes.push(`달러 평가 환율 ${krw(state.usdKrw)}${fxDate}${allFx ? " · 원가는 거래 당시 환율" : " · 일부 원가도 현재 환율"}`);
    }
  }
  if (result.missing) notes.push(`시세가 없는 ${result.missing}종목은 빠져 있어 합계가 불완전해요`);
  $("sum-value-note").textContent = empty ? "거래를 추가하면 계산돼요" : notes.join(" · ") || "원화 환산 합계";

  const profit = $("sum-profit");
  profit.textContent = empty ? "-" : signedKrw(result.totalProfit);
  profit.className = `kpi-value ${empty ? "" : toneOf(result.totalProfit)}`;
  const rate = $("sum-rate");
  rate.textContent = result.totalRate === null ? "" : formatPercent(result.totalRate);
  rate.className = `kpi-change ${result.totalRate === null ? "" : toneOf(result.totalRate)}`;

  $("sum-cost").textContent = empty ? "-" : krw(result.totalCost);
  const realized = result.realizedKrw + result.dividendsKrw;
  const realizedEl = $("sum-realized");
  realizedEl.textContent = empty ? "-" : signedKrw(realized);
  realizedEl.className = `kpi-value ${empty ? "" : toneOf(realized)}`;
  $("sum-realized-note").textContent = empty ? "" : `실현 ${signedKrw(result.realizedKrw)} · 배당 ${krw(result.dividendsKrw)}`;
}

function renderWarnings() {
  const box = $("warnings");
  box.hidden = state.warnings.size === 0;
  if (!state.warnings.size) return;
  box.replaceChildren(
    el("p", {}, el("strong", {}, `확인이 필요한 거래 ${state.warnings.size}건`), " — 보유 수량보다 많이 판 기록이 있어요. 해당 거래는 가진 수량까지만 계산했어요."),
    el("button", { class: "text-btn", type: "button", onclick: () => selectView("history") }, "거래 기록에서 보기"),
  );
}

// ----- 보유 종목 -----

function renderHoldings() {
  const body = $("holdings");
  const rows = state.valued.rows;
  if (!rows.length) {
    body.replaceChildren(
      el(
        "tr",
        {},
        el(
          "td",
          { colspan: 6, class: "empty" },
          state.txs.length ? "지금 보유 중인 종목이 없어요. (모두 매도함)" : "아직 거래 기록이 없어요. ‘+ 거래 추가’로 첫 매수를 기록해 보세요.",
        ),
      ),
    );
  } else {
    body.replaceChildren(
      ...rows.map((r) =>
        el(
          "tr",
          {},
          el("td", {}, symbolCell(r.symbolId)),
          el("td", { class: "right num" }, qty(r.quantity)),
          el("td", { class: "right num hide-sm" }, money(r.avgPrice, r.currency)),
          el("td", { class: "right num" }, r.price === null ? el("span", { class: "muted", title: "시세를 불러오지 못했어요" }, "—") : money(r.price, r.currency)),
          el("td", { class: "right num hide-sm strong" }, r.value === null ? "—" : money(r.value, r.currency)),
          el(
            "td",
            { class: `right num ${r.profit === null ? "" : toneOf(r.profit)}` },
            r.profit === null
              ? "—"
              : [
                  el("span", { class: "strong" }, `${r.profit > 0 ? "+" : r.profit < 0 ? "-" : ""}${money(Math.abs(r.profit), r.currency)}`),
                  el("small", { class: "rate-line" }, r.profitRate === null ? "" : formatPercent(r.profitRate)),
                ],
          ),
        ),
      ),
    );
  }

  // 자산 구성: 원화 환산 평가금액 기준, 7개 넘으면 나머지는 "기타"
  const known = rows.filter((r) => r.weight !== null);
  const top = known.slice(0, 7);
  const rest = known.slice(7).reduce((s, r) => s + r.valueKrw, 0);
  const segments = top.map((r, i) => ({ label: nameOf(r.symbolId), value: r.valueKrw, weight: r.weight, color: DONUT_COLORS[i] }));
  if (rest > 0) segments.push({ label: "기타", value: rest, weight: (rest / state.valued.totalValue) * 100, color: DONUT_COLORS[7] });
  const chart = $("alloc-chart");
  const summary = segments.map((s) => `${s.label} ${s.weight.toFixed(1)}%`).join(", ");
  chart.replaceChildren(
    donut(segments, { label: segments.length ? `자산 구성: ${summary}` : "자산 구성: 보유 종목 없음" }),
    el("div", { class: "alloc-center" }, el("small", {}, "보유 종목"), el("strong", {}, `${rows.length}개`)),
  );
  $("alloc-legend").replaceChildren(
    ...(segments.length
      ? segments.map((s) =>
          el("li", {}, el("span", { class: "swatch", style: `background:${s.color}`, "aria-hidden": "true" }), el("span", { class: "alloc-name" }, s.label), el("span", { class: "num" }, `${s.weight.toFixed(1)}%`)),
        )
      : [el("li", { class: "muted sm" }, "보유 종목이 생기면 비중이 표시돼요.")]),
  );
}

// ----- 거래 기록 -----

function setupHistoryFilters() {
  $("history-symbol").addEventListener("change", (e) => {
    state.historySymbol = e.target.value;
    renderHistory();
  });
  document.querySelectorAll("#history-type button").forEach((b) =>
    b.addEventListener("click", () => {
      state.historyType = b.dataset.type;
      document.querySelectorAll("#history-type button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      renderHistory();
    }),
  );
}

function txRow(tx, { compact = false } = {}) {
  const amount = transactionAmount(tx);
  const warning = state.warnings.get(tx.id);
  const extra = Number(tx.fee) + Number(tx.tax);
  const detail =
    tx.type === "split" ? `1주 → ${qty(Number(tx.split_ratio))}주` : tx.type === "dividend" ? "" : qty(Number(tx.quantity));
  return el(
    "tr",
    { class: warning ? "tx-warn" : "" },
    !compact && el("td", { class: "num nowrap" }, seoulDate(tx.traded_at)),
    el("td", {}, symbolCell(tx.symbol_id), tx.memo && el("p", { class: "tx-memo", title: tx.memo }, tx.memo)),
    el(
      "td",
      {},
      typeBadge(tx.type),
      warning && el("p", { class: "tx-warn-text" }, warning),
      // 달러 거래에 환율이 없으면 원화 원가를 현재 환율로 계산한다는 표시
      tx.currency === "USD" && tx.type !== "split" && tx.fx_rate === null && el("p", { class: "tx-fx-missing", title: "원화 환산 원가에 현재 환율을 써요. 수정에서 거래 당시 환율을 넣을 수 있어요." }, "환율 미입력"),
    ),
    el("td", { class: "right num" }, detail),
    !compact && el("td", { class: "right num hide-sm" }, tx.price === null ? "" : money(Number(tx.price), tx.currency)),
    el("td", { class: "right num strong" }, amount === null ? "" : money(amount, tx.currency)),
    !compact && el("td", { class: "right num hide-sm muted" }, extra > 0 ? money(extra, tx.currency) : ""),
    el(
      "td",
      { class: "right nowrap" },
      el("button", { class: "text-btn", type: "button", onclick: () => openDialog(tx) }, "수정"),
      " ",
      el("button", { class: "text-btn danger-text", type: "button", onclick: () => deleteTx(tx) }, "삭제"),
    ),
  );
}

function renderHistory() {
  // 종목 선택 목록: 기록에 있는 종목만
  const select = $("history-symbol");
  const ids = [...new Set(state.txs.map((t) => t.symbol_id))].sort((a, b) => nameOf(a).localeCompare(nameOf(b), "ko"));
  if (state.historySymbol !== "all" && !ids.includes(state.historySymbol)) state.historySymbol = "all";
  select.replaceChildren(
    el("option", { value: "all" }, "전체 종목"),
    ...ids.map((id) => el("option", { value: id, selected: id === state.historySymbol }, nameOf(id))),
  );

  const rows = state.txs
    .filter((t) => (state.historySymbol === "all" || t.symbol_id === state.historySymbol) && (state.historyType === "all" || t.type === state.historyType))
    .slice()
    .reverse(); // 최근 거래가 위로
  $("history-count").textContent = `${rows.length}건`;
  $("history").replaceChildren(
    ...(rows.length
      ? rows.map((t) => txRow(t))
      : [el("tr", {}, el("td", { colspan: 8, class: "empty" }, state.txs.length ? "조건에 맞는 거래가 없어요." : "아직 거래 기록이 없어요."))]),
  );
}

async function deleteTx(tx) {
  if (!confirm(`${seoulDate(tx.traded_at)} ${nameOf(tx.symbol_id)} ${TX_TYPES[tx.type]} 기록을 삭제할까요?\n보유 수량과 손익이 다시 계산돼요.`)) return;
  const { error } = await client.from("transactions").delete().eq("id", tx.id);
  if (error) return showToast(koreanError(error));
  showToast("거래 기록을 삭제했어요");
  await reload();
}

// ----- 투자 캘린더 -----

function setupCalendarNav() {
  $("cal-prev").append(icon("chevronLeft", 18));
  $("cal-next").append(icon("chevronRight", 18));
  const shift = (delta) => {
    const [y, m] = state.month.split("-").map(Number);
    const d = new Date(Date.UTC(y, m - 1 + delta, 1));
    state.month = `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
    state.day = null;
    renderCalendar();
  };
  $("cal-prev").addEventListener("click", () => shift(-1));
  $("cal-next").addEventListener("click", () => shift(1));
  $("cal-today").addEventListener("click", () => {
    state.month = seoulDate(new Date().toISOString()).slice(0, 7);
    state.day = seoulDate(new Date().toISOString());
    renderCalendar();
  });
}

function renderCalendar() {
  const [year, month] = state.month.split("-").map(Number);
  $("cal-title").textContent = `${year}년 ${month}월`;
  const byDay = new Map();
  for (const tx of state.txs) {
    const day = seoulDate(tx.traded_at);
    if (!day.startsWith(state.month)) continue;
    if (!byDay.has(day)) byDay.set(day, []);
    byDay.get(day).push(tx);
  }

  // 월 요약: 통화별로 따로 더한다 (환율이 섞이지 않게)
  const sums = { buy: {}, sell: {}, dividend: {} };
  let count = 0;
  for (const list of byDay.values()) {
    for (const tx of list) {
      count++;
      const amount = transactionAmount(tx);
      if (amount === null || !sums[tx.type]) continue;
      sums[tx.type][tx.currency] = (sums[tx.type][tx.currency] ?? 0) + amount;
    }
  }
  const sumText = (bucket) => Object.entries(bucket).map(([cur, v]) => money(v, cur)).join(" + ") || "0";
  $("cal-summary").replaceChildren(
    el("div", {}, el("dt", {}, "거래"), el("dd", {}, `${count}건`)),
    el("div", {}, el("dt", {}, "매수"), el("dd", { class: "up" }, sumText(sums.buy))),
    el("div", {}, el("dt", {}, "매도"), el("dd", { class: "down" }, sumText(sums.sell))),
    el("div", {}, el("dt", {}, "배당"), el("dd", { class: "accent-text" }, sumText(sums.dividend))),
  );

  const today = seoulDate(new Date().toISOString());
  const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
  $("cal-grid").replaceChildren(
    el("div", { class: "cal-row cal-weekdays", role: "row" }, ...weekdays.map((w, i) => el("span", { role: "columnheader", class: i === 0 ? "sun" : i === 6 ? "sat" : "" }, w))),
    ...chunk(monthGrid(year, month), 7).map((week) =>
      el(
        "div",
        { class: "cal-row", role: "row" },
        ...week.map((day, i) => {
          if (!day) return el("span", { class: "cal-cell blank", role: "gridcell" });
          const list = byDay.get(day) ?? [];
          const num = Number(day.slice(8));
          return el(
            "button",
            {
              type: "button",
              role: "gridcell",
              class: `cal-cell${day === today ? " today" : ""}${list.length ? " has" : ""}${i === 0 ? " sun" : i === 6 ? " sat" : ""}`,
              "aria-selected": String(day === state.day),
              "aria-label": `${month}월 ${num}일${list.length ? `, 거래 ${list.length}건` : ""}${day === today ? ", 오늘" : ""}`,
              onclick: () => {
                state.day = day;
                renderCalendar();
              },
            },
            el("span", { class: "cal-num" }, String(num)),
            ...list.slice(0, 2).map((tx) => el("span", { class: `cal-chip t-${tx.type}` }, `${TX_TYPES[tx.type].slice(0, 2)} ${nameOf(tx.symbol_id)}`)),
            list.length > 2 && el("span", { class: "cal-more" }, `+${list.length - 2}건`),
          );
        }),
      ),
    ),
  );

  // 고른 날의 거래
  const title = $("cal-day-title");
  const listEl = $("cal-day-list");
  if (!state.day || !state.day.startsWith(state.month)) {
    title.textContent = byDay.size ? "날짜를 누르면 그날의 거래를 볼 수 있어요." : "이 달에는 거래 기록이 없어요.";
    listEl.replaceChildren();
    return;
  }
  const dayList = byDay.get(state.day) ?? [];
  const [, m, d] = state.day.split("-").map(Number);
  title.textContent = `${m}월 ${d}일 거래 ${dayList.length}건`;
  listEl.replaceChildren(
    ...(dayList.length
      ? dayList.map((tx) =>
          el(
            "li",
            {},
            typeBadge(tx.type),
            el("a", { class: "cal-day-name", href: `/stock?id=${encodeURIComponent(tx.symbol_id)}` }, nameOf(tx.symbol_id)),
            el("span", { class: "num muted" }, tx.type === "buy" || tx.type === "sell" ? `${qty(Number(tx.quantity))}주 × ${money(Number(tx.price), tx.currency)}` : tx.type === "split" ? `1주 → ${qty(Number(tx.split_ratio))}주` : ""),
            el("strong", { class: "num" }, transactionAmount(tx) === null ? "" : money(transactionAmount(tx), tx.currency)),
            tx.memo && el("span", { class: "cal-day-memo" }, tx.memo),
            el("button", { class: "text-btn", type: "button", onclick: () => openDialog(tx) }, "수정"),
          ),
        )
      : [
          el(
            "li",
            { class: "empty-day" },
            "이날은 거래가 없어요. ",
            el("button", { class: "text-btn", type: "button", onclick: () => openDialog(null, state.day) }, "이 날짜로 거래 추가"),
          ),
        ]),
  );
}

const chunk = (list, size) => Array.from({ length: Math.ceil(list.length / size) }, (_, i) => list.slice(i * size, i * size + size));

// ----- 거래 추가·수정 창 -----

const FIELDS = {
  date: "tx-date",
  quantity: "tx-quantity",
  price: "tx-price",
  fee: "tx-fee",
  tax: "tx-tax",
  amount: "tx-amount",
  split_ratio: "tx-ratio",
  fx_rate: "tx-fx",
  memo: "tx-memo",
};
let editing = null;
let stockPicker = null;

function setupDialog() {
  const dialog = $("tx-dialog");
  const form = $("tx-form");
  stockPicker = createStockPicker($("tx-stock-field"), { id: "tx-stock", onChange: () => syncDialog() });
  form.addEventListener("change", syncDialog);
  form.addEventListener("input", syncDialog);
  $("tx-cancel").addEventListener("click", () => dialog.close());
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    await saveDialog();
  });
}

const selectedType = () => $("tx-form").querySelector('input[name="type"]:checked').value;

function openDialog(tx = null, date = null) {
  editing = tx;
  const form = $("tx-form");
  form.reset();
  for (const id of Object.values(FIELDS)) setFieldError($(id), null);
  setFieldError($("tx-stock"), null);
  $("tx-stock-hint").hidden = true;
  $("tx-message").hidden = true;
  $("tx-title").textContent = tx ? "거래 수정" : "거래 추가";
  stockPicker.clear();
  $("tx-date").max = seoulDate(new Date().toISOString());
  if (tx) {
    form.querySelector(`input[name="type"][value="${tx.type}"]`).checked = true;
    // 수정할 때도 종목을 바꿀 수 있게, 선택기를 새로 만들어 기존 값을 넣는다
    stockPicker = createStockPicker($("tx-stock-field"), { id: "tx-stock", initialId: tx.symbol_id, onChange: () => syncDialog() });
    $("tx-date").value = seoulDate(tx.traded_at);
    const set = (key, value) => ($(FIELDS[key]).value = value === null || value === undefined ? "" : String(Number(value)));
    set("quantity", tx.quantity);
    set("price", tx.price);
    set("fee", Number(tx.fee) || null);
    set("tax", Number(tx.tax) || null);
    set("amount", tx.amount);
    set("split_ratio", tx.split_ratio);
    set("fx_rate", tx.fx_rate);
    $("tx-memo").value = tx.memo ?? "";
  } else {
    $("tx-date").value = date ?? seoulDate(new Date().toISOString());
  }
  syncDialog();
  $("tx-dialog").showModal();
}

/** 유형·종목에 맞는 입력칸만 보이고, 통화 단위와 합계 미리보기를 갱신한다 */
function syncDialog() {
  const type = selectedType();
  const symbolIdValue = stockPicker?.value();
  const isUsd = symbolIdValue?.startsWith("US.");
  document.querySelectorAll("#tx-form [data-for]").forEach((node) => {
    const keys = node.dataset.for.split(" ");
    node.hidden = !(keys.includes(type) || (keys.includes("usd") && isUsd && type !== "split"));
  });
  document.querySelectorAll("#tx-form .tx-unit").forEach((u) => (u.textContent = symbolIdValue ? (isUsd ? "(달러)" : "(원)") : ""));

  const preview = $("tx-preview");
  const n = (id) => Number($(id).value || 0);
  const currency = isUsd ? "USD" : "KRW";
  if ((type === "buy" || type === "sell") && n("tx-quantity") > 0 && $("tx-price").value) {
    const gross = n("tx-quantity") * n("tx-price");
    const costs = n("tx-fee") + (type === "sell" ? n("tx-tax") : 0);
    preview.textContent =
      type === "buy" ? `총 매수금액 ${money(gross + costs, currency)} (수수료 포함)` : `실수령액 ${money(gross - costs, currency)} (수수료·세금 제외)`;
  } else {
    preview.textContent = "";
  }
}

async function saveDialog() {
  const type = selectedType();
  const symbolIdValue = stockPicker.value();
  const input = {
    type,
    symbol_id: symbolIdValue,
    date: $("tx-date").value,
    memo: $("tx-memo").value.trim(),
  };
  // 보이는 칸만 값으로 쓴다 (숨겨진 칸에 남은 값은 무시)
  for (const [key, id] of Object.entries(FIELDS)) {
    if (key === "date" || key === "memo") continue;
    const node = $(id);
    input[key] = node.closest("[data-for]")?.hidden ? null : node.value.trim().replaceAll(",", "") || null;
  }
  const errors = validateTransaction(input);
  for (const [key, id] of Object.entries(FIELDS)) setFieldError($(id), errors[key] ?? null);
  const stockHint = $("tx-stock-hint");
  stockHint.textContent = errors.symbol_id ?? "";
  stockHint.hidden = !errors.symbol_id;
  stockHint.classList.toggle("error", Boolean(errors.symbol_id));
  if (Object.keys(errors).length) {
    const first = Object.keys(FIELDS).find((k) => errors[k]);
    (first ? $(FIELDS[first]) : $("tx-stock"))?.focus();
    return;
  }

  const n = (v) => (v === null ? null : Number(v));
  const trade = type === "buy" || type === "sell";
  const row = {
    symbol_id: symbolIdValue,
    type,
    // 거래일만 받으므로 서울 자정으로 저장한다 (같은 날 거래는 입력 순서대로 계산)
    traded_at: `${input.date}T00:00:00+09:00`,
    currency: symbolIdValue.startsWith("US.") ? "USD" : "KRW",
    quantity: trade ? n(input.quantity) : null,
    price: trade ? n(input.price) : null,
    amount: type === "dividend" ? n(input.amount) : null,
    split_ratio: type === "split" ? n(input.split_ratio) : null,
    fee: trade ? (n(input.fee) ?? 0) : 0,
    tax: type === "sell" ? (n(input.tax) ?? 0) : 0,
    fx_rate: symbolIdValue.startsWith("US.") ? n(input.fx_rate) : null,
    memo: input.memo,
  };

  const button = $("tx-submit");
  button.disabled = true;
  const { error } = editing
    ? await client.from("transactions").update(row).eq("id", editing.id)
    : await client.from("transactions").insert(row);
  button.disabled = false;
  if (error) {
    showMessage($("tx-message"), koreanError(error));
    return;
  }
  $("tx-dialog").close();
  showToast(editing ? "거래를 수정했어요" : "거래를 추가했어요");
  // 방금 기록한 달을 달력에서 바로 볼 수 있게
  state.month = input.date.slice(0, 7);
  state.day = input.date;
  await reload();
}

// ----- 실행 (모든 선언 뒤에 둔다: 위의 let/const가 준비된 뒤 init이 돌도록) -----

const client = await getSupabase();
let user = null;
if (!client) showMessage($("page-message"), "포트폴리오 기능(DB)이 설정되지 않았어요.");
else {
  user = await requireUser();
  if (user) await init();
}
