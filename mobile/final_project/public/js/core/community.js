// 게시판·커뮤니티 공통 조각: 작성자, 게시판 배지, 작성 시각, 신고 창
import { REPORT_REASONS, boardLabel } from "/shared/boards.js";
import { formatRelativeTime } from "/shared/format.js";
import { findCatalogEntry, parseSymbolId } from "/shared/symbols.js";
import { koreanError } from "./auth.js";
import { el, icon } from "./dom.js";
import { showToast } from "./ui.js";

/** 게시글을 읽을 때 함께 가져올 열 (작성자 닉네임 포함) */
export const POST_COLUMNS =
  "id, board, title, body, stock_symbol, hidden, like_count, comment_count, created_at, updated_at, author_id, author:profiles!posts_author_id_fkey(nickname)";

/** 탈퇴한 사용자의 글은 author가 비어 있다 */
export const authorName = (row) => row.author?.nickname ?? "탈퇴한 사용자";

export function avatar(name, size = "") {
  return el("span", { class: `avatar ${size}`.trim(), "aria-hidden": "true" }, name.slice(0, 1));
}

export function boardBadge(board) {
  return el("span", { class: `board-badge b-${board}` }, boardLabel(board));
}

/** <time> 요소: 상대 시간을 보여주고, 마우스를 올리면 정확한 시각 */
export function timeEl(iso) {
  const exact = new Date(iso).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  return el("time", { datetime: iso, title: exact }, formatRelativeTime(iso));
}

/** 글에 연결된 종목 칩. 목록에 없는 종목이면 코드만 보여준다. */
export function stockChip(symbolIdValue) {
  if (!symbolIdValue) return null;
  const symbol = parseSymbolId(symbolIdValue);
  if (!symbol) return null;
  const name = findCatalogEntry(symbol)?.name ?? symbol.code;
  return el("a", { class: "stock-chip", href: `/stock?id=${encodeURIComponent(symbolIdValue)}` }, `$ ${name}`);
}

/** 글 수정 여부: 작성 직후의 자동 갱신은 무시하도록 1분 이상 차이 날 때만 */
export const isEdited = (row) => new Date(row.updated_at) - new Date(row.created_at) > 60_000;

/**
 * 신고 창. 사유를 고르고 보내면 reports에 저장한다.
 * @param {{ client: any, target: { post_id?: number, comment_id?: number }, label: string }} options
 * @returns {Promise<"sent" | "duplicate" | null>} 취소하면 null
 */
export function openReportDialog({ client, target, label }) {
  // 창을 닫으면 신고 버튼으로 포커스를 돌려준다
  const opener = document.activeElement;
  return new Promise((resolve) => {
    const message = el("p", { class: "alert error", role: "alert", hidden: true });
    const detail = el("textarea", { class: "textarea", id: "report-detail", maxlength: 300, rows: 3, placeholder: "자세한 내용 (선택)" });
    const options = REPORT_REASONS.map((reason, i) =>
      el(
        "label",
        { class: "radio-row" },
        el("input", { type: "radio", name: "report-reason", value: reason, checked: i === 0 }),
        reason,
      ),
    );
    const dialog = el(
      "dialog",
      { class: "modal", "aria-labelledby": "report-title" },
      el(
        "form",
        { class: "form", method: "dialog" },
        el("h2", { class: "modal-title", id: "report-title" }, `${label} 신고`),
        el("p", { class: "sm muted" }, "운영 원칙에 어긋나는 내용을 알려 주세요. 같은 대상은 한 번만 신고할 수 있어요."),
        el("fieldset", { class: "radio-list" }, el("legend", { class: "sr-only" }, "신고 사유"), ...options),
        el("label", { class: "sr-only", for: "report-detail" }, "자세한 내용"),
        detail,
        message,
        el(
          "div",
          { class: "modal-actions" },
          el("button", { class: "btn ghost", type: "button", value: "cancel", onclick: () => dialog.close() }, "취소"),
          el("button", { class: "btn danger-fill", type: "submit", value: "send" }, "신고하기"),
        ),
      ),
    );
    let sent = null;
    dialog.querySelector("form").addEventListener("submit", async (event) => {
      event.preventDefault();
      const reason = dialog.querySelector('input[name="report-reason"]:checked').value;
      const extra = detail.value.trim();
      const button = event.submitter;
      button.disabled = true;
      const { error } = await client.from("reports").insert({ ...target, reason: extra ? `${reason}: ${extra}` : reason });
      button.disabled = false;
      if (error && !/duplicate key/i.test(error.message)) {
        message.textContent = koreanError(error);
        message.hidden = false;
        return;
      }
      sent = error ? "duplicate" : "sent";
      dialog.close();
    });
    dialog.addEventListener("close", () => {
      dialog.remove();
      if (opener instanceof HTMLElement && opener.isConnected) opener.focus();
      resolve(sent);
    });
    document.body.append(dialog);
    dialog.showModal();
  });
}

/** 팔로우하는 사람 ID 목록 */
export async function followingIds(client, user) {
  if (!user) return new Set();
  const { data } = await client.from("follows").select("following_id").eq("follower_id", user.id);
  return new Set((data ?? []).map((r) => r.following_id));
}

/** 팔로워·팔로잉·글 수 */
export async function profileCounts(client, userId) {
  const count = (query) => query.then(({ count: n }) => n ?? 0);
  const [followers, following, posts] = await Promise.all([
    count(client.from("follows").select("follower_id", { count: "exact", head: true }).eq("following_id", userId)),
    count(client.from("follows").select("following_id", { count: "exact", head: true }).eq("follower_id", userId)),
    count(client.from("posts").select("id", { count: "exact", head: true }).eq("author_id", userId)),
  ]);
  return { followers, following, posts };
}

/**
 * 팔로우 버튼. 누르면 바로 바뀌고, 실패하면 되돌린다.
 * @param {{ client: any, user: any, targetId: string, name: string, following: boolean, loginHref: string, onChange?: (following: boolean) => void }} options
 */
export function followButton({ client, user, targetId, name, following, loginHref, onChange }) {
  const button = el("button", { type: "button", class: "btn sm follow-btn" });
  let busy = false;
  const paint = () => {
    button.classList.toggle("primary", !following);
    button.classList.toggle("outline", following);
    button.setAttribute("aria-pressed", String(following));
    button.setAttribute("aria-label", following ? `${name} 팔로우 취소` : `${name} 팔로우`);
    button.textContent = following ? "팔로잉" : "팔로우";
  };
  paint();
  button.addEventListener("click", async () => {
    if (!user) return (location.href = loginHref);
    if (busy) return;
    busy = true;
    following = !following;
    paint();
    const { error } = following
      ? await client.from("follows").insert({ following_id: targetId })
      : await client.from("follows").delete().eq("follower_id", user.id).eq("following_id", targetId);
    busy = false;
    if (error && !/duplicate key/i.test(error.message)) {
      following = !following;
      paint();
      showToast(koreanError(error));
      return;
    }
    onChange?.(following);
  });
  return button;
}

/** 게시판 목록의 글 한 줄 */
export function postRow(p) {
  const snippet = p.body.replace(/\s+/g, " ").slice(0, 120);
  return el(
    "li",
    {},
    el(
      "a",
      { class: "post-row", href: `/post?id=${p.id}` },
      el(
        "div",
        { class: "post-main" },
        el("p", { class: "post-title" }, boardBadge(p.board), el("span", {}, p.title), p.comment_count > 0 && el("span", { class: "post-ccount" }, `[${p.comment_count}]`)),
        el("p", { class: "post-snippet" }, snippet),
        el(
          "p",
          { class: "post-meta" },
          el("span", {}, authorName(p)),
          timeEl(p.created_at),
          el("span", { class: "meta-count", "aria-label": `좋아요 ${p.like_count}개` }, icon("heart", 13), String(p.like_count)),
          el("span", { class: "meta-count", "aria-label": `댓글 ${p.comment_count}개` }, icon("board", 13), String(p.comment_count)),
        ),
      ),
    ),
    // 링크 안에 링크를 넣지 않도록 종목 칩은 바깥에 둔다
    p.stock_symbol && el("div", { class: "post-chip" }, stockChip(p.stock_symbol)),
  );
}

/**
 * "더 보기" 조건: 마지막 글보다 오래된 글. 작성 시각이 같은 글이 빠지거나 겹치지 않도록 id까지 비교한다.
 * (목록은 created_at, id 내림차순)
 */
export function afterCursor({ at, id }) {
  return `created_at.lt."${at}",and(created_at.eq."${at}",id.lt.${id})`;
}
