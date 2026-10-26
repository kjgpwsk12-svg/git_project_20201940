// 게시글 보기: 본문, 좋아요·북마크·공유·신고, 본인 글 수정·삭제, 댓글
import { boardLabel } from "/shared/boards.js";
import { validateComment } from "/shared/validation.js";
import { getSupabase, getUser, koreanError } from "../core/auth.js";
import { POST_COLUMNS, authorName, avatar, boardBadge, isEdited, openReportDialog, stockChip, timeEl } from "../core/community.js";
import { $, el, fill, icon } from "../core/dom.js";
import { onSubmit, validateFields } from "../core/form.js";
import { initShell } from "../core/shell.js";
import { showMessage, showToast } from "../core/ui.js";

initShell();

const postId = Number.parseInt(new URLSearchParams(location.search).get("id"), 10);
const client = await getSupabase();
const user = await getUser();
const loginHref = `/login?next=${encodeURIComponent(location.pathname + location.search)}`;

if (!client) fail("게시판 기능(DB)이 설정되지 않았어요.");
else if (!Number.isSafeInteger(postId) || postId < 1) fail("게시글 주소가 올바르지 않아요.");
else await init();

function fail(text) {
  showMessage($("page-message"), text);
}

async function init() {
  const { data: post, error } = await client.from("posts").select(POST_COLUMNS).eq("id", postId).maybeSingle();
  if (error) return fail(`게시글을 불러오지 못했어요. ${koreanError(error)}`);
  // 숨김 글이거나 삭제된 글은 RLS 때문에 비어서 온다
  if (!post) return fail("삭제되었거나 볼 수 없는 게시글이에요.");

  $("content").hidden = false;
  // 피드 글(sns)은 제목이 없어 본문 앞부분을 제목처럼 쓴다
  const isFeed = post.board === "sns";
  document.title = `${isFeed ? post.body.slice(0, 30) : post.title} · ECONOVA`;
  $("back-link").href = isFeed ? "/feed" : `/board?board=${post.board}`;
  $("back-link").lastChild.textContent = isFeed ? " 커뮤니티" : ` ${boardLabel(post.board)} 게시판`;
  if (isFeed) {
    // 같은 글 화면을 쓰지만 피드 글이면 사이드 메뉴에서 커뮤니티를 표시한다
    document.querySelector('.nav-item[href="/board"]')?.removeAttribute("aria-current");
    document.querySelector('.nav-item[href="/feed"]')?.setAttribute("aria-current", "page");
  }
  renderPost(post);
  setupReactions(post);
  setupComments(post);
  loadMore(post);
}

// ----- 본문 -----

function renderPost(post) {
  const name = authorName(post);
  fill($("post-kicker"), boardBadge(post.board), stockChip(post.stock_symbol));
  if (post.title) $("post-title").textContent = post.title;
  else {
    // 피드 글은 제목이 없다: 화면에서는 숨기고 화면 읽기 프로그램용 제목만 둔다
    $("post-title").textContent = `${name}의 피드 글`;
    $("post-title").className = "sr-only";
  }
  const profileHref = post.author_id ? `/user?id=${post.author_id}` : null;
  fill($("post-byline"),
    avatar(name),
    profileHref ? el("a", { class: "byline-name", href: profileHref }, name) : el("span", { class: "byline-name" }, name),
    el("span", { class: "dot", "aria-hidden": "true" }, "·"),
    timeEl(post.created_at),
    isEdited(post) && el("span", { class: "muted" }, "(수정됨)"),
  );
  // 줄바꿈은 CSS(white-space: pre-wrap)로 살리고, 내용은 텍스트로만 넣는다
  $("post-body").textContent = post.body;
  $("hidden-note").hidden = !post.hidden;

  const mine = user && post.author_id === user.id;
  fill($("owner-actions"),
    mine
      ? [
          // 피드 글은 피드 화면에서 바로 고친다
          post.board !== "sns" && el("a", { class: "act-btn", href: `/write?id=${post.id}` }, icon("pencil", 15), "수정"),
          el("button", { class: "act-btn danger-text", type: "button", onclick: () => deletePost(post) }, icon("trash", 15), "삭제"),
        ]
      : el("button", { class: "act-btn", type: "button", onclick: () => report({ post_id: post.id }, "게시글") }, icon("flag", 15), "신고"),
  );
}

async function deletePost(post) {
  const extra = post.comment_count > 0 ? `\n달린 댓글 ${post.comment_count}개도 함께 삭제돼요.` : "";
  if (!confirm(`이 글을 삭제할까요?${extra}\n삭제하면 되돌릴 수 없어요.`)) return;
  const { error } = await client.from("posts").delete().eq("id", post.id);
  if (error) return showToast(koreanError(error));
  location.replace(post.board === "sns" ? "/feed" : `/board?board=${post.board}`);
}

async function report(target, label) {
  if (!user) return (location.href = loginHref);
  const result = await openReportDialog({ client, target, label });
  if (result === "sent") showToast("신고가 접수됐어요. 검토 후 조치할게요.");
  else if (result === "duplicate") showToast("이미 신고한 내용이에요.");
}

// ----- 좋아요·북마크·공유 -----

function setupReactions(post) {
  const likeBtn = $("like-btn");
  const bookmarkBtn = $("bookmark-btn");
  let liked = false;
  let bookmarked = false;
  // 같은 버튼을 빠르게 여러 번 누르는 것만 막는다 (좋아요와 북마크는 따로)
  let likeBusy = false;
  let markBusy = false;

  const paint = () => {
    likeBtn.setAttribute("aria-pressed", String(liked));
    likeBtn.replaceChildren(icon("heart", 16), "좋아요 ", el("strong", {}, String(post.like_count)));
    bookmarkBtn.setAttribute("aria-pressed", String(bookmarked));
    bookmarkBtn.replaceChildren(icon("bookmark", 16), bookmarked ? "저장됨" : "북마크");
  };
  $("share-btn").replaceChildren(icon("link", 16), "링크 복사");
  paint();

  if (user) {
    Promise.all([
      client.from("likes").select("post_id").eq("post_id", post.id).eq("user_id", user.id).maybeSingle(),
      client.from("bookmarks").select("id").eq("kind", "post").eq("post_id", post.id).maybeSingle(),
    ]).then(([like, mark]) => {
      liked = Boolean(like.data);
      bookmarked = Boolean(mark.data);
      paint();
    });
  }

  likeBtn.addEventListener("click", async () => {
    if (!user) return (location.href = loginHref);
    if (likeBusy) return;
    likeBusy = true;
    // 먼저 화면에 반영하고, 실패하면 되돌린다
    liked = !liked;
    post.like_count += liked ? 1 : -1;
    paint();
    const { error } = liked
      ? await client.from("likes").insert({ post_id: post.id })
      : await client.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    if (error && !/duplicate key/i.test(error.message)) {
      liked = !liked;
      post.like_count += liked ? 1 : -1;
      paint();
      showToast(koreanError(error));
    }
    likeBusy = false;
  });

  bookmarkBtn.addEventListener("click", async () => {
    if (!user) return (location.href = loginHref);
    if (markBusy) return;
    markBusy = true;
    const { error } = bookmarked
      ? await client.from("bookmarks").delete().eq("kind", "post").eq("post_id", post.id)
      : await client.from("bookmarks").insert({ kind: "post", post_id: post.id });
    markBusy = false;
    if (error && !/duplicate key/i.test(error.message)) return showToast(koreanError(error));
    bookmarked = !bookmarked;
    paint();
    showToast(bookmarked ? "북마크에 저장했어요" : "북마크에서 뺐어요");
  });

  $("share-btn").addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(location.href);
      showToast("글 주소를 복사했어요");
    } catch {
      showToast("복사하지 못했어요. 주소창의 주소를 복사해 주세요.");
    }
  });
}

// ----- 댓글 -----

function setupComments(post) {
  const form = $("comment-form");
  const body = $("comment-body");
  if (user) {
    form.hidden = false;
    body.addEventListener("input", () => ($("comment-len").textContent = `${body.value.length} / 2000`));
    onSubmit(form, $("comment-message"), async () => {
      if (!validateFields([[body, () => validateComment(body.value)]])) return;
      const { error } = await client.from("comments").insert({ post_id: post.id, body: body.value.trim() });
      if (error) throw new Error(/row-level security/i.test(error.message) ? "댓글을 너무 자주 쓰고 있어요. 잠시 후 다시 시도해 주세요." : koreanError(error));
      body.value = "";
      $("comment-len").textContent = "0 / 2000";
      await loadComments(post);
      $("comments").lastElementChild?.scrollIntoView({ behavior: "smooth", block: "nearest" });
    });
  } else {
    const prompt = $("comment-login");
    prompt.hidden = false;
    prompt.replaceChildren(el("a", { class: "link", href: loginHref }, "로그인"), "하고 댓글을 남겨 보세요.");
  }
  loadComments(post);
}

async function loadComments(post) {
  const list = $("comments");
  const { data, error } = await client
    .from("comments")
    .select("id, body, hidden, created_at, updated_at, author_id, author:profiles!comments_author_id_fkey(nickname)")
    .eq("post_id", post.id)
    .order("created_at", { ascending: true })
    .limit(500);
  if (error) {
    list.replaceChildren(el("li", { class: "empty" }, "댓글을 불러오지 못했어요."));
    return;
  }
  $("comment-count").textContent = `${data.length}개`;
  list.replaceChildren(...(data.length ? data.map((c) => commentItem(c, post)) : [el("li", { class: "empty" }, "첫 댓글을 남겨 보세요.")]));
}

function commentItem(c, post) {
  const name = authorName(c);
  const mine = user && c.author_id === user.id;
  const bodyEl = el("p", { class: "comment-body" }, c.body);
  const li = el(
    "li",
    { class: "comment" },
    avatar(name, "sm"),
    el(
      "div",
      { class: "comment-main" },
      el(
        "p",
        { class: "comment-meta" },
        el("span", { class: "byline-name" }, name),
        c.author_id && c.author_id === post.author_id && el("span", { class: "writer-tag" }, "작성자"),
        timeEl(c.created_at),
        isEdited(c) && el("span", { class: "muted" }, "(수정됨)"),
        c.hidden && el("span", { class: "muted" }, "· 숨김 처리됨"),
      ),
      bodyEl,
      el(
        "div",
        { class: "comment-actions" },
        mine
          ? [
              el("button", { class: "text-btn", type: "button", onclick: () => editComment(c, li, post) }, "수정"),
              el("button", { class: "text-btn danger-text", type: "button", onclick: () => deleteComment(c, post) }, "삭제"),
            ]
          : user && el("button", { class: "text-btn", type: "button", onclick: () => report({ comment_id: c.id }, "댓글") }, "신고"),
      ),
    ),
  );
  return li;
}

function editComment(c, li, post) {
  const main = li.querySelector(".comment-main");
  const area = el("textarea", { class: "textarea", rows: 3, maxlength: 2000, "aria-label": "댓글 수정" });
  area.value = c.body;
  const message = el("p", { class: "alert error", role: "alert", hidden: true });
  const save = el("button", { class: "btn primary sm", type: "button" }, "저장");
  const cancel = el("button", { class: "btn ghost sm", type: "button", onclick: () => loadComments(post) }, "취소");
  save.addEventListener("click", async () => {
    const problem = validateComment(area.value);
    if (problem) return showMessage(message, problem);
    save.disabled = true;
    const { error } = await client.from("comments").update({ body: area.value.trim() }).eq("id", c.id);
    save.disabled = false;
    if (error) return showMessage(message, koreanError(error));
    loadComments(post);
  });
  main.querySelector(".comment-body").replaceWith(el("div", { class: "comment-edit" }, area, message, el("div", { class: "comment-edit-actions" }, cancel, save)));
  main.querySelector(".comment-actions").hidden = true;
  area.focus();
}

async function deleteComment(c, post) {
  if (!confirm("댓글을 삭제할까요?")) return;
  const { error } = await client.from("comments").delete().eq("id", c.id);
  if (error) return showToast(koreanError(error));
  showToast("댓글을 삭제했어요");
  loadComments(post);
}

// ----- 같은 게시판의 다른 글 -----

async function loadMore(post) {
  const isFeed = post.board === "sns";
  $("more-link").href = isFeed ? "/feed" : `/board?board=${post.board}`;
  if (isFeed) $("more-title").textContent = "최근 피드";
  const { data } = await client
    .from("posts")
    .select("id, title, body, comment_count, created_at")
    .eq("board", post.board)
    .neq("id", post.id)
    .order("created_at", { ascending: false })
    .limit(6);
  $("more-posts").replaceChildren(
    ...(data?.length
      ? data.map((p) =>
          el(
            "li",
            {},
            el(
              "a",
              { href: `/post?id=${p.id}` },
              el("span", { class: "side-title" }, p.title ?? p.body.slice(0, 60)),
              el("span", { class: "side-meta" }, timeEl(p.created_at), p.comment_count > 0 && ` · 댓글 ${p.comment_count}`),
            ),
          ),
        )
      : [el("li", { class: "empty" }, "다른 글이 없어요.")]),
  );
}
