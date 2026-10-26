// 피드 카드: 짧은 글 한 개. 좋아요, 댓글로 이동, 링크 복사, 본인 글 수정·삭제, 신고
import { validatePostBody } from "/shared/validation.js";
import { koreanError } from "../core/auth.js";
import { authorName, avatar, isEdited, openReportDialog, stockChip, timeEl } from "../core/community.js";
import { el, icon } from "../core/dom.js";
import { showMessage, showToast } from "../core/ui.js";

export const FEED_MAX = 500;

/** 내가 좋아요한 글 ID 목록 (로그인하지 않았으면 빈 집합) */
export async function likedIds(client, user, posts) {
  if (!user || !posts.length) return new Set();
  const { data } = await client.from("likes").select("post_id").eq("user_id", user.id).in("post_id", posts.map((p) => p.id));
  return new Set((data ?? []).map((r) => r.post_id));
}

/**
 * @param {any} post POST_COLUMNS로 읽은 글
 * @param {{ client: any, user: any, liked: boolean, loginHref: string, onRemoved?: () => void }} ctx
 */
export function feedCard(post, ctx) {
  const { client, user } = ctx;
  const name = authorName(post);
  const mine = user && post.author_id === user.id;
  const profileHref = post.author_id ? `/user?id=${post.author_id}` : null;
  let liked = ctx.liked;
  let busy = false;

  const bodyEl = el("p", { class: "feed-body" }, post.body);
  const likeBtn = el("button", { class: "feed-act like-btn", type: "button", "aria-pressed": String(liked) });
  const paintLike = () => {
    likeBtn.setAttribute("aria-pressed", String(liked));
    likeBtn.setAttribute("aria-label", `좋아요 ${post.like_count}개${liked ? ", 누름" : ""}`);
    likeBtn.replaceChildren(icon("heart", 16), String(post.like_count));
  };
  paintLike();

  likeBtn.addEventListener("click", async () => {
    if (!user) return (location.href = ctx.loginHref);
    if (busy) return;
    busy = true;
    liked = !liked;
    post.like_count += liked ? 1 : -1;
    paintLike();
    const { error } = liked
      ? await client.from("likes").insert({ post_id: post.id })
      : await client.from("likes").delete().eq("post_id", post.id).eq("user_id", user.id);
    if (error && !/duplicate key/i.test(error.message)) {
      liked = !liked;
      post.like_count += liked ? 1 : -1;
      paintLike();
      showToast(koreanError(error));
    }
    busy = false;
  });

  const shareBtn = el(
    "button",
    {
      class: "feed-act",
      type: "button",
      "aria-label": "글 주소 복사",
      onclick: async () => {
        try {
          await navigator.clipboard.writeText(`${location.origin}/post?id=${post.id}`);
          showToast("글 주소를 복사했어요");
        } catch {
          showToast("복사하지 못했어요.");
        }
      },
    },
    icon("link", 16),
  );

  const card = el(
    "article",
    { class: "feed-card", "aria-label": `${name}의 글` },
    profileHref ? el("a", { href: profileHref, class: "feed-avatar" }, avatar(name)) : el("span", { class: "feed-avatar" }, avatar(name)),
    el(
      "div",
      { class: "feed-main" },
      el(
        "header",
        { class: "feed-head" },
        profileHref ? el("a", { class: "byline-name", href: profileHref }, name) : el("span", { class: "byline-name" }, name),
        el("a", { class: "feed-time", href: `/post?id=${post.id}` }, timeEl(post.created_at)),
        isEdited(post) && el("span", { class: "muted xs" }, "수정됨"),
        el(
          "span",
          { class: "feed-menu" },
          mine
            ? [
                el("button", { class: "text-btn", type: "button", onclick: () => startEdit() }, "수정"),
                el("button", { class: "text-btn danger-text", type: "button", onclick: () => remove() }, "삭제"),
              ]
            : user && el("button", { class: "text-btn", type: "button", onclick: () => report() }, "신고"),
        ),
      ),
      bodyEl,
      post.stock_symbol && el("div", { class: "feed-chip" }, stockChip(post.stock_symbol)),
      el(
        "footer",
        { class: "feed-actions" },
        likeBtn,
        el(
          "a",
          { class: "feed-act", href: `/post?id=${post.id}#comments-title`, "aria-label": `댓글 ${post.comment_count}개 보기` },
          icon("board", 16),
          String(post.comment_count),
        ),
        shareBtn,
      ),
    ),
  );

  function startEdit() {
    const area = el("textarea", { class: "textarea", rows: 4, maxlength: FEED_MAX, "aria-label": "글 수정" });
    area.value = post.body;
    const message = el("p", { class: "alert error", role: "alert", hidden: true });
    const save = el("button", { class: "btn primary sm", type: "button" }, "저장");
    const box = el(
      "div",
      { class: "comment-edit" },
      area,
      message,
      el("div", { class: "comment-edit-actions" }, el("button", { class: "btn ghost sm", type: "button", onclick: () => box.replaceWith(bodyEl) }, "취소"), save),
    );
    save.addEventListener("click", async () => {
      const problem = validatePostBody(area.value) ?? (area.value.trim().length > FEED_MAX ? `${FEED_MAX}자 이하로 써 주세요.` : null);
      if (problem) return showMessage(message, problem);
      save.disabled = true;
      const { error } = await client.from("posts").update({ body: area.value.trim() }).eq("id", post.id);
      save.disabled = false;
      if (error) return showMessage(message, koreanError(error));
      post.body = area.value.trim();
      bodyEl.textContent = post.body;
      box.replaceWith(bodyEl);
      showToast("수정했어요");
    });
    bodyEl.replaceWith(box);
    area.focus();
  }

  async function remove() {
    if (!confirm("이 글을 삭제할까요? 달린 댓글도 함께 삭제되고 되돌릴 수 없어요.")) return;
    const { error } = await client.from("posts").delete().eq("id", post.id);
    if (error) return showToast(koreanError(error));
    card.remove();
    showToast("글을 삭제했어요");
    ctx.onRemoved?.();
  }

  async function report() {
    const result = await openReportDialog({ client, target: { post_id: post.id }, label: "글" });
    if (result === "sent") showToast("신고가 접수됐어요. 검토 후 조치할게요.");
    else if (result === "duplicate") showToast("이미 신고한 글이에요.");
  }

  return card;
}
