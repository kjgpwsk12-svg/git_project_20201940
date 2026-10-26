// 뉴스: 주제별 시장 뉴스, 키워드 검색, 기사 저장(북마크)
import { NEWS_TOPICS, cleanNewsQuery, findTopic } from "/shared/news-topics.js";
import { formatRelativeTime } from "/shared/format.js";
import { api, getStatus } from "../core/api.js";
import { getSupabase, getUser, koreanError } from "../core/auth.js";
import { $, el, icon } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { showMessage, showToast } from "../core/ui.js";

initShell();

const TOPIC_ICON = { kr: "candles", us: "chart", macro: "clock", company: "briefcase", fx: "refresh", commodity: "logo" };
const params = new URLSearchParams(location.search);
const state = {
  topic: findTopic(params.get("topic")).id,
  q: cleanNewsQuery(params.get("q")),
  items: [],
  saved: new Map(), // news_url → bookmark id
  // 기사 저장 가능 여부. 네이버 검색 결과는 약관상 저장·캐싱이 제한되어 끄고, 데모 기사는 원문 링크가 없어 끈다.
  canSave: false,
};
const loginHref = `/login?next=${encodeURIComponent("/news")}`;
const searchInput = $("q");
searchInput.value = state.q;

// ----- 주제 탭과 검색 -----

const tabs = NEWS_TOPICS.map((t) =>
  el("button", { type: "button", role: "tab", "aria-selected": String(t.id === state.topic && !state.q), dataset: { topic: t.id }, onclick: () => update({ topic: t.id, q: "" }) }, t.label),
);
$("topics").replaceChildren(...tabs);

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  update({ q: cleanNewsQuery(searchInput.value) });
});
searchInput.addEventListener("search", () => !searchInput.value && state.q && update({ q: "" }));

function update(next) {
  Object.assign(state, next);
  searchInput.value = state.q;
  const url = new URL(location.href);
  url.search = "";
  if (state.topic !== "all" && !state.q) url.searchParams.set("topic", state.topic);
  if (state.q) url.searchParams.set("q", state.q);
  history.replaceState(null, "", url);
  load();
}

// ----- 목록 -----

async function load() {
  tabs.forEach((t) => t.setAttribute("aria-selected", String(!state.q && t.dataset.topic === state.topic)));
  const list = $("news");
  list.setAttribute("aria-busy", "true");
  list.replaceChildren(el("li", { class: "empty" }, "불러오는 중…"));
  try {
    const query = state.q ? `q=${encodeURIComponent(state.q)}` : `topic=${state.topic}`;
    const data = await api(`/api/market-news?${query}`);
    $("list-error").hidden = true;
    if (!data.available) {
      list.replaceChildren(el("li", { class: "empty" }, "뉴스 공급자가 설정되지 않았어요."));
      return;
    }
    state.items = data.value;
    const label = state.q ? `“${state.q}” 검색 결과 ${data.value.length}건` : `${findTopic(state.topic).label} · ${data.value.length}건`;
    const time = new Date(data.fetchedAt).toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" });
    // 갱신에 실패해 이전 결과를 보여 줄 때는 숨기지 않고 알린다
    $("list-meta").textContent = `${label} · ${data.stale ? `갱신 실패, ${time} 결과` : `${time} 기준`}`;
    $("list-meta").classList.toggle("up", Boolean(data.stale));
    render();
  } catch (error) {
    showMessage($("list-error"), `뉴스를 불러오지 못했어요. ${error.message}`);
    list.replaceChildren();
  } finally {
    list.removeAttribute("aria-busy");
  }
}

function render() {
  const list = $("news");
  if (!state.items.length) {
    list.replaceChildren(
      el(
        "li",
        { class: "empty" },
        el("p", {}, state.q ? "검색 결과가 없어요. 다른 키워드로 찾아보세요." : "이 주제의 뉴스가 아직 없어요."),
        state.q && el("button", { class: "btn outline sm empty-action", type: "button", onclick: () => update({ q: "" }) }, "검색 지우기"),
      ),
    );
    return;
  }
  list.replaceChildren(...state.items.map(newsItem));
}

function newsItem(n) {
  const saved = n.url && state.saved.has(n.url);
  const title = n.url
    ? el("a", { class: "news-title", href: n.url, target: "_blank", rel: "noopener noreferrer" }, n.title, el("span", { class: "sr-only" }, " (새 창)"))
    : el("span", { class: "news-title" }, n.title);
  return el(
    "li",
    { class: "news-item" },
    el("span", { class: `news-thumb t-${n.topic ?? "all"}`, "aria-hidden": "true" }, icon(TOPIC_ICON[n.topic] ?? "news", 20)),
    el(
      "div",
      { class: "news-main" },
      title,
      n.summary && el("p", { class: "news-summary" }, n.summary),
      el("p", { class: "news-meta" }, n.category && el("span", { class: "news-cat" }, n.category), el("span", {}, n.source), el("time", { datetime: n.publishedAt }, formatRelativeTime(n.publishedAt))),
    ),
    state.canSave &&
    el(
      "button",
      {
        class: "icon-btn save-btn",
        type: "button",
        "aria-pressed": String(Boolean(saved)),
        "aria-label": saved ? `${n.title} 저장 취소` : `${n.title} 저장`,
        title: n.url ? (saved ? "저장 취소" : "저장") : "원문 링크가 없는 예시 기사는 저장할 수 없어요",
        disabled: !n.url,
        onclick: () => toggleSave(n),
      },
      icon("bookmark", 17),
    ),
  );
}

// ----- 저장한 뉴스 (bookmarks 테이블, kind = news) -----

let client = null;
let user = null;

async function loadSaved() {
  const box = $("saved");
  client = await getSupabase();
  user = client ? await getUser() : null;
  if (!user) {
    box.replaceChildren(el("li", { class: "empty" }, el("a", { class: "link", href: loginHref }, "로그인"), "하면 기사를 저장해 두고 다시 볼 수 있어요."));
    return;
  }
  const { data, error } = await client
    .from("bookmarks")
    .select("id, news_url, news_title, news_source, news_published_at, created_at")
    .eq("kind", "news")
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) {
    box.replaceChildren(el("li", { class: "empty" }, `불러오지 못했어요. ${koreanError(error)}`));
    return;
  }
  state.saved = new Map(data.map((b) => [b.news_url, b.id]));
  $("saved-meta").textContent = `${data.length}건`;
  box.replaceChildren(
    ...(data.length
      ? data.map((b) =>
          el(
            "li",
            {},
            el("a", { href: b.news_url, target: "_blank", rel: "noopener noreferrer" }, el("strong", {}, b.news_title), el("small", {}, [b.news_source, b.news_published_at && formatRelativeTime(b.news_published_at)].filter(Boolean).join(" · "))),
            el("button", { class: "icon-btn", type: "button", "aria-label": `${b.news_title} 저장 취소`, onclick: () => removeSaved(b.id, b.news_url) }, icon("x", 14)),
          ),
        )
      : [el("li", { class: "empty" }, "저장한 기사가 없어요. 기사 오른쪽의 저장 버튼을 눌러 보세요.")]),
  );
  render();
}

async function toggleSave(n) {
  if (!user) return (location.href = loginHref);
  const existing = state.saved.get(n.url);
  if (existing) return removeSaved(existing, n.url);
  const { error } = await client.from("bookmarks").insert({
    kind: "news",
    news_url: n.url,
    news_title: n.title.slice(0, 300),
    news_source: n.source,
    news_published_at: n.publishedAt,
  });
  if (error && !/duplicate key/i.test(error.message)) return showToast(koreanError(error));
  showToast("기사를 저장했어요");
  loadSaved();
}

async function removeSaved(id, url) {
  const { error } = await client.from("bookmarks").delete().eq("id", id);
  if (error) return showToast(koreanError(error));
  state.saved.delete(url);
  showToast("저장을 취소했어요");
  loadSaved();
}

// ----- 데모 안내: 실제 기사가 아니라는 사실은 숨기지 않는다 -----

const status = await getStatus();
applyStatus(status);
load();
if (state.canSave) loadSaved();

function applyStatus(s) {
  const note = $("demo-note");
  if (s?.marketNewsLabel === "데모 뉴스") {
    note.hidden = false;
    note.textContent = "지금 보이는 뉴스는 화면 확인용 예시예요. 서버 .env에 네이버 뉴스 검색 API 키를 넣으면 실제 기사로 바뀌어요.";
  } else if (s?.marketNewsLabel) {
    // 네이버 검색 결과임을 밝힌다 (검색 API 이용 조건)
    $("source-note").textContent = `기사 목록은 ${s.marketNewsLabel} 결과예요. 제목을 누르면 언론사 원문으로 이동해요.`;
  }
  if (s && !s.marketNewsCached) {
    $("refresh-note").textContent = "화면을 열거나 주제를 바꿀 때마다 새로 가져와요. (검색 결과는 서버에 보관하지 않아요)";
  }
  state.canSave = Boolean(s?.marketNewsCached && s.marketNewsLabel !== "데모 뉴스");
  $("saved-panel").hidden = !state.canSave;
  if (!state.canSave && s?.marketNewsLabel && s.marketNewsLabel !== "데모 뉴스") {
    $("save-note").hidden = false;
  }
}
