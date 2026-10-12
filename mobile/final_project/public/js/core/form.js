// 폼 공통 처리: 필드 오류 표시, 제출 중 버튼 잠금
import { showMessage } from "./ui.js";

/** 필드 아래 안내 문구를 오류로 바꾸거나 원래대로 돌린다 */
export function setFieldError(input, message) {
  const hintId = input.getAttribute("aria-describedby");
  const hint = hintId ? document.getElementById(hintId) : null;
  input.setAttribute("aria-invalid", message ? "true" : "false");
  if (!hint) return;
  hint.dataset.original ??= hint.textContent;
  hint.textContent = message ?? hint.dataset.original;
  hint.classList.toggle("error", Boolean(message));
  hint.hidden = !hint.textContent;
}

/**
 * 검증 규칙을 적용한다. 첫 오류 필드에 포커스를 주고, 모두 통과하면 true.
 * @param {[HTMLElement, () => string | null][]} rules
 */
export function validateFields(rules) {
  let first = null;
  for (const [input, check] of rules) {
    const message = check();
    setFieldError(input, message);
    if (message && !first) first = input;
  }
  first?.focus();
  return !first;
}

/** 제출 처리: 버튼을 잠그고, 오류가 나면 메시지를 보여준다 */
export function onSubmit(form, messageEl, handler) {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const button = form.querySelector('button[type="submit"]');
    const label = button.textContent;
    showMessage(messageEl, "");
    button.disabled = true;
    button.textContent = "처리 중…";
    try {
      await handler();
    } catch (error) {
      showMessage(messageEl, error.message);
    } finally {
      button.disabled = false;
      button.textContent = label;
    }
  });
}

/** 로그인 기능이 설정되지 않았을 때 */
export function disableForm(form, messageEl, text) {
  form.querySelectorAll("input, button, textarea, select").forEach((x) => (x.disabled = true));
  showMessage(messageEl, text);
}
