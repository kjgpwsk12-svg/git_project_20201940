// 게시판 목록: 게시판 종류 탭, 정렬, 검색, 페이지, 인기글
import { BOARDS, cleanSearchTerm, isBoardId } from "/shared/boards.js";
import { getSupabase, getUser, koreanError } from "../core/auth.js";
import { POST_COLUMNS, postRow } from "../core/community.js";
import { $, el, icon } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

const PAGE_SIZE = 15;
const SORTS = {
  latest: [["created_at", false]],
  likes: [["like_count", false], ["created_at", false]],
  comments: [["comment_count", false], ["created_at", false]],
};

const params = new URLSearchParams(location.search);
const state = {
  board: isBoardId(params.get("board")) ? params.get("board") : "all",
  sort: SORTS[params.get("sort")] ? params.get("sort") : "latest",
  q: cleanSearchTerm(params.get("q") ?? ""),
  page: Math.max(1, Number.parseInt(params.get("page"), 10) || 1),
};

const listEl = $("posts");
const errorEl = $("list-error");
const searchInput = $("q");
searchInput.value = state.q;

// ----- 탭과 정렬 -----

const tabs = [{ id: "all", label: "전체" }, ...BOARDS].map((b) =>
  el("button", { type: "button", role: "tab", "aria-selected": String(b.id === state.board), dataset: { board: b.id } }, b.label),
);
$("tabs").replaceChildren(...tabs);
tabs.forEach((t) => t.addEventListener("click", () => update({ board: t.dataset.board, page: 1 })));

const sortButtons = [...document.querySelectorAll("#sort button")];
sortButtons.forEach((b) => b.addEventListener("click", () => update({ sort: b.dataset.sort, page: 1 })));

$("search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  update({ q: cleanSearchTerm(searchInput.value), page: 1 });
});
// 검색어를 지우면(× 버튼 포함) 전체 목록으로
searchInput.addEventListener("search", () => !searchInput.value && state.q && update({ q: "", page: 1 }));

function update(next) {
  Object.assign(state, next);
  const url = new URL(location.href);
  url.search = "";
  if (state.board !== "all") url.searchParams.set("board", state.board);
  if (state.sort !== "latest") url.searchParams.set("sort", state.sort);
  if (state.q) url.searchParams.set("q", state.q);
  if (state.page > 1) url.searchParams.set("page", String(state.page));
  history.replaceState(null, "", url);
  load();
}

// ----- 목록 -----

function renderPager(total) {
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const pager = $("pager");
  if (pages <= 1) {
    pager.replaceChildren();
    return;
  }
  const start = Math.max(1, Math.min(state.page - 2, pages - 4));
  const numbers = Array.from({ length: Math.min(5, pages) }, (_, i) => start + i);
  const button = (page, label, extra = {}) =>
    el("button", { type: "button", class: "pager-btn", onclick: () => update({ page }), ...extra }, label);
  pager.replaceChildren(
    button(state.page - 1, icon("chevronLeft", 15), { disabled: state.page <= 1, "aria-label": "이전 페이지" }),
    ...numbers.map((n) => button(n, String(n), { "aria-current": n === state.page ? "page" : null, "aria-label": `${n}페이지` })),
    button(state.page + 1, icon("chevronRight", 15), { disabled: state.page >= pages, "aria-label": "다음 페이지" }),
  );
}

async function load() {
  tabs.forEach((t) => t.setAttribute("aria-selected", String(t.dataset.board === state.board)));
  updateWriteLink();
  sortButtons.forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.sort === state.sort)));
  listEl.setAttribute("aria-busy", "true");
  // 처음 불러올 때만 자리 표시를 보여 준다 (탭을 바꿀 때 목록이 깜빡이지 않게)
  if (!listEl.children.length) listEl.replaceChildren(el("li", { class: "empty" }, "불러오는 중…"));

  const client = await getSupabase();
  if (!client) {
    showMessage(errorEl, "게시판 기능(DB)이 설정되지 않았어요.");
    listEl.replaceChildren();
    return;
  }
  let query = client.from("posts").select(POST_COLUMNS, { count: "exact" }).neq("board", "sns");
  if (state.board !== "all") query = query.eq("board", state.board);
  if (state.q) query = query.or(`title.ilike.%${state.q}%,body.ilike.%${state.q}%`);
  for (const [column, ascending] of SORTS[state.sort]) query = query.order(column, { ascending });
  const from = (state.page - 1) * PAGE_SIZE;
  const { data, count, error } = await query.range(from, from + PAGE_SIZE - 1);
  listEl.removeAttribute("aria-busy");

  if (error) {
    showMessage(errorEl, `게시글을 불러오지 못했어요. ${koreanError(error)}`);
    listEl.replaceChildren();
    return;
  }
  errorEl.hidden = true;
  // 범위를 벗어난 페이지(글이 지워진 경우 등)는 마지막 페이지로
  if (!data.length && count > 0 && state.page > 1) {
    update({ page: Math.ceil(count / PAGE_SIZE) });
    return;
  }

  const label = state.board === "all" ? "전체" : BOARDS.find((b) => b.id === state.board).label;
  $("list-count").textContent = state.q ? `“${state.q}” 검색 결과 ${count}개` : `${label} · ${count}개`;
  listEl.replaceChildren(
    ...(data.length
      ? data.map(postRow)
      : [
          el(
            "li",
            { class: "empty" },
            state.q ? "검색 결과가 없어요. 다른 단어로 찾아보세요." : "아직 글이 없어요. 첫 글을 남겨 보세요!",
          ),
        ]),
  );
  renderPager(count);
}

// ----- 인기글 -----

async function loadHot() {
  const list = $("hot");
  const client = await getSupabase();
  if (!client) return;
  const since = new Date(Date.now() - 7 * 86400_000).toISOString();
  const { data, error } = await client
    .from("posts")
    .select("id, title, like_count, comment_count")
    .neq("board", "sns")
    .gte("created_at", since)
    .gt("like_count", 0)
    .order("like_count", { ascending: false })
    .order("comment_count", { ascending: false })
    .limit(5);
  if (error || !data.length) {
    list.replaceChildren(el("li", { class: "empty" }, error ? "불러오지 못했어요." : "이번 주에는 아직 좋아요를 받은 글이 없어요."));
    return;
  }
  list.replaceChildren(
    ...data.map((p, i) =>
      el(
        "li",
        {},
        el(
          "a",
          { href: `/post?id=${p.id}` },
          el("span", { class: "rank-no" }, String(i + 1)),
          el("span", { class: "hot-title" }, p.title),
          el("span", { class: "meta-count" }, icon("heart", 12), String(p.like_count)),
        ),
      ),
    ),
  );
}

// 글쓰기 버튼: 보고 있는 게시판을 미리 고르고, 로그인하지 않았으면 로그인 후 글쓰기로
let loggedIn = true;
function updateWriteLink() {
  const target = state.board === "all" ? "/write" : `/write?board=${state.board}`;
  $("write-link").href = loggedIn ? target : `/login?next=${encodeURIComponent(target)}`;
}
getUser().then((user) => {
  loggedIn = Boolean(user);
  updateWriteLink();
});

load();
loadHot();
