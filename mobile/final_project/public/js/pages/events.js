// 경제 일정: 월별 일정(날짜별 묶음), 국가·분류 필터, 다가오는 일정
import { EVENT_CATEGORIES, EVENT_COUNTRIES, dday, groupByDate, monthRange, seoulDateOf } from "/shared/events.js";
import { getSupabase, koreanError } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

const COLUMNS = "id, country, category, title, scheduled_at, time_tbd, previous_value, forecast_value, actual_value, source, source_url, updated_at";
const params = new URLSearchParams(location.search);
const today = seoulDateOf(new Date().toISOString());
const state = {
  month: /^\d{4}-\d{2}$/.test(params.get("month") ?? "") ? params.get("month") : today.slice(0, 7),
  country: ["KR", "US"].includes(params.get("country")) ? params.get("country") : "all",
  category: EVENT_CATEGORIES[params.get("category")] ? params.get("category") : "all",
  events: [],
};

const timeFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
const dayFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "long", day: "numeric", weekday: "short" });
const shortDay = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", month: "numeric", day: "numeric", weekday: "short" });

const countryBadge = (c) => el("span", { class: `badge ${c === "KR" ? "kr" : c === "US" ? "us" : "neutral"}` }, EVENT_COUNTRIES[c] ?? c);
const categoryBadge = (c) => el("span", { class: `ev-cat c-${c}` }, EVENT_CATEGORIES[c] ?? c);

// ----- 필터와 월 이동 -----

$("prev-month").append(icon("chevronLeft", 18));
$("next-month").append(icon("chevronRight", 18));
const shiftMonth = (delta) => {
  const [y, m] = state.month.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  update({ month: `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}` });
};
$("prev-month").addEventListener("click", () => shiftMonth(-1));
$("next-month").addEventListener("click", () => shiftMonth(1));
$("this-month").addEventListener("click", () => update({ month: today.slice(0, 7) }));

const countryButtons = [...document.querySelectorAll("#country-filter button")];
countryButtons.forEach((b) => b.addEventListener("click", () => update({ country: b.dataset.country }, false)));

const categoryButtons = [["all", "전체 분류"], ...Object.entries(EVENT_CATEGORIES)].map(([id, label]) =>
  el("button", { type: "button", class: "chip", "aria-pressed": String(id === state.category), dataset: { category: id }, onclick: () => update({ category: id }, false) }, label),
);
$("category-filter").replaceChildren(...categoryButtons);

function update(next, reload = true) {
  Object.assign(state, next);
  const url = new URL(location.href);
  url.search = "";
  if (state.month !== today.slice(0, 7)) url.searchParams.set("month", state.month);
  if (state.country !== "all") url.searchParams.set("country", state.country);
  if (state.category !== "all") url.searchParams.set("category", state.category);
  history.replaceState(null, "", url);
  if (reload) loadMonth();
  else render();
}

// ----- 월별 일정 -----

async function loadMonth() {
  const [y, m] = state.month.split("-").map(Number);
  $("list-title").textContent = `${y}년 ${m}월`;
  $("agenda").replaceChildren(el("p", { class: "empty" }, "불러오는 중…"));
  const client = await getSupabase();
  if (!client) {
    showMessage($("list-error"), "경제 일정 기능(DB)이 설정되지 않았어요.");
    $("agenda").replaceChildren();
    return;
  }
  const { start, end } = monthRange(state.month);
  const { data, error } = await client
    .from("economic_events")
    .select(COLUMNS)
    .gte("scheduled_at", start)
    .lt("scheduled_at", end)
    .order("scheduled_at")
    .limit(300);
  if (error) {
    showMessage($("list-error"), `일정을 불러오지 못했어요. ${koreanError(error)}`);
    $("agenda").replaceChildren();
    return;
  }
  $("list-error").hidden = true;
  state.events = data;
  render();
}

function render() {
  countryButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.country === state.country)));
  categoryButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.category === state.category)));
  const shown = state.events.filter(
    (e) => (state.country === "all" || e.country === state.country) && (state.category === "all" || e.category === state.category),
  );
  $("list-count").textContent = `${shown.length}건`;

  if (!shown.length) {
    $("agenda").replaceChildren(
      el(
        "div",
        { class: "empty" },
        el("p", {}, state.events.length ? "조건에 맞는 일정이 없어요." : "이 달에 등록된 일정이 없어요."),
        state.events.length
          ? el("button", { class: "btn outline sm empty-action", type: "button", onclick: () => update({ country: "all", category: "all" }, false) }, "필터 지우기")
          : el("button", { class: "btn outline sm empty-action", type: "button", onclick: () => update({ month: today.slice(0, 7) }) }, "이번 달 보기"),
      ),
    );
    return;
  }

  $("agenda").replaceChildren(
    ...groupByDate(shown).map((group) => {
      const past = group.date < today;
      const isToday = group.date === today;
      return el(
        "section",
        {
          id: `d-${group.date}`,
          class: `day-group${past ? " past" : ""}${isToday ? " today" : ""}`,
          "aria-label": dayFormat.format(new Date(group.events[0].scheduled_at)),
        },
        el(
          "h3",
          { class: "day-label" },
          el("span", {}, dayFormat.format(new Date(group.events[0].scheduled_at))),
          isToday ? el("span", { class: "day-tag" }, "오늘") : past ? el("span", { class: "day-tag muted-tag" }, "지남") : el("span", { class: "day-tag soon" }, dday(group.events[0].scheduled_at)),
        ),
        el("ul", { class: "ev-list" }, ...group.events.map((e) => eventRow(e, past))),
      );
    }),
  );
  focusHashDate();
}

/** 주소의 #d-YYYY-MM-DD 날짜로 스크롤하고 잠깐 강조한다 (다가오는 일정에서 넘어올 때) */
function focusHashDate() {
  const target = location.hash.startsWith("#d-") ? document.getElementById(location.hash.slice(1)) : null;
  if (!target) return;
  target.scrollIntoView({ behavior: "smooth", block: "center" });
  target.classList.add("flash");
  setTimeout(() => target.classList.remove("flash"), 2200);
}

const checkedFormat = new Intl.DateTimeFormat("ko-KR", { timeZone: "Asia/Seoul", year: "numeric", month: "numeric", day: "numeric" });

function eventRow(e, past) {
  const values = [
    ["이전", e.previous_value],
    ["예상", e.forecast_value],
    ["실제", e.actual_value],
  ].filter(([, v]) => v);
  return el(
    "li",
    { class: "ev-row" },
    el("span", { class: "ev-time num" }, e.time_tbd ? "미정" : timeFormat.format(new Date(e.scheduled_at))),
    el(
      "div",
      { class: "ev-main" },
      el("p", { class: "ev-title" }, countryBadge(e.country), categoryBadge(e.category), el("span", {}, e.title)),
      values.length > 0 && el("p", { class: "ev-values" }, ...values.map(([k, v]) => el("span", {}, `${k} `, el("strong", {}, v)))),
      // 지난 일정인데 결과가 없으면 비워 두지 않고 상태를 알려 준다
      past && !e.actual_value && el("p", { class: "ev-values" }, "결과 미입력 · 출처에서 확인하세요"),
    ),
    e.source_url
      ? el(
          "a",
          { class: "ev-source", href: e.source_url, target: "_blank", rel: "noopener noreferrer", title: `${e.source} 공식 일정 (새 창) · ${checkedFormat.format(new Date(e.updated_at))} 확인` },
          e.source,
          icon("external", 12),
        )
      : el("span", { class: "ev-source" }, e.source),
  );
}

// ----- 다가오는 일정 (월과 관계없이 지금부터) -----

async function loadNext() {
  const list = $("next-list");
  const client = await getSupabase();
  if (!client) return;
  const { data, error } = await client
    .from("economic_events")
    .select("id, country, category, title, scheduled_at, time_tbd")
    .gte("scheduled_at", new Date().toISOString())
    .order("scheduled_at")
    .limit(5);
  if (error || !data.length) {
    list.replaceChildren(el("li", { class: "empty" }, error ? "불러오지 못했어요." : "예정된 일정이 없어요."));
    return;
  }
  list.replaceChildren(
    ...data.map((e) =>
      el(
        "li",
        {},
        el(
          "a",
          { href: `/events?month=${seoulDateOf(e.scheduled_at).slice(0, 7)}#d-${seoulDateOf(e.scheduled_at)}` },
          el("span", { class: "next-dday" }, dday(e.scheduled_at)),
          el(
            "span",
            { class: "next-main" },
            el("strong", {}, e.title),
            el("small", {}, `${shortDay.format(new Date(e.scheduled_at))}${e.time_tbd ? "" : ` ${timeFormat.format(new Date(e.scheduled_at))}`} · ${EVENT_COUNTRIES[e.country]}`),
          ),
        ),
      ),
    ),
  );
}

// 다가오는 일정: 같은 달이면 새로 불러오지 않고 그 날짜로 이동
$("next-list").addEventListener("click", (event) => {
  const link = event.target.closest("a");
  if (!link) return;
  event.preventDefault();
  const url = new URL(link.href);
  history.replaceState(null, "", url);
  const month = url.searchParams.get("month");
  if (month === state.month) focusHashDate();
  else update({ month });
});

loadMonth();
loadNext();
