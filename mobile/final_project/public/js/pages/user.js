// 사용자 프로필: 소개, 팔로워·팔로잉·글 수, 팔로우, 작성한 피드·게시판 글
import { feedCard, likedIds } from "../components/feed-card.js";
import { getSupabase, getUser, koreanError } from "../core/auth.js";
import { POST_COLUMNS, afterCursor, avatar, followButton, followingIds, postRow, profileCounts } from "../core/community.js";
import { $, el } from "../core/dom.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

const PAGE_SIZE = 15;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const profileId = new URLSearchParams(location.search).get("id") ?? "";
const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;
const client = await getSupabase();
const user = await getUser();
let tab = "sns";
let cursor = null;

if (!client) showMessage($("page-message"), "커뮤니티 기능(DB)이 설정되지 않았어요.");
else if (!UUID.test(profileId)) showMessage($("page-message"), "프로필 주소가 올바르지 않아요.");
else await init();

async function init() {
  const { data: profile, error } = await client.from("profiles").select("id, nickname, bio, created_at").eq("id", profileId).maybeSingle();
  if (error) return showMessage($("page-message"), koreanError(error));
  if (!profile) return showMessage($("page-message"), "탈퇴했거나 없는 사용자예요.");

  $("content").hidden = false;
  document.title = `${profile.nickname} · ECONOVA`;
  $("user-avatar").replaceChildren(avatar(profile.nickname, "xl"));
  $("user-name").textContent = profile.nickname;
  $("user-bio").textContent = profile.bio || "아직 소개를 쓰지 않았어요.";
  $("user-bio").classList.toggle("muted", !profile.bio);
  $("user-joined").textContent = `${new Date(profile.created_at).toLocaleDateString("ko-KR")} 가입`;

  const isMe = user?.id === profile.id;
  if (isMe) {
    $("user-action").replaceChildren(el("a", { class: "btn outline sm", href: "/mypage" }, "프로필 편집"));
  } else {
    const following = (await followingIds(client, user)).has(profile.id);
    $("user-action").replaceChildren(
      followButton({ client, user, targetId: profile.id, name: profile.nickname, following, loginHref, onChange: () => paintCounts() }),
    );
  }
  paintCounts();

  document.querySelectorAll("#user-tabs button").forEach((b) =>
    b.addEventListener("click", () => {
      tab = b.dataset.tab;
      document.querySelectorAll("#user-tabs button").forEach((x) => x.setAttribute("aria-selected", String(x === b)));
      load(true);
    }),
  );
  $("more-btn").addEventListener("click", () => load(false));
  load(true);
}

async function paintCounts() {
  const counts = await profileCounts(client, profileId);
  $("count-posts").textContent = String(counts.posts);
  $("count-followers").textContent = String(counts.followers);
  $("count-following").textContent = String(counts.following);
}

async function load(reset) {
  const list = $("user-posts");
  if (reset) {
    cursor = null;
    list.replaceChildren(el("p", { class: "empty panel" }, "불러오는 중…"));
  }
  let query = client.from("posts").select(POST_COLUMNS).eq("author_id", profileId).order("created_at", { ascending: false }).order("id", { ascending: false }).limit(PAGE_SIZE);
  query = tab === "sns" ? query.eq("board", "sns") : query.neq("board", "sns");
  if (cursor) query = query.or(afterCursor(cursor));
  const { data, error } = await query;
  if (error) {
    list.replaceChildren(el("p", { class: "alert error" }, `글을 불러오지 못했어요. ${koreanError(error)}`));
    return;
  }

  let items;
  if (tab === "sns") {
    const liked = await likedIds(client, user, data);
    items = data.map((post) => feedCard(post, { client, user, liked: liked.has(post.id), loginHref, onRemoved: paintCounts }));
  } else {
    items = data.map(postRow);
  }
  const wrap = (nodes) => (tab === "sns" ? nodes : [el("ul", { class: "post-list panel" }, ...nodes)]);

  if (reset) {
    list.replaceChildren(...(items.length ? wrap(items) : [el("p", { class: "empty panel" }, tab === "sns" ? "아직 피드 글이 없어요." : "아직 게시판 글이 없어요.")]));
  } else if (tab === "sns") {
    list.append(...items);
  } else {
    list.querySelector(".post-list")?.append(...items);
  }
  if (data.length) cursor = { at: data.at(-1).created_at, id: data.at(-1).id };
  $("more-btn").hidden = data.length < PAGE_SIZE;
}
