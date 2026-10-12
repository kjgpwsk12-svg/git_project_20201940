import { validateEmail } from "/shared/validation.js";
import { getSupabase, koreanError } from "../core/auth.js";
import { $ } from "../core/dom.js";
import { disableForm, onSubmit, validateFields } from "../core/form.js";
import { showMessage } from "../core/ui.js";

const form = $("form");
const message = $("message");
const email = $("email");

const client = await getSupabase();
if (!client) disableForm(form, message, "로그인 기능이 아직 설정되지 않았어요.");

onSubmit(form, message, async () => {
  if (!validateFields([[email, () => validateEmail(email.value)]])) return;
  const { error } = await client.auth.resetPasswordForEmail(email.value.trim(), { redirectTo: `${location.origin}/reset` });
  if (error) throw new Error(koreanError(error));
  // 가입 여부를 알려주지 않도록 항상 같은 안내를 보여준다
  showMessage(message, "가입된 이메일이라면 재설정 링크를 보냈어요. 이 브라우저에서 메일의 링크를 열어 주세요.", "success");
});
