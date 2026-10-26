// 커뮤니티 피드: 짧은 글 쓰기, 전체·팔로잉 피드, 내 프로필 요약, 추천 투자자
import { validatePostBody } from "/shared/validation.js";
import { createStockPicker } from "../components/stock-picker.js";
import { FEED_MAX, feedCard, likedIds } from "../components/feed-card.js";
import { getMyProfile, getSupabase, getUser, koreanError } from "../core/auth.js";
import { POST_COLUMNS, afterCursor, authorName, avatar, followButton, followingIds, profileCounts } from "../core/community.js";
import { $, el } from "../core/dom.js";
import { onSubmit, validateFields } from "../core/form.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

const PAGE_SIZE = 20;
const loginHref = `/login?next=${encodeURIComponent("/feed")}`;
const params = new URLSearchParams(location.search);
let tab = params.get("tab") === "following" ? "following" : "all";
let cursor = null; // 마지막으로 불러온 글 { at, id } (더 보기 기준)
let following = new Set();

const client = await getSupabase();
const user = await getUser();
const listEl = $("feed");
const errorEl = $("feed-error");
const tabButtons = [...document.querySelectorAll("#feed-tabs button")];

if (!client) showMessage(errorEl, "커뮤니티 기능(DB)이 설정되지 않았어요.");
else await init();

async function init() {
  following = await followingIds(client, user);
  setupComposer();
  renderMe();
  loadSuggestions();
  tabButtons.forEach((b) => b.addEventListener("click", () => selectTab(b.dataset.tab)));
  $("more-btn").addEventListener("click", () => load(false));
  selectTab(tab);
}

function selectTab(next) {
  if (next === "following" && !user) {
    location.href = `/login?next=${encodeURIComponent("/feed?tab=following")}`;
    return;
  }
  tab = next;
  tabButtons.forEach((b) => b.setAttribute("aria-selected", String(b.dataset.tab === tab)));
  const url = new URL(location.href);
  if (tab === "all") url.searchParams.delete("tab");
  else url.searchParams.set("tab", tab);
  history.replaceState(null, "", url);
  load(true);
}

// ----- 피드 -----

async function load(reset) {
  if (reset) {
    cursor = null;
    listEl.replaceChildren(el("p", { class: "empty panel" }, "불러오는 중…"));
  }
  const moreBtn = $("more-btn");
  moreBtn.disabled = true;

  if (tab === "following" && following.size === 0) {
    listEl.replaceChildren(
      el(
        "div",
        { class: "empty panel" },
        el("p", {}, "아직 팔로우한 투자자가 없어요."),
        el("p", {}, "추천 투자자를 팔로우하거나 전체 피드에서 관심 가는 사람을 찾아보세요."),
        el("button", { class: "btn outline sm empty-action", type: "button", onclick: () => selectTab("all") }, "전체 피드 보기"),
      ),
    );
    moreBtn.hidden = true;
    return;
  }

  let query = client.from("posts").select(POST_COLUMNS).eq("board", "sns").order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE);
  if (tab === "following") query = query.in("author_id", [...following]);
  if (cursor) query = query.or(afterCursor(cursor));
  const { data, error } = await query;
  moreBtn.disabled = false;
  if (error) {
    showMessage(errorEl, `피드를 불러오지 못했어요. ${koreanError(error)}`);
    if (reset) listEl.replaceChildren();
    return;
  }
  errorEl.hidden = true;

  const liked = await likedIds(client, user, data);
  const cards = data.map((post) => feedCard(post, { client, user, liked: liked.has(post.id), loginHref, onRemoved: renderMe }));
  if (reset) {
    listEl.replaceChildren(
      ...(cards.length
        ? cards
        : [el("p", { class: "empty panel" }, tab === "following" ? "팔로우한 투자자가 아직 글을 쓰지 않았어요." : "아직 글이 없어요. 첫 글을 남겨 보세요!")]),
    );
  } else {
    listEl.append(...cards);
  }
  if (data.length) cursor = { at: data.at(-1).created_at, id: data.at(-1).id };
  moreBtn.hidden = data.length < PAGE_SIZE;
}

// ----- 글쓰기 -----

function setupComposer() {
  if (!user) {
    const prompt = $("composer-login");
    prompt.hidden = false;
    prompt.replaceChildren(el("a", { class: "link", href: loginHref }, "로그인"), "하고 시장에 대한 생각을 나눠 보세요.");
    return;
  }
  $("composer").hidden = false;
  const body = $("composer-body");
  const stock = createStockPicker($("composer-stock-field"), { id: "composer-stock", compact: true, placeholder: "$ 관련 종목 (선택)" });
  const updateLength = () => {
    $("composer-len").textContent = `${body.value.length} / ${FEED_MAX}`;
  };
  body.addEventListener("input", updateLength);

  onSubmit($("composer-form"), $("composer-message"), async () => {
    const check = () => validatePostBody(body.value) ?? (body.value.trim().length > FEED_MAX ? `${FEED_MAX}자 이하로 써 주세요.` : null);
    if (!validateFields([[body, check]])) return;
    const { error } = await client.from("posts").insert({ board: "sns", body: body.value.trim(), stock_symbol: stock.value() });
    if (error) {
      throw new Error(/row-level security/i.test(error.message) ? "글을 너무 자주 쓰고 있어요. 1분 뒤에 다시 시도해 주세요." : koreanError(error));
    }
    body.value = "";
    stock.clear();
    updateLength();
    // 방금 쓴 글이 보이도록 전체 탭으로
    if (tab !== "all") selectTab("all");
    else load(true);
    renderMe();
  });
}

// ----- 내 프로필 요약 -----

async function renderMe() {
  const box = $("me-body");
  if (!user) {
    box.replaceChildren(
      el("p", { class: "me-guest-title" }, "투자 이야기를 함께 나눠요"),
      el("p", { class: "sm muted" }, "로그인하면 글을 쓰고, 투자자를 팔로우하고, 좋아요를 누를 수 있어요."),
      el("a", { class: "btn primary block", href: loginHref }, "로그인"),
    );
    return;
  }
  const profile = await getMyProfile().catch(() => null);
  if (!profile) return;
  $("composer-avatar").replaceChildren(avatar(profile.nickname));
  const counts = await profileCounts(client, user.id);
  box.replaceChildren(
    el(
      "a",
      { class: "me-head", href: `/user?id=${user.id}` },
      avatar(profile.nickname, "lg"),
      el("span", {}, el("strong", {}, profile.nickname), el("small", {}, profile.bio || "소개를 아직 쓰지 않았어요")),
    ),
    el(
      "dl",
      { class: "me-stats" },
      el("div", {}, el("dt", {}, "글"), el("dd", {}, String(counts.posts))),
      el("div", {}, el("dt", {}, "팔로워"), el("dd", {}, String(counts.followers))),
      el("div", {}, el("dt", {}, "팔로잉"), el("dd", {}, String(counts.following))),
    ),
    el("a", { class: "btn outline block sm", href: `/user?id=${user.id}` }, "내 프로필 보기"),
  );
}

// ----- 추천 투자자: 최근 글을 쓴 사람 중 아직 팔로우하지 않은 사람 -----

async function loadSuggestions() {
  const list = $("suggest");
  const { data, error } = await client
    .from("posts")
    .select("author_id, author:profiles!posts_author_id_fkey(nickname, bio)")
    .not("author_id", "is", null)
    .order("created_at", { ascending: false })
    .limit(100);
  if (error) {
    list.replaceChildren(el("li", { class: "empty" }, "불러오지 못했어요."));
    return;
  }
  const seen = new Set();
  const people = [];
  for (const row of data) {
    if (!row.author || seen.has(row.author_id) || row.author_id === user?.id || following.has(row.author_id)) continue;
    seen.add(row.author_id);
    people.push(row);
    if (people.length === 5) break;
  }
  if (!people.length) {
    list.replaceChildren(el("li", { class: "empty" }, "추천할 투자자가 아직 없어요. 글을 쓰는 사람이 늘면 여기에 보여요."));
    return;
  }
  list.replaceChildren(
    ...people.map((p) => {
      const name = authorName(p);
      return el(
        "li",
        {},
        el(
          "a",
          { class: "suggest-who", href: `/user?id=${p.author_id}` },
          avatar(name, "sm"),
          el("span", {}, el("strong", {}, name), el("small", {}, p.author.bio || "소개 없음")),
        ),
        followButton({
          client,
          user,
          targetId: p.author_id,
          name,
          following: false,
          loginHref,
          onChange: (now) => {
            if (now) following.add(p.author_id);
            else following.delete(p.author_id);
            renderMe();
            if (tab === "following") load(true);
          },
        }),
      );
    }),
  );
}
