// 글쓰기·수정: 게시판 선택, 제목, 관련 종목, 내용
import { BOARDS, isBoardId } from "/shared/boards.js";
import { validatePostBody, validatePostTitle } from "/shared/validation.js";
import { getSupabase, koreanError, requireUser } from "../core/auth.js";
import { createStockPicker } from "../components/stock-picker.js";
import { $, el } from "../core/dom.js";
import { onSubmit, validateFields } from "../core/form.js";
import { initShell } from "../core/shell.js";
import { showMessage } from "../core/ui.js";

initShell();

// 임시 저장 키와 보관 기간 (아래 init이 먼저 실행되므로 맨 위에 둔다)
const draftKey = (userId) => `econova:draft:${userId}`;
const DRAFT_DAYS = 7;

const params = new URLSearchParams(location.search);
const editId = params.has("id") ? Number.parseInt(params.get("id"), 10) : null;
const client = await getSupabase();

if (!client) showMessage($("page-message"), "게시판 기능(DB)이 설정되지 않았어요.");
else {
  const user = await requireUser();
  if (user) await init(user);
}

async function init(user) {
  let post = null;
  if (editId !== null) {
    if (!Number.isSafeInteger(editId)) return showMessage($("page-message"), "게시글 주소가 올바르지 않아요.");
    const { data, error } = await client.from("posts").select("id, board, title, body, stock_symbol, author_id").eq("id", editId).maybeSingle();
    if (error) return showMessage($("page-message"), koreanError(error));
    if (!data || data.board === "sns") return showMessage($("page-message"), "삭제되었거나 볼 수 없는 게시글이에요.");
    if (data.author_id !== user.id) return showMessage($("page-message"), "본인이 쓴 글만 수정할 수 있어요.");
    post = data;
  }

  $("content").hidden = false;
  const title = $("title");
  const body = $("body");
  // 새 글은 쓰던 내용을 이 브라우저에 임시 저장해 두었다가 다시 열면 불러온다
  const draft = post ? null : readDraft(user.id);
  const startBoard = post?.board ?? draft?.board ?? (isBoardId(params.get("board")) ? params.get("board") : "free");
  const picker = setupBoardPicker(startBoard);
  const stock = createStockPicker($("stock-field"), {
    id: "stock-input",
    initialId: post ? post.stock_symbol : (params.get("stock") ?? draft?.stock ?? null),
    onChange: () => $("write-form").dispatchEvent(new Event("change")),
  });

  if (post) {
    document.title = "글 수정 · ECONOVA";
    $("page-title").textContent = "글 수정";
    $("submit-btn").textContent = "수정 완료";
    title.value = post.title;
    body.value = post.body;
    $("cancel-link").href = `/post?id=${post.id}`;
    $("back-link").href = `/post?id=${post.id}`;
    $("back-link").lastChild.textContent = " 글로 돌아가기";
  } else {
    $("cancel-link").href = `/board?board=${startBoard}`;
    $("back-link").href = `/board?board=${startBoard}`;
    if (draft) {
      title.value = draft.title;
      body.value = draft.body;
      showDraftNotice(user.id, () => {
        title.value = "";
        body.value = "";
        updateLength();
      });
    }
    const save = () => writeDraft(user.id, { board: picker.value(), title: title.value, body: body.value, stock: stock.value() });
    $("write-form").addEventListener("input", save);
    $("write-form").addEventListener("change", save);
  }

  function updateLength() {
    $("body-len").textContent = `${body.value.length.toLocaleString()} / 10,000`;
  }
  body.addEventListener("input", updateLength);
  updateLength();

  // 쓰던 내용이 있으면 실수로 나가지 않도록 묻는다 (새 글은 임시 저장되므로 수정할 때만)
  const initial = post ? JSON.stringify([title.value, body.value]) : null;
  let submitted = false;
  window.addEventListener("beforeunload", (event) => {
    if (post && !submitted && JSON.stringify([title.value, body.value]) !== initial) event.preventDefault();
  });

  onSubmit($("write-form"), $("form-message"), async () => {
    const valid = validateFields([
      [title, () => validatePostTitle(title.value)],
      [body, () => validatePostBody(body.value)],
    ]);
    if (!valid) return;
    const values = { board: picker.value(), title: title.value.trim(), body: body.value.trim(), stock_symbol: stock.value() };
    const { data, error } = post
      ? await client.from("posts").update(values).eq("id", post.id).select("id").single()
      : await client.from("posts").insert(values).select("id").single();
    if (error) {
      // 1분에 5개를 넘기면 RLS(can_write_post)에서 거부된다
      throw new Error(/row-level security/i.test(error.message) ? "글을 너무 자주 쓰고 있어요. 1분 뒤에 다시 시도해 주세요." : koreanError(error));
    }
    submitted = true;
    if (!post) clearDraft(user.id);
    location.replace(`/post?id=${data.id}`);
  });
}

// ----- 임시 저장 (이 브라우저에만, 사용자별로 7일) -----

function readDraft(userId) {
  try {
    const draft = JSON.parse(localStorage.getItem(draftKey(userId)));
    if (!draft) return null;
    if (Date.now() - draft.savedAt > DRAFT_DAYS * 86400_000) {
      localStorage.removeItem(draftKey(userId)); // 기간이 지난 임시 글은 지운다
      return null;
    }
    if (!draft.title.trim() && !draft.body.trim()) return null;
    return draft;
  } catch {
    return null;
  }
}

function writeDraft(userId, values) {
  try {
    if (!values.title.trim() && !values.body.trim()) localStorage.removeItem(draftKey(userId));
    else localStorage.setItem(draftKey(userId), JSON.stringify({ ...values, savedAt: Date.now() }));
  } catch {
    // 저장소를 쓸 수 없는 환경(사생활 보호 모드 등)에서는 임시 저장 없이 진행
  }
}

function clearDraft(userId) {
  try {
    localStorage.removeItem(draftKey(userId));
  } catch {
    // 무시
  }
}

function showDraftNotice(userId, onDiscard) {
  const notice = $("draft-notice");
  notice.hidden = false;
  notice.replaceChildren(
    el("span", {}, "임시 저장된 글을 불러왔어요."),
    el(
      "button",
      {
        class: "text-btn",
        type: "button",
        onclick: () => {
          clearDraft(userId);
          onDiscard();
          notice.hidden = true;
          $("title").focus();
        },
      },
      "지우고 새로 쓰기",
    ),
  );
}

/** 게시판 선택: 라디오 버튼을 알약 모양으로 */
function setupBoardPicker(selected) {
  const box = $("board-picker");
  box.replaceChildren(
    ...BOARDS.map((b) =>
      el(
        "label",
        { class: "board-option" },
        el("input", { type: "radio", name: "board", value: b.id, checked: b.id === selected }),
        el("span", {}, b.label),
      ),
    ),
  );
  return { value: () => box.querySelector("input:checked").value };
}
